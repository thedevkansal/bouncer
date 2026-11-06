// Autonomous research agent: discovers the API, pays per request over x402 on
// Hedera testnet with no human approval.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@hiero-ledger/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const API = process.env.API_PUBLIC_URL || "http://localhost:4000";
const signer = createClientHederaSigner(
  process.env.AGENT_HEDERA_ID!,
  PrivateKey.fromStringECDSA(process.env.AGENT_HEDERA_KEY!),
  { network: "hedera:testnet" },
);
const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
const payFetch = wrapFetchWithPayment(fetch, client);

// 1. Discover
const manifest = (await (await fetch(`${API}/.well-known/bouncer.json`)).json()) as {
  endpoints: { method: string; url: string; priceUsd: unknown }[];
};
const research = manifest.endpoints.find((e) => e.url.endsWith("/premium/research"))!;
console.log("[agent] discovered", research.url, research.priceUsd);

// 2. Call + pay autonomously
const res = await payFetch(`${research.url}?q=${encodeURIComponent("hedera x402")}`, {
  headers: { "X-Agent-Id": "research-agent" },
});
console.log("[agent] status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) {
  const settle = decodePaymentResponseHeader(pr);
  console.log("[agent] settled tx", settle.transaction, `https://hashscan.io/testnet/transaction/${settle.transaction}`);
}
console.log("[agent] body", await res.text());
