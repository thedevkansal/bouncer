// Step-up (World ID Agent Pass) for above-threshold actions + per-agent daily spend cap.
// The protected action (x402 payment + serving data) only proceeds when a FRESH World
// verification for this exact agent + route + human was validated by our backend.
// Pending / denied / expired / cancelled → 403 and no 402 is ever issued, so no payment
// can settle and no data is served.
import type { BouncerContext, BouncerRequest, Verdict } from "./types.js";
import type { AgentIdentity } from "./index.js";
import type { World } from "./world.js";

type Stop = { status: number; body: unknown; verdict: Verdict } | null;

export function createStepUp(world: World | null) {
  const used = new Set<string>(); // challenge ids already spent on a settled payment
  const spentToday = new Map<string, { day: string; usd: number }>();
  const today = () => new Date().toISOString().slice(0, 10);

  function spent(agent: string) {
    const s = spentToday.get(agent);
    return s && s.day === today() ? s.usd : 0;
  }

  async function gate(req: BouncerRequest, ctx: BouncerContext, identity: AgentIdentity): Promise<Stop> {
    // Daily budget from the agent's ENS policy (maxSpendPerDay).
    const cap = identity.policy?.maxSpendPerDayUsd;
    if (cap !== undefined && spent(ctx.agent) + ctx.priceUsd > cap) {
      return { status: 403, verdict: "over_budget", body: { message: `ENS policy maxSpendPerDay=$${cap}; spent $${spent(ctx.agent).toFixed(3)} today` } };
    }

    const threshold = identity.policy?.stepUpAboveUsd;
    if (threshold === undefined || ctx.priceUsd <= threshold) return null;

    if (!ctx.verified || !ctx.humanHash) {
      return { status: 403, verdict: "step_up_denied", body: { message: `$${ctx.priceUsd} exceeds step-up threshold $${threshold}; only human-backed agents may request it` } };
    }
    if (!world) return { status: 503, verdict: "step_up_denied", body: { message: "World not configured" } };

    const purpose = `stepup:${ctx.agent}:${ctx.route.route}`;
    const id = req.header("x-stepup-challenge");
    if (!id) {
      const c = await world.start(purpose);
      return {
        status: 403,
        verdict: "step_up_required",
        body: { message: `$${ctx.priceUsd} > $${threshold}: fresh human verification required`, challenge: world.view(c) },
      };
    }
    const c = world.get(id);
    if (!c || c.purpose !== purpose) return { status: 403, verdict: "step_up_denied", body: { message: "unknown challenge for this agent/route" } };
    if (c.status === "pending") return { status: 403, verdict: "step_up_required", body: { message: "waiting for human", challenge: world.view(c) } };
    if (c.status !== "approved") return { status: 403, verdict: "step_up_denied", body: { message: `step-up ${c.status}: action blocked, nothing charged`, challenge: world.view(c) } };
    if (c.humanHash !== ctx.humanHash) return { status: 403, verdict: "step_up_denied", body: { message: "approval came from a different human" } };
    if (used.has(c.id)) return { status: 403, verdict: "step_up_denied", body: { message: "challenge already used" } };
    if (Date.now() - (c.authTime ? c.authTime * 1000 : c.createdAt) > 10 * 60_000) {
      return { status: 403, verdict: "step_up_denied", body: { message: "approval too old; request a fresh one" } };
    }
    ctx.stepUpChallenge = c.id;
    return null;
  }

  return {
    gate,
    onSettled(ctx: BouncerContext | undefined) {
      if (!ctx) return;
      if (ctx.stepUpChallenge) used.add(ctx.stepUpChallenge);
      spentToday.set(ctx.agent, { day: today(), usd: spent(ctx.agent) + ctx.priceUsd });
    },
    spent,
    reset() {
      used.clear();
      spentToday.clear();
    },
  };
}

export type StepUp = ReturnType<typeof createStepUp>;
