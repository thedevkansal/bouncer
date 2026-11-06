// Walks the ENSv2 hierarchy for AGENT_ENS_NAME hop by hop and compares with Universal Resolver.
import { encodeFunctionData, decodeFunctionResult, namehash, toHex, parseAbi, type Hex } from "viem";
import { packetToBytes } from "viem/ens";
import { need } from "./lib/env.js";
import { clients, ETHRegistry, UserRegistryImpl, PermissionedResolverImpl } from "./lib/ens.js";

const { pub } = clients(need("ENS_DEPLOYER_KEY") as Hex);
const name = need("AGENT_ENS_NAME");
const labels = name.split(".").reverse(); // eth, bouncer, dev, research
let registry: Hex = ETHRegistry.address;
let resolver: Hex | null = null;
for (const label of labels.slice(1)) {
  const sub = (await pub.readContract({ address: registry, abi: UserRegistryImpl.abi, functionName: "getSubregistry", args: [label] })) as Hex;
  const res = (await pub.readContract({ address: registry, abi: UserRegistryImpl.abi, functionName: "getResolver", args: [label] })) as Hex;
  const owner = await pub.readContract({ address: registry, abi: UserRegistryImpl.abi, functionName: "findOwner", args: [label] });
  console.log(`${label} @ ${registry}: owner=${owner} resolver=${res} subregistry=${sub}`);
  if (res !== "0x0000000000000000000000000000000000000000") resolver = res;
  registry = sub;
}
const addrAbi = parseAbi(["function addr(bytes32) view returns (address)", "function text(bytes32,string) view returns (string)"]);
const data = encodeFunctionData({ abi: addrAbi, functionName: "addr", args: [namehash(name)] });
const raw = (await pub.readContract({ address: resolver!, abi: PermissionedResolverImpl.abi, functionName: "resolve", args: [toHex(packetToBytes(name)), data] })) as Hex;
console.log("direct resolver.resolve addr:", decodeFunctionResult({ abi: addrAbi, functionName: "addr", data: raw }));
for (const ur of ["0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe", "0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1"] as Hex[]) {
  const a = await pub.getEnsAddress({ name, universalResolverAddress: ur }).catch((e) => `ERR ${e.shortMessage}`);
  console.log(`UR ${ur.slice(0, 8)} addr:`, a);
}
