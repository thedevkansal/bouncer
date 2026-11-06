import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { BouncerConfig, Network } from "@bouncer/middleware";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const num = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);

export function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

export const PORT = num("PORT", 4000);
export const PUBLIC_URL = process.env.API_PUBLIC_URL || `http://localhost:${PORT}`;

export const bouncerConfig: BouncerConfig = {
  routes: [
    {
      route: "GET /premium/research",
      verifiedUsd: num("PRICE_VERIFIED_USD", 0.001),
      unverifiedUsd: num("PRICE_UNVERIFIED_USD", 0.02),
      description: "Research answer (cheap, autonomous)",
    },
    {
      route: "GET /premium/dataset",
      verifiedUsd: num("PRICE_DATASET_USD", 0.5),
      unverifiedUsd: num("PRICE_DATASET_UNVERIFIED_USD", 5),
      description: "Full dataset export (above step-up threshold)",
    },
  ],
  hedera: {
    network: (process.env.HEDERA_NETWORK || "hedera:testnet") as Network,
    payTo: process.env.HEDERA_PAY_TO || need("HEDERA_OPERATOR_ID"),
    asset: process.env.HEDERA_ASSET || "0.0.0",
    assetDecimals: num("HEDERA_ASSET_DECIMALS", 8),
    hbarUsd: num("HBAR_USD", 0.05),
    facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://api.testnet.blocky402.com",
  },
  rateLimits: {
    verifiedPerHumanPerMin: num("VERIFIED_PER_HUMAN_PER_MIN", 60),
    unverifiedMinIntervalSec: num("UNVERIFIED_MIN_INTERVAL_SEC", 10),
  },
};
