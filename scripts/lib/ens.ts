// Shared ENSv2 (Sepolia) helpers. Addresses from docs.ens.domains/learn/deployments
// (contracts-v2 @ 07e55a05); ABIs in packages/contracts/abis.
import { createPublicClient, createWalletClient, http, fallback, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const load = (n: string) => require(`../../packages/contracts/abis/${n}.json`) as { address: Hex; abi: any[] };

export const ETHRegistrar = load("ETHRegistrar");
export const ETHRegistry = load("ETHRegistry");
export const VerifiableFactory = load("VerifiableFactory");
export const UserRegistryImpl = load("UserRegistryImpl");
export const PermissionedResolverImpl = load("PermissionedResolverImpl");
export const MockUSDC = load("MockUSDC");

// RegistryRolesLib (contracts-v2)
export const ROLE = {
  REGISTRAR: 1n << 0n,
  REGISTER_RESERVED: 1n << 4n,
  SET_PARENT: 1n << 8n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
  CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
};
// PermissionedResolverLib
export const RROLE = { SET_ADDRESS: 1n << 0n, SET_TEXT: 1n << 4n };
/** Every regular + admin role nybble set (docs: ALL_ROLES 0x1111…1111). */
export const ALL_ROLES = BigInt("0x" + "1".repeat(64));

export function rpcTransport() {
  return fallback([
    http(process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com", { retryCount: 3 }),
    http("https://sepolia.drpc.org", { retryCount: 2 }),
  ]);
}

export function clients(pk: Hex) {
  const account = privateKeyToAccount(pk);
  const pub = createPublicClient({ chain: sepolia, transport: rpcTransport() });
  const wallet = createWalletClient({ chain: sepolia, transport: rpcTransport(), account });
  return { account, pub, wallet };
}
