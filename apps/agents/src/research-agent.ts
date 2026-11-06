// Autonomous research agent (research.dev.bouncer.eth): discovers the API and pays
// per request over x402 on Hedera testnet with no human approval.
//   pnpm agent              one signed research call
//   pnpm agent -- --anon    same call as an anonymous, unverified agent
//   pnpm agent -- --n 5     five calls
//   pnpm agent -- --dataset request the $0.50 dataset (triggers World step-up)
import { agentFromEnv } from "./lib.js";

const agent = agentFromEnv();
const manifest = await agent.discover();
const research = manifest.endpoints.find((e) => e.url.endsWith("/premium/research"))!;
console.log(`[${agent.label}] discovered ${research.url} price`, research.priceUsd);

const nIdx = process.argv.indexOf("--n");
const n = nIdx > 0 ? Number(process.argv[nIdx + 1]) : 1;

if (process.argv.includes("--dataset")) {
  const r = await agent.get("/premium/dataset", {
    onChallenge: (c) =>
      console.log(`\n[${agent.label}] STEP-UP REQUIRED — human, approve with World ID:\n  ${c.verificationUriComplete}\n  code ${c.userCode}  (expires ${new Date(c.expiresAt).toLocaleTimeString()})\n`),
  });
  console.log(`[${agent.label}] dataset → ${r.status}`, r.tx ? `paid ${r.hashscan}` : "nothing paid", JSON.stringify(r.body).slice(0, 200));
} else {
  for (let i = 0; i < n; i++) {
    const r = await agent.get(`/premium/research?q=${encodeURIComponent(`hedera x402 #${i + 1}`)}`);
    console.log(`[${agent.label}] #${i + 1} → ${r.status} ${r.body?.pricedAs ?? r.body?.error ?? ""}`, r.hashscan ?? "");
  }
}
process.exit(0);
