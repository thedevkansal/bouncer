// ENSv2 Sepolia setup (idempotent, resumable via .env):
//   <parent>.eth            registered via ETHRegistrar, subregistry = R1 (our PermissionedRegistry)
//   dev.<parent>.eth        in R1, subregistry = R2 (the human's agent namespace)
//   research.dev.<parent>   in R2: owner = agent key, roleBitmap 0 (non-transferable, can't swap
//                           resolver), expiry 24h, its own PermissionedResolver with policy records.
import { encodeFunctionData, keccak256, toHex, parseEventLogs, zeroAddress, type Hex } from "viem";
import { packetToBytes } from "viem/ens";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { need, saveEnv } from "./lib/env.js";
import {
  ALL_ROLES, ETHRegistrar, MockUSDC, PermissionedResolverImpl, RROLE, UserRegistryImpl, VerifiableFactory, clients,
} from "./lib/ens.js";

const { account, pub, wallet } = clients(need("ENS_DEPLOYER_KEY") as Hex);
const agentAddr = privateKeyToAccount(need("AGENT_EVM_KEY") as Hex).address;
const dns = (name: string) => toHex(packetToBytes(name));

async function send(label: string, req: Parameters<typeof wallet.writeContract>[0]) {
  let request;
  try {
    ({ request } = await pub.simulateContract({ ...(req as any), account }));
  } catch (e: any) {
    const d = e?.cause?.data ?? e?.walk?.((x: any) => x?.data)?.data;
    console.error(`  ✗ ${label}: ${e.shortMessage ?? e.message}`, d?.errorName ?? "", d?.args ?? "");
    process.exit(1);
  }
  const hash = await wallet.writeContract(request as any);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ✓ ${label}  https://sepolia.etherscan.io/tx/${hash}`);
  return rcpt;
}

async function deployProxy(label: string, impl: Hex, initData: Hex): Promise<Hex> {
  const salt = BigInt(keccak256(toHex(randomBytes(32))));
  const rcpt = await send(label, {
    address: VerifiableFactory.address, abi: VerifiableFactory.abi, functionName: "deployProxy", args: [impl, salt, initData],
  } as any);
  const [ev] = parseEventLogs({ abi: VerifiableFactory.abi, logs: rcpt.logs, eventName: "ProxyDeployed" }) as any[];
  return ev.args.proxyAddress as Hex;
}

const newRegistry = (label: string) =>
  deployProxy(label, UserRegistryImpl.address, encodeFunctionData({
    abi: UserRegistryImpl.abi, functionName: "initialize", args: [[{ account: account.address, roleBitmap: ALL_ROLES }]],
  }));

const newResolver = (label: string, extraCalls: Hex[] = []) =>
  deployProxy(label, PermissionedResolverImpl.address, encodeFunctionData({
    abi: PermissionedResolverImpl.abi, functionName: "initialize",
    args: [[{ account: account.address, roleBitmap: ALL_ROLES }], extraCalls],
  }));

console.log("deployer (human):", account.address, "agent key:", agentAddr);

// ---- 1. parent .eth name ----
let parent = (process.env.ENS_PARENT_NAME || "").replace(/\.eth$/, "");
let R1 = process.env.ENS_REGISTRY_PARENT as Hex | undefined;
if (!process.env.ENS_PARENT_REGISTERED) {
  const candidates = [parent, "bouncer", "bouncer-agents", `bouncer-${account.address.slice(2, 8).toLowerCase()}`].filter(Boolean);
  let chosen = "";
  for (const c of candidates) {
    if (await pub.readContract({ address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "isAvailable", args: [c] })) { chosen = c; break; }
    console.log(`  ${c}.eth not available`);
  }
  if (!chosen) throw new Error("no parent label available");
  parent = chosen;
  saveEnv("ENS_PARENT_NAME", `${parent}.eth`);

  if (!R1) { R1 = await newRegistry(`registry for *.${parent}.eth`); saveEnv("ENS_REGISTRY_PARENT", R1); }
  const parentResolver = await newResolver(`resolver for ${parent}.eth`);

  const duration = (await pub.readContract({ address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "MIN_REGISTER_DURATION" })) as bigint;
  const dur = duration > 31_536_000n ? duration : 31_536_000n;
  const [base, premium] = (await pub.readContract({
    address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "getRegisterPrice", args: [parent, dur, MockUSDC.address],
  })) as [bigint, bigint];
  const price = base + premium;
  console.log(`  price for ${parent}.eth: ${price} MockUSDC units`);
  await send("mint MockUSDC", { address: MockUSDC.address, abi: MockUSDC.abi, functionName: "mint", args: [account.address, price * 2n] } as any);
  await send("approve registrar", { address: MockUSDC.address, abi: MockUSDC.abi, functionName: "approve", args: [ETHRegistrar.address, price * 2n] } as any);

  const secret = keccak256(toHex(randomBytes(32)));
  const zero32 = `0x${"0".repeat(64)}` as Hex;
  const commitment = (await pub.readContract({
    address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "makeCommitment",
    args: [parent, account.address, secret, R1, parentResolver, dur, zero32],
  })) as Hex;
  await send("commit", { address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "commit", args: [commitment] } as any);
  const minAge = (await pub.readContract({ address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "MIN_COMMITMENT_AGE" })) as bigint;
  console.log(`  waiting ${minAge}s commitment age…`);
  await new Promise((r) => setTimeout(r, (Number(minAge) + 15) * 1000));
  await send(`register ${parent}.eth`, {
    address: ETHRegistrar.address, abi: ETHRegistrar.abi, functionName: "register",
    args: [parent, account.address, secret, R1, parentResolver, dur, MockUSDC.address, zero32],
  } as any);
  saveEnv("ENS_PARENT_REGISTERED", "1");
}
R1 = process.env.ENS_REGISTRY_PARENT as Hex;
const parentName = `${parent}.eth`;

