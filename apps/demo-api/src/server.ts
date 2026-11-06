import express from "express";
import {
  bouncer, bus, recentEvents, usdToAmount, emit, createEns, createWorld, createBindings, type BouncerRequest,
} from "@bouncer/middleware";
import { bouncerConfig, PORT, PUBLIC_URL } from "./config.js";

// ENSv2 (Sepolia): identity, policy, revocation — resolved live, cached ≤10s.
const ens = createEns({
  rpcUrl: process.env.SEPOLIA_RPC_URL,
  universalResolver: (process.env.ENS_UNIVERSAL_RESOLVER || "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe") as `0x${string}`,
  ethRegistry: (process.env.ENS_ETH_REGISTRY || "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4") as `0x${string}`,
  cacheMs: Number(process.env.POLICY_CACHE_MS || 10_000),
  maxSkewSec: 60,
});

// World ID Agent Pass: human binding + step-up. Validated in this backend only.
const bindings = createBindings();
const worldEnabled = Boolean(process.env.WORLD_CLIENT_ID && process.env.WORLD_CLIENT_SECRET);
const world = worldEnabled
  ? createWorld({
      issuer: process.env.WORLD_ISSUER || "https://auth.world.org",
      clientId: process.env.WORLD_CLIENT_ID!,
      clientSecret: process.env.WORLD_CLIENT_SECRET!,
      humanSalt: process.env.WORLD_HUMAN_SALT || "",
      ttlSec: Number(process.env.STEPUP_TTL_SEC || 120),
      onChange: (c) => {
        if (c.status === "approved" && c.purpose.startsWith("bind:") && c.humanHash) {
          bindings.bind(c.purpose.slice(5), c.humanHash, c.acr);
        }
        emit({ type: "stepup", humanHash: c.humanHash?.slice(0, 12) ?? null, verdict: c.status, detail: { id: c.id, purpose: c.purpose, reason: c.reason } });
      },
    })
  : null;

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.DASHBOARD_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Discovery manifest: agents find endpoints, prices and the payment network here.
app.get("/.well-known/bouncer.json", (_req, res) => {
  const h = bouncerConfig.hedera;
  res.json({
    name: "Bouncer demo API",
    tagline: "Real agents get in. Bots get bounced.",
    x402: { version: 2, scheme: "exact", network: h.network, asset: h.asset, payTo: h.payTo, facilitator: h.facilitatorUrl },
    identity: { headers: ["X-Agent-ENS", "X-Agent-Signature", "X-Agent-Timestamp", "X-Agent-Nonce"], chain: "eip155:11155111" },
    endpoints: bouncerConfig.routes.map((r) => {
      const [method, path] = r.route.split(" ");
      return {
        method,
        url: `${PUBLIC_URL}${path}`,
        description: r.description,
        priceUsd: { humanBacked: r.verifiedUsd, unverified: r.unverifiedUsd },
        amount: { humanBacked: usdToAmount(h, r.verifiedUsd), unverified: usdToAmount(h, r.unverifiedUsd) },
      };
    }),
    rateLimits: bouncerConfig.rateLimits,
  });
});

// Live event stream for the dashboard.
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  for (const e of recentEvents().slice(-100)) res.write(`data: ${JSON.stringify(e)}\n\n`);
  const on = (e: unknown) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on("event", on);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    bus.off("event", on);
    clearInterval(ping);
  });
});

// --- World ID Agent Pass endpoints (client secret stays here) ---
app.post("/world/bind", async (req, res) => {
  if (!world) return res.status(503).json({ error: "world_not_configured" });
  const agent = String(req.body?.agent ?? "");
  const rec = await ens.lookup(agent).catch(() => null);
  if (!rec?.registered) return res.status(400).json({ error: "agent must be a registered ENSv2 name" });
  const c = await world.start(`bind:${rec.name}`);
  res.json(world.view(c));
});
app.get("/world/challenge/:id", (req, res) => {
  const c = world?.get(req.params.id);
  return c ? res.json(world!.view(c)) : res.status(404).json({ error: "not_found" });
});
app.post("/world/challenge/:id/cancel", (req, res) => {
  const c = world?.cancel(req.params.id);
  return c ? res.json(world!.view(c)) : res.status(404).json({ error: "not_found" });
});
app.get("/world/bindings", (_req, res) => res.json(bindings.all()));
app.get("/ens/:name", async (req, res) => res.json(await ens.lookup(req.params.name, true).catch((e) => ({ error: String(e) }))));

app.use(
  ...bouncer(bouncerConfig, {
    identify: ens.identify,
    humanFor: async (agent) => bindings.humanFor(agent),
  }),
);

app.get("/premium/research", (req: BouncerRequest, res) => {
  const q = String(req.query.q ?? "x402 on Hedera");
  res.json({
    q,
    answer: `Bouncer research result for "${q}": human-backed agents pay fair prices; swarms pay surge.`,
    servedTo: req.bouncer?.agent,
    pricedAs: req.bouncer?.verified ? "human-backed" : "unverified",
  });
});

app.get("/premium/dataset", (req: BouncerRequest, res) => {
  res.json({
    dataset: "agent-traffic-2026",
    rows: Array.from({ length: 5 }, (_, i) => ({ id: i, value: Math.round(Math.sin(i) * 1000) })),
    servedTo: req.bouncer?.agent,
  });
});

app.listen(PORT, () => console.log(`[demo-api] listening on ${PUBLIC_URL}`));
