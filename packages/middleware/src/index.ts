// Bouncer: drop-in Express middleware.
//   a. identity (ENSv2)  b. policy + revocation (ENSv2)  c. human backing (World)
//   d. pricing + per-human rate limits  e. step-up (World)  f. payment (Hedera x402)
//   g. audit (Hedera HCS)  h. serve + emit
import { randomUUID } from "node:crypto";
import type { NextFunction, Response, RequestHandler } from "express";
import { allowUnverified, allowVerified } from "./ratelimit.js";
import { createX402, CTX_HEADER, type SettledPayment } from "./x402.js";
import { emit } from "./events.js";
import type { BouncerConfig, BouncerContext, BouncerRequest, RoutePrice, Verdict } from "./types.js";

export * from "./types.js";
export { bus, recentEvents, clearEvents, emit } from "./events.js";
export { resetRateLimits, humanUsage } from "./ratelimit.js";
export { usdToAmount } from "./x402.js";
export { createWorld, type World, type Challenge, type ChallengeStatus } from "./world.js";
export { createEns, signingMessage, POLICY_KEYS, type Ens, type EnsRecord } from "./ens.js";
export { createBindings, type Bindings } from "./bindings.js";
export { createStepUp, type StepUp } from "./stepup.js";
export { createHcsAudit, type HcsAudit, type AuditEntry } from "./hcs.js";

/** Result of the ENS identity + policy stage (a, b). */
export interface AgentIdentity {
  agent: string;
  ensVerified: boolean;
  policy?: {
    maxSpendPerDayUsd?: number;
    rateLimitPerMin?: number;
    allowedPaths?: string[];
    stepUpAboveUsd?: number;
  };
}

export interface BouncerHooks {
  /** a+b: verify ENS identity/signature/policy/revocation. Throw IdentityError to reject. */
  identify?: (req: BouncerRequest) => Promise<AgentIdentity | null>;
  /** c: map an agent to a salted human hash if World-verified, else null. */
  humanFor?: (agent: string) => Promise<string | null>;
  /** e: returns null to continue, or a response object to stop (step-up required/denied). */
  stepUp?: (req: BouncerRequest, ctx: BouncerContext, identity: AgentIdentity) => Promise<null | { status: number; body: unknown; verdict: Verdict }>;
  /** g: called after a payment settles on Hedera. */
  onSettled?: (p: SettledPayment, ctx: BouncerContext | undefined) => Promise<void>;
}

export class IdentityError extends Error {
  constructor(public status: number, public code: Verdict | string, message: string) {
    super(message);
  }
}

export function hashscanTx(txId: string, network = "testnet") {
  return `https://hashscan.io/${network}/transaction/${encodeURIComponent(txId)}`;
}

function matchRoute(cfg: BouncerConfig, method: string, path: string): RoutePrice | undefined {
  return cfg.routes.find((r) => r.route === `${method.toUpperCase()} ${path}`);
}

export function bouncer(cfg: BouncerConfig, hooks: BouncerHooks = {}): RequestHandler[] {
  const contexts = new Map<string, BouncerContext>();
  const getCtx = (id: string | undefined) => (id ? contexts.get(id) : undefined);

  const pipeline: RequestHandler = async (req: BouncerRequest, res: Response, next: NextFunction) => {
    delete req.headers[CTX_HEADER]; // never trust a client-supplied context id
    const route = matchRoute(cfg, req.method, req.path);
    if (!route) return next();

    const deny = (status: number, verdict: Verdict, body: Record<string, unknown>, agent?: string) => {
      emit({ type: "request", agent, path: req.path, verdict, detail: body });
      res.status(status).json({ error: verdict, ...body });
    };

    // a + b: identity, policy, revocation (ENSv2)
    let identity: AgentIdentity | null = null;
    try {
      identity = hooks.identify ? await hooks.identify(req) : null;
    } catch (e) {
      if (e instanceof IdentityError) return deny(e.status, e.code as Verdict, { message: e.message }, String(req.header("x-agent-ens") ?? ""));
      return next(e);
    }
    if (!identity) {
      const anon = String(req.header("x-agent-id") ?? req.ip ?? "unknown").slice(0, 64);
      identity = { agent: `anon:${anon}`, ensVerified: false };
    }
    if (identity.policy?.allowedPaths && !identity.policy.allowedPaths.some((p) => req.path.startsWith(p))) {
      return deny(403, "forbidden_path", { message: `ENS policy does not allow ${req.path}` }, identity.agent);
    }

    // c: human backing (World). Only ENS-verified agents can be human-backed.
    const humanHash = identity.ensVerified && hooks.humanFor ? await hooks.humanFor(identity.agent) : null;
    const verified = humanHash !== null;

    // d: pricing + rate limits (per HUMAN when verified)
    const priceUsd = verified ? route.verifiedUsd : route.unverifiedUsd;
    const ctx: BouncerContext = {
      id: randomUUID(),
      route,
      agent: identity.agent,
      ensVerified: identity.ensVerified,
      humanHash,
      verified,
      priceUsd,
      startedAt: Date.now(),
    };

    const isRetryWithPayment = Boolean(req.header("payment-signature") || req.header("x-payment"));
    if (!isRetryWithPayment) {
      const perMin = Math.min(cfg.rateLimits.verifiedPerHumanPerMin, identity.policy?.rateLimitPerMin ?? Infinity);
      const ok = verified
        ? allowVerified(humanHash!, perMin)
        : allowUnverified(identity.agent, cfg.rateLimits.unverifiedMinIntervalSec);
      if (!ok) {
        res.setHeader("Retry-After", verified ? "60" : String(cfg.rateLimits.unverifiedMinIntervalSec));
        return deny(429, "bounced_rate_limit", {
          message: verified ? "Per-human quota exhausted (shared across all your agents)" : "Unverified agents: 1 request per interval",
          verified,
        }, identity.agent);
      }
    }

    // e: step-up (World) for above-threshold actions
    if (hooks.stepUp) {
      const stop = await hooks.stepUp(req, ctx, identity);
      if (stop) return deny(stop.status, stop.verdict, stop.body as Record<string, unknown>, identity.agent);
    }

    contexts.set(ctx.id, ctx);
    setTimeout(() => contexts.delete(ctx.id), 5 * 60_000).unref();
    req.headers[CTX_HEADER] = ctx.id;
    req.bouncer = ctx;

    res.on("finish", () => {
      emit({
        type: "request",
        agent: ctx.agent,
        humanHash: ctx.humanHash,
        verified: ctx.verified,
        path: req.path,
        priceUsd: ctx.priceUsd,
        verdict: res.statusCode === 402 ? "payment_required" : res.statusCode < 300 ? "admitted" : `http_${res.statusCode}`,
      });
    });
    next();
  };

  // f: Hedera x402 (verify + settle via facilitator) → g: audit
  const pay = createX402(cfg, getCtx, (p) => {
    const ctx = getCtx(p.ctxId);
    emit({
      type: "payment",
      agent: ctx?.agent,
      humanHash: ctx?.humanHash,
      verified: ctx?.verified,
      path: ctx?.route.route,
      priceUsd: ctx?.priceUsd,
      txId: p.transaction,
      hashscan: hashscanTx(p.transaction),
      detail: { amount: p.amount, asset: p.asset, payer: p.payer },
    });
    hooks.onSettled?.(p, ctx).catch((e) => console.error("[bouncer] onSettled failed", e));
  });

  return [pipeline, pay as RequestHandler];
}