// ---- 2. human namespace: dev.<parent> with its own registry R2 ----
const humanLabel = process.env.ENS_HUMAN_LABEL || "dev";
let R2 = process.env.ENS_REGISTRY_HUMAN as Hex | undefined;
if (!R2) {
  R2 = await newRegistry(`registry for *.${humanLabel}.${parentName}`);
  const humanResolver = await newResolver(`resolver for ${humanLabel}.${parentName}`);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
  await send(`register ${humanLabel}.${parentName}`, {
    address: R1, abi: UserRegistryImpl.abi, functionName: "register",
    args: [humanLabel, account.address, R2, humanResolver, 0n, expiry],
  } as any);
  saveEnv("ENS_REGISTRY_HUMAN", R2);
}

// ---- 3. agent subname: research.dev.<parent> ----
const agentLabel = (process.env.AGENT_ENS_NAME || "research").split(".")[0];
const agentName = `${agentLabel}.${humanLabel}.${parentName}`;
saveEnv("AGENT_ENS_NAME", agentName);
if (!process.env.AGENT_RESOLVER) {
  const n = dns(agentName);
  const policy: Record<string, string> = {
    "bouncer.maxSpendPerDay": "5",
    "bouncer.rateLimitPerMin": "60",
    "bouncer.allowedPaths": "/premium/research,/premium/dataset",
    "bouncer.stepUpAbove": "0.10",
    "bouncer.status": "active",
    "agent-context": "Bouncer research agent: buys research answers over x402 on Hedera on behalf of its human.",
    "agent-endpoint[web]": process.env.API_PUBLIC_URL || "http://localhost:4000",
  };
  const calls: Hex[] = [
    encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setAddress", args: [n, 60n, agentAddr] }),
    ...Object.entries(policy).map(([k, v]) =>
      encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setText", args: [n, k, v] })),
  ];
  const resolver = await newResolver(`resolver for ${agentName} (+policy records)`, calls);
  // EAC: agent key may set ONLY the "bouncer.status" text key — never its own policy.
  await send("grant agent ROLE_SET_TEXT on bouncer.status only", {
    address: resolver, abi: PermissionedResolverImpl.abi, functionName: "grantSetterRoles",
    args: [encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setText", args: [n, "bouncer.status", ""] }), agentAddr],
  } as any);
  saveEnv("AGENT_RESOLVER", resolver);
}
if (!process.env.AGENT_REGISTERED) {
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600); // 24h, renewable
  // roleBitmap 0: agent owns the token but holds no roles → cannot transfer, cannot swap resolver.
  await send(`register ${agentName} (24h, non-transferable)`, {
    address: R2, abi: UserRegistryImpl.abi, functionName: "register",
    args: [agentLabel, agentAddr, zeroAddress, process.env.AGENT_RESOLVER as Hex, 0n, expiry],
  } as any);
  saveEnv("AGENT_REGISTERED", "1");
}

// ---- verify live resolution ----
const addr = await pub.getEnsAddress({ name: agentName, universalResolverAddress: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe" }).catch((e) => `ERR ${e.shortMessage ?? e.message}`);
const cap = await pub.getEnsText({ name: agentName, key: "bouncer.maxSpendPerDay", universalResolverAddress: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe" }).catch((e) => `ERR ${e.shortMessage ?? e.message}`);
console.log(`\n${agentName} → addr ${addr}  (expected ${agentAddr}); maxSpendPerDay=${cap}`);
