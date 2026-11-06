// Generates fresh TESTNET-ONLY secp256k1 keys into .env (only fills empty vars).
// Prints addresses, never private keys.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ENV = ".env";
if (!existsSync(ENV)) copyFileSync(".env.example", ENV);
let text = readFileSync(ENV, "utf8");

function get(name: string): string {
  const m = text.match(new RegExp(`^${name}=([^\\s#]*)`, "m"));
  return m ? m[1] : "";
}
function set(name: string, value: string) {
  const re = new RegExp(`^${name}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${name}=${value}`) : `${text}\n${name}=${value}\n`;
}
function ensureKey(name: string): `0x${string}` {
  let k = get(name);
  if (!k) {
    k = generatePrivateKey();
    set(name, k);
  }
  return k as `0x${string}`;
}

const merchant = ensureKey("HEDERA_OPERATOR_KEY"); // Hedera ECDSA operator / merchant
const agentHedera = ensureKey("AGENT_HEDERA_KEY"); // Hedera ECDSA agent payer
const deployer = ensureKey("ENS_DEPLOYER_KEY"); // Sepolia parent-name owner (human)
const agentEvm = ensureKey("AGENT_EVM_KEY"); // agent ENS signing key
if (!get("WORLD_HUMAN_SALT")) set("WORLD_HUMAN_SALT", generatePrivateKey().slice(2));
writeFileSync(ENV, text);

console.log("Hedera operator/merchant EVM alias:", privateKeyToAccount(merchant).address);
console.log("Hedera agent payer EVM alias:      ", privateKeyToAccount(agentHedera).address);
console.log("Sepolia ENS deployer (human):      ", privateKeyToAccount(deployer).address);
console.log("Agent ENS signing address:         ", privateKeyToAccount(agentEvm).address);
console.log("\nFund the Hedera operator alias at https://portal.hedera.com/faucet (testnet),");
console.log("and the Sepolia deployer with Sepolia ETH. Then run: pnpm hedera:setup");
