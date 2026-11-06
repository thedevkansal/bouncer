// ENSv2 identity, policy and revocation (Sepolia), all resolved live:
//  a. resolve X-Agent-ENS → address via the Universal Resolver; verify the request
//     signature against it; reject replayed nonces and timestamps older than 60s.
//  b. read policy text records from the agent's PermissionedResolver; walk the
//     PermissionedRegistry hierarchy and 403 if any label is unregistered/expired.
// Results cached at most POLICY_CACHE_MS (default 10s) so revocation shows up fast.
import { createPublicClient, fallback, http, labelhash, parseAbi, verifyMessage, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { IdentityError, type AgentIdentity } from "./index.js";
import type { BouncerRequest } from "./types.js";

export const SIG_VERSION = "bouncer:v1";

/** The exact bytes an agent signs (EIP-191 personal_sign). */
export function signingMessage(method: string, pathWithQuery: string, timestamp: string, nonce: string) {
  return `${SIG_VERSION}\n${method.toUpperCase()}\n${pathWithQuery}\n${timestamp}\n${nonce}`;
}

export const POLICY_KEYS = {
  maxSpendPerDay: "bouncer.maxSpendPerDay",
  rateLimitPerMin: "bouncer.rateLimitPerMin",
  allowedPaths: "bouncer.allowedPaths",
  stepUpAbove: "bouncer.stepUpAbove",
  status: "bouncer.status",
  context: "agent-context", // ENSIP-26
} as const;

const registryAbi = parseAbi([
  "function getSubregistry(string label) view returns (address)",
  "function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))",
]);

export interface EnsConfig {
  rpcUrl?: string;
  universalResolver: Address; // ENSv2 UR proxy on Sepolia
  ethRegistry: Address; // ENSv2 .eth PermissionedRegistry
  cacheMs: number;
  maxSkewSec: number; // 60
}

export interface EnsRecord {
  name: string;
  address: Address | null;
  registered: boolean;
  expiry: number; // unix seconds of the agent label
  reason?: string;
  policy: NonNullable<AgentIdentity["policy"]>;
  status?: string;
  context?: string;
  fetchedAt: number;
}

export function createEns(cfg: EnsConfig) {
  const client = createPublicClient({
    chain: sepolia,
    transport: fallback([
      http(cfg.rpcUrl || "https://ethereum-sepolia-rpc.publicnode.com", { retryCount: 2, timeout: 8000 }),
      http("https://sepolia.drpc.org", { retryCount: 1, timeout: 8000 }),
      http("https://1rpc.io/sepolia", { retryCount: 1, timeout: 8000 }),
      http("https://ethereum-sepolia.rpc.subquery.network/public", { retryCount: 1, timeout: 8000 }),
    ]),
    batch: { multicall: true },
  });
  const cache = new Map<string, EnsRecord>();
  const nonces = new Map<string, { at: number; paidRetry: boolean }>();

  /** Walks ETHRegistry → our PermissionedRegistries; every label must be REGISTERED (2) and unexpired. */
  async function registryStatus(name: string) {
    const labels = name.split(".").reverse(); // ["eth", "bouncer", "dev", "research"]
    if (labels[0] !== "eth") return { registered: false, expiry: 0, reason: "not a .eth name" };
    let registry: Address = cfg.ethRegistry;
    const now = Math.floor(Date.now() / 1000);
    let expiry = 0;
    for (let i = 1; i < labels.length; i++) {
      const label = labels[i];
      const st = await client.readContract({ address: registry, abi: registryAbi, functionName: "getState", args: [BigInt(labelhash(label))] });
      expiry = Number(st.expiry);
      if (st.status !== 2 || expiry <= now) {
        return { registered: false, expiry, reason: `${labels.slice(1, i + 1).reverse().join(".")}.eth is ${st.status === 2 ? "expired" : "unregistered (revoked)"}` };
      }
      if (i < labels.length - 1) {
        registry = await client.readContract({ address: registry, abi: registryAbi, functionName: "getSubregistry", args: [label] });
        if (/^0x0{40}$/i.test(registry)) return { registered: false, expiry, reason: `no subregistry under ${label}` };
      }
    }
    return { registered: true, expiry };
  }

  async function lookup(rawName: string, fresh = false): Promise<EnsRecord> {
    const name = normalize(rawName);
    const hit = cache.get(name);
    if (!fresh && hit && Date.now() - hit.fetchedAt < cfg.cacheMs) return hit;
    try {
      return await fetchRecord(name);
    } catch (e) {
      // RPC outage: reuse the last good read for up to 60s (logged), else fail closed with 503.
      if (hit && Date.now() - hit.fetchedAt < 60_000) {
        console.warn(`[ens] RPC error, serving ${Math.round((Date.now() - hit.fetchedAt) / 1000)}s-old record for ${name}`);
        return hit;
      }
      throw new IdentityError(503, "rejected_identity", `ENS lookup unavailable (Sepolia RPC): ${(e as Error).message.split("\n")[0]}`);
    }
  }

  async function fetchRecord(name: string): Promise<EnsRecord> {
    const ur = { universalResolverAddress: cfg.universalResolver };
    const text = (key: string) => client.getEnsText({ name, key, ...ur }).catch(() => null);
    const [reg, address, maxSpend, rate, paths, stepUp, status, context] = await Promise.all([
      registryStatus(name),
      client.getEnsAddress({ name, ...ur }).catch(() => null),
      text(POLICY_KEYS.maxSpendPerDay),
      text(POLICY_KEYS.rateLimitPerMin),
      text(POLICY_KEYS.allowedPaths),
      text(POLICY_KEYS.stepUpAbove),
      text(POLICY_KEYS.status),
      text(POLICY_KEYS.context),
    ]);
    const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    const rec: EnsRecord = {
      name,
      address: address as Address | null,
      registered: reg.registered,
      expiry: reg.expiry,
      reason: reg.reason,
      policy: {
        maxSpendPerDayUsd: num(maxSpend),
        rateLimitPerMin: num(rate),
        allowedPaths: paths ? paths.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        stepUpAboveUsd: num(stepUp),
      },
      status: status ?? undefined,
      context: context ?? undefined,
      fetchedAt: Date.now(),
    };
    cache.set(name, rec);
    return rec;
  }

  /** a + b as a Bouncer identify hook. Returns null when the request carries no ENS identity. */
  async function identify(req: BouncerRequest): Promise<AgentIdentity | null> {
    const name = req.header("x-agent-ens");
    if (!name) return null;
    const sig = req.header("x-agent-signature") as Hex | undefined;
    const ts = req.header("x-agent-timestamp") ?? "";
    const nonce = req.header("x-agent-nonce") ?? "";
    if (!sig || !ts || !nonce) throw new IdentityError(401, "rejected_identity", "missing X-Agent-Signature / X-Agent-Timestamp / X-Agent-Nonce");

    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > cfg.maxSkewSec) throw new IdentityError(401, "rejected_identity", `timestamp outside ${cfg.maxSkewSec}s window`);

    const rec = await lookup(name);
    if (!rec.registered) throw new IdentityError(403, "revoked", rec.reason ?? "agent name not registered");
    if (!rec.address) throw new IdentityError(401, "rejected_identity", `${name} does not resolve to an address`);

    const ok = await verifyMessage({ address: rec.address, message: signingMessage(req.method, req.originalUrl, ts, nonce), signature: sig }).catch(() => false);
    if (!ok) throw new IdentityError(401, "rejected_identity", `signature does not match ${name} → ${rec.address}`);

    // Replay protection. A nonce may be reused exactly once, by the x402 paid retry
    // of the same request (the x402 client resends identical headers + a payment header).
    const key = `${rec.name}:${nonce}`;
    const seen = nonces.get(key);
    const paying = Boolean(req.header("payment-signature") || req.header("x-payment"));
    if (seen) {
      if (!paying || seen.paidRetry) throw new IdentityError(401, "rejected_identity", "replayed nonce");
      seen.paidRetry = true;
    } else {
      nonces.set(key, { at: Date.now(), paidRetry: paying });
    }
    for (const [k, v] of nonces) if (Date.now() - v.at > 2 * cfg.maxSkewSec * 1000) nonces.delete(k);

    return { agent: rec.name, ensVerified: true, policy: rec.policy };
  }

  return { identify, lookup, client, invalidate: (name: string) => cache.delete(normalize(name)) };
}

export type Ens = ReturnType<typeof createEns>;
