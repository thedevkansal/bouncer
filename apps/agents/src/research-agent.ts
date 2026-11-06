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
import { privateKeyToAccount } from "viem/accounts";
import { randomUUID } from "node:crypto";
import { signingMessage } from "@bouncer/middleware";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const API = process.env.API_PUBLIC_URL || "http://localhost:4000";
const signer = createClientHederaSigner(
  process.env.AGENT_HEDERA_ID!,
  PrivateKey.fromStringECDSA(process.env.AGENT_HEDERA_KEY!),
  { network: "hedera:testnet" },
);
// Agent-side spending control: only HBAR on Hedera testnet, hard cap per payment.
const maxTinybars = process.env.AGENT_MAX_TINYBARS_PER_PAYMENT || "1500000000"; // 15 HBAR
const client = new x402Client()
  .register("hedera:*", new ExactHederaScheme(signer))
  .setSpendControls({ allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: maxTinybars }] });
const payFetch = wrapFetchWithPayment(fetch, client);

// 1. Discover
const manifest = (await (await fetch(`${API}/.well-known/bouncer.json`)).json()) as {
  endpoints: { method: string; url: string; priceUsd: unknown }[];
};
const research = manifest.endpoints.find((e) => e.url.endsWith("/premium/research"))!;
console.log("[agent] discovered", research.url, research.priceUsd);

// 2. Sign the request with the key our ENS name resolves to, then call + pay autonomously
const agentName = process.env.AGENT_ENS_NAME;
const url = new URL(`${research.url}?q=${encodeURIComponent("hedera x402")}`);
const headers: Record<string, string> = { "X-Agent-Id": "research-agent" };
if (agentName && process.env.AGENT_EVM_KEY && !process.argv.includes("--anon")) {
  const account = privateKeyToAccount(process.env.AGENT_EVM_KEY as `0x${string}`);
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const signature = await account.signMessage({ message: signingMessage("GET", url.pathname + url.search, ts, nonce) });
  Object.assign(headers, { "X-Agent-ENS": agentName, "X-Agent-Signature": signature, "X-Agent-Timestamp": ts, "X-Agent-Nonce": nonce });
  console.log("[agent] signed as", agentName, account.address);
}
const res = await payFetch(url, { headers });
console.log("[agent] status", res.status);
const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
if (pr) {
  const settle = decodePaymentResponseHeader(pr);
  console.log("[agent] settled tx", settle.transaction, `https://hashscan.io/testnet/transaction/${settle.transaction}`);
}
console.log("[agent] body", await res.text());
