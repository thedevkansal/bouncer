import express from "express";
import { bouncer, bus, recentEvents, usdToAmount, type BouncerRequest } from "@bouncer/middleware";
import { bouncerConfig, PORT, PUBLIC_URL } from "./config.js";

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

app.use(...bouncer(bouncerConfig));

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
