import type { Request } from "express";

export type Network = `${string}:${string}`;

export interface RoutePrice {
  /** e.g. "GET /premium/research" */
  route: string;
  /** Base price in USD for a human-backed agent. */
  verifiedUsd: number;
  /** Surge price in USD for an unverified agent. */
  unverifiedUsd: number;
  description: string;
}

export interface BouncerConfig {
  routes: RoutePrice[];
  hedera: {
    network: Network; // "hedera:testnet"
    payTo: string; // 0.0.x merchant account
    /** "0.0.0" = HBAR (tinybars). Otherwise an HTS token id (e.g. testnet USDC 0.0.429274). */
    asset: string;
    assetDecimals: number;
    /** USD per 1 HBAR, used only when asset is HBAR. */
    hbarUsd: number;
    facilitatorUrl: string;
  };
  rateLimits: {
    /** Requests per minute per verified HUMAN, aggregated across all their agents. */
    verifiedPerHumanPerMin: number;
    /** Minimum seconds between requests for an unverified agent. */
    unverifiedMinIntervalSec: number;
  };
}

export type Verdict =
  | "admitted"
  | "payment_required"
  | "bounced_rate_limit"
  | "rejected_identity"
  | "revoked"
  | "forbidden_path"
  | "step_up_required"
  | "step_up_denied"
  | "over_budget";

/** Per-request state computed by the Bouncer pipeline before x402 runs. */
export interface BouncerContext {
  id: string;
  route: RoutePrice;
  agent: string; // ENS name or "anon:<id>"
  ensVerified: boolean;
  humanHash: string | null; // salted hash of World subject, never the raw id
  verified: boolean; // human-backed per World
  priceUsd: number;
  startedAt: number;
}

export type BouncerRequest = Request & { bouncer?: BouncerContext };
