// ENSv2 agent management (Sepolia):
//   ens-agent.ts eac-test [name]        agent key tries to raise its own spend cap → EAC rejects onchain
//                                       agent key sets bouncer.status heartbeat → allowed
//   ens-agent.ts revoke <label>         human unregisters <label>.dev.<parent> in the registry
//   ens-agent.ts issue <label> [--key-env VAR]   issue a new agent subname with its own resolver + policy
import { decodeErrorResult, encodeFunctionData, keccak256, labelhash, parseEther, parseEventLogs, toHex, zeroAddress, type Hex } from "viem";
import { packetToBytes } from "viem/ens";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { need, saveEnv } from "./lib/env.js";
import { ALL_ROLES, PermissionedResolverImpl, UserRegistryImpl, VerifiableFactory, clients } from "./lib/ens.js";

const [cmd, arg] = process.argv.slice(2);
const human = clients(need("ENS_DEPLOYER_KEY") as Hex);
const parent = need("ENS_PARENT_NAME");
const humanLabel = process.env.ENS_HUMAN_LABEL || "dev";
const R2 = need("ENS_REGISTRY_HUMAN") as Hex;
const dns = (n: string) => toHex(packetToBytes(n));
const tx = (h: Hex) => `https://sepolia.etherscan.io/tx/${h}`;

async function send(c: ReturnType<typeof clients>, label: string, req: any) {
  const { request } = await c.pub.simulateContract({ ...req, account: c.account });
  const hash = await c.wallet.writeContract(request as any);
  await c.pub.waitForTransactionReceipt({ hash });
  console.log(`  ✓ ${label}  ${tx(hash)}`);
  return hash;
}

if (cmd === "eac-test") {
  const name = arg || need("AGENT_ENS_NAME");
  const agent = clients(need("AGENT_EVM_KEY") as Hex);
  const resolver = (await human.pub.readContract({ address: R2, abi: UserRegistryImpl.abi, functionName: "getResolver", args: [name.split(".")[0]] })) as Hex;
  // Agent needs a little Sepolia gas to send its own txs.
  const bal = await human.pub.getBalance({ address: agent.account.address });
  if (bal < parseEther("0.0005")) {
    const h = await human.wallet.sendTransaction({ to: agent.account.address, value: parseEther("0.001") });
    await human.pub.waitForTransactionReceipt({ hash: h });
  }
  console.log(`agent ${agent.account.address} tries to raise its own cap on ${name} (resolver ${resolver})`);
  // 1) Policy edit — must be rejected by Enhanced Access Control.
  try {
    const gas = await agent.pub.estimateGas({
      account: agent.account,
      to: resolver,
      data: encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setText", args: [dns(name), "bouncer.maxSpendPerDay", "1000000"] }),
    });
    // Should never get here; if it does, send it so the failure is visible.
    console.log("  ✗ UNEXPECTED: EAC allowed policy edit (gas", gas, ")");
  } catch (e: any) {
    const data = (e?.walk?.((x: any) => typeof x?.data === "string")?.data ?? "") as Hex;
    let decoded = "";
    try {
      decoded = decodeErrorResult({ abi: PermissionedResolverImpl.abi, data }).errorName;
    } catch {}
    console.log(`  ✓ EAC rejected agent's setText("bouncer.maxSpendPerDay"): ${decoded || e.shortMessage}`);
  }
  // 2) Heartbeat — allowed (agent holds ROLE_SET_TEXT only on resource keccak256("bouncer.status")).
  await send(agent, "agent sets bouncer.status heartbeat (allowed)", {
    address: resolver, abi: PermissionedResolverImpl.abi, functionName: "setText", args: [dns(name), "bouncer.status", `active@${new Date().toISOString()}`],
  });
} else if (cmd === "revoke") {
  const label = arg || need("AGENT_ENS_NAME").split(".")[0];
  await send(human, `revoke ${label}.${humanLabel}.${parent} (registry unregister)`, {
    address: R2, abi: UserRegistryImpl.abi, functionName: "unregister", args: [BigInt(labelhash(label))],
  });
} else if (cmd === "issue") {
  const label = arg;
  if (!label) throw new Error("usage: issue <label>");
  const keyEnv = process.argv.includes("--key-env") ? process.argv[process.argv.indexOf("--key-env") + 1] : `AGENT_${label.toUpperCase()}_KEY`;
  let key = process.env[keyEnv] as Hex | undefined;
  if (!key) {
    key = generatePrivateKey();
    saveEnv(keyEnv, key);
  }
  const addr = privateKeyToAccount(key).address;
  const name = `${label}.${humanLabel}.${parent}`;
  const n = dns(name);
  const policy: Record<string, string> = {
    "bouncer.maxSpendPerDay": "5",
    "bouncer.rateLimitPerMin": "60",
    "bouncer.allowedPaths": "/premium/research,/premium/dataset",
    "bouncer.stepUpAbove": "0.10",
    "bouncer.status": "active",
    "agent-context": `Bouncer agent ${label}, operated by ${humanLabel}.${parent}`,
  };
  const calls = [
    encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setAddress", args: [n, 60n, addr] }),
    ...Object.entries(policy).map(([k, v]) => encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setText", args: [n, k, v] })),
  ];
  const init = encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "initialize", args: [[{ account: human.account.address, roleBitmap: ALL_ROLES }], calls] });
  const { request } = await human.pub.simulateContract({
    account: human.account, address: VerifiableFactory.address, abi: VerifiableFactory.abi, functionName: "deployProxy",
    args: [PermissionedResolverImpl.address, BigInt(keccak256(toHex(randomBytes(32)))), init],
  });
  const h = await human.wallet.writeContract(request as any);
  const rcpt = await human.pub.waitForTransactionReceipt({ hash: h });
  const [ev] = parseEventLogs({ abi: VerifiableFactory.abi, logs: rcpt.logs, eventName: "ProxyDeployed" }) as any[];
  const resolver = ev.args.proxyAddress as Hex;
  console.log(`  ✓ resolver for ${name} ${resolver}  ${tx(h)}`);
  await send(human, "grant agent ROLE_SET_TEXT on bouncer.status only", {
    address: resolver, abi: PermissionedResolverImpl.abi, functionName: "grantSetterRoles",
    args: [encodeFunctionData({ abi: PermissionedResolverImpl.abi, functionName: "setText", args: [n, "bouncer.status", ""] }), addr],
  });
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  await send(human, `register ${name} (24h, non-transferable)`, {
    address: R2, abi: UserRegistryImpl.abi, functionName: "register", args: [label, addr, zeroAddress, resolver, 0n, expiry],
  });
  console.log(`${name} → ${addr} (key in .env as ${keyEnv})`);
} else {
  console.log("usage: ens-agent.ts eac-test|revoke|issue ...");
}
process.exit(0);
