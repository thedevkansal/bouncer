// Reusable autonomous agent client: discovers the API, signs every request with the
// key its ENSv2 name resolves to, pays x402 (Hedera) automatically, and handles
// World step-up by waiting for its human — never paying unless approved.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { PrivateKey } from "@hiero-ledger/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { signingMessage } from "@bouncer/middleware";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

export const API = process.env.AGENT_API_URL || process.env.API_PUBLIC_URL || "http://localhost:4000";

export interface AgentOpts {
  ensName?: string; // omit for an anonymous / unverified agent
  evmKey?: `0x${string}`;
  hederaId?: string;
  hederaKey?: string;
  label?: string;
}

export interface CallResult {
  status: number;
  body: any;
  tx?: string;
  hashscan?: string;
}

export function makeAgent(o: AgentOpts) {
  const hederaId = o.hederaId ?? process.env.AGENT_HEDERA_ID!;
  const hederaKey = o.hederaKey ?? process.env.AGENT_HEDERA_KEY!;
  const signer = createClientHederaSigner(hederaId, PrivateKey.fromStringECDSA(hederaKey), { network: "hedera:testnet" });
  // Agent-side spend control: HBAR only, capped per payment.
  const client = new x402Client()
    .register("hedera:*", new ExactHederaScheme(signer))
    .setSpendControls({
      allowedAssets: [{ network: "hedera:testnet", asset: "0.0.0", maxAmountPerPayment: process.env.AGENT_MAX_TINYBARS_PER_PAYMENT || "1500000000" }],
    });
  const payFetch = wrapFetchWithPayment(fetch, client);
  const account = o.evmKey ? privateKeyToAccount(o.evmKey) : null;
  const label = o.label ?? o.ensName ?? "anon";

  async function headersFor(url: URL, extra: Record<string, string> = {}) {
    const h: Record<string, string> = { "X-Agent-Id": label, ...extra };
    if (o.ensName && account) {
      const ts = Math.floor(Date.now() / 1000).toString();
      const nonce = randomUUID();
      h["X-Agent-ENS"] = o.ensName;
      h["X-Agent-Timestamp"] = ts;
      h["X-Agent-Nonce"] = nonce;
      h["X-Agent-Signature"] = await account.signMessage({ message: signingMessage("GET", url.pathname + url.search, ts, nonce) });
    }
    return h;
  }

  async function once(url: URL, extra?: Record<string, string>): Promise<CallResult> {
    const res = await payFetch(url, { headers: await headersFor(url, extra) });
    const pr = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
    const tx = pr ? decodePaymentResponseHeader(pr).transaction : undefined;
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: res.status, body, tx, hashscan: tx ? `https://hashscan.io/testnet/transaction/${tx}` : undefined };
  }

  return {
    label,
    async discover() {
      return (await (await fetch(`${API}/.well-known/bouncer.json`)).json()) as {
        endpoints: { method: string; url: string; priceUsd: { humanBacked: number; unverified: number } }[];
      };
    },
    /** GET a protected path. On step_up_required, waits for the human (onChallenge prints the link). */
    async get(p: string, opts: { onChallenge?: (c: any) => void; stepUpTimeoutMs?: number } = {}): Promise<CallResult> {
      const url = new URL(p, API);
      let r = await once(url);
      if (r.status === 403 && r.body?.error === "step_up_required" && r.body.challenge) {
        const c = r.body.challenge;
        opts.onChallenge?.(c);
        const deadline = Date.now() + (opts.stepUpTimeoutMs ?? 11 * 60_000);
        let status = c.status;
        while (status === "pending" && Date.now() < deadline) {
          await new Promise((res) => setTimeout(res, 2000));
          status = ((await (await fetch(`${API}/world/challenge/${c.id}`)).json()) as any).status;
        }
        // Retry with the challenge id; the server decides (approved → 402 → pay; else 403, nothing paid).
        r = await once(url, { "X-Stepup-Challenge": c.id });
      }
      return r;
    },
  };
}

export function agentFromEnv() {
  return makeAgent({
    ensName: process.argv.includes("--anon") ? undefined : process.env.AGENT_ENS_NAME,
    evmKey: process.env.AGENT_EVM_KEY as `0x${string}`,
  });
}
