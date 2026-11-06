// Hedera testnet setup (idempotent):
//  1. Resolve operator account id from its ECDSA EVM alias (funded via portal faucet).
//  2. Create the agent payer account by sending HBAR to its EVM alias (auto account creation).
//  3. Create the HCS audit topic.
import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TopicCreateTransaction,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { need, saveEnv } from "./lib/env.js";

const MIRROR = process.env.HEDERA_MIRROR_URL || "https://testnet.mirrornode.hedera.com";

async function accountIdForAlias(evm: string): Promise<string | null> {
  const r = await fetch(`${MIRROR}/api/v1/accounts/${evm}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { account?: string };
  return j.account ?? null;
}

async function waitForAccount(evm: string, tries = 20): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const id = await accountIdForAlias(evm);
    if (id) return id;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`No Hedera account for ${evm} yet. Fund it at https://portal.hedera.com/faucet`);
}

const opKeyHex = need("HEDERA_OPERATOR_KEY");
const opEvm = privateKeyToAccount(opKeyHex as `0x${string}`).address;
const opId = process.env.HEDERA_OPERATOR_ID?.startsWith("0.0.") && !process.env.HEDERA_OPERATOR_ID.includes("x")
  ? process.env.HEDERA_OPERATOR_ID
  : await waitForAccount(opEvm, 1);
saveEnv("HEDERA_OPERATOR_ID", opId);
if (!process.env.HEDERA_PAY_TO) saveEnv("HEDERA_PAY_TO", opId);
console.log("operator/merchant:", opId);

const client = Client.forTestnet().setOperator(AccountId.fromString(opId), PrivateKey.fromStringECDSA(opKeyHex));

// Agent payer account
const agentKeyHex = need("AGENT_HEDERA_KEY");
const agentEvm = privateKeyToAccount(agentKeyHex as `0x${string}`).address;
let agentId = await accountIdForAlias(agentEvm);
if (!agentId) {
  console.log("creating agent account via alias transfer…");
  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(opId), new Hbar(-20))
    .addHbarTransfer(AccountId.fromEvmAddress(0, 0, agentEvm), new Hbar(20))
    .execute(client);
  await tx.getReceipt(client);
  agentId = await waitForAccount(agentEvm);
}
saveEnv("AGENT_HEDERA_ID", agentId);
console.log("agent payer:", agentId);

// An alias-created account is "hollow" (no key on ledger) until it pays for a tx itself.
// x402 facilitators verify the payer's signature against the ledger key, so complete it.
const info = (await (await fetch(`${MIRROR}/api/v1/accounts/${agentId}`)).json()) as { key: unknown };
if (!info.key) {
  console.log("completing hollow agent account (agent pays its own tx)…");
  const agentClient = Client.forTestnet().setOperator(AccountId.fromString(agentId), PrivateKey.fromStringECDSA(agentKeyHex));
  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(agentId), Hbar.fromTinybars(-1))
    .addHbarTransfer(AccountId.fromString(opId), Hbar.fromTinybars(1))
    .execute(agentClient);
  await tx.getReceipt(agentClient);
  agentClient.close();
}

// HCS audit topic
if (!process.env.HCS_TOPIC_ID) {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Bouncer agent spending audit log")
    .setSubmitKey(PrivateKey.fromStringECDSA(opKeyHex).publicKey)
    .execute(client);
  const receipt = await tx.getReceipt(client);
  saveEnv("HCS_TOPIC_ID", receipt.topicId!.toString());
}
console.log("HCS topic:", process.env.HCS_TOPIC_ID);
client.close();
