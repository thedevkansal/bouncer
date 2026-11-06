// Hedera x402 payment rail: wraps the official @x402/express middleware with a
// dynamic price computed by the Bouncer pipeline (verified vs unverified).
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { HTTPRequestContext, RoutesConfig } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import type { BouncerConfig, BouncerContext } from "./types.js";

/** Internal header our pipeline sets (overwriting anything the client sent). */
export const CTX_HEADER = "x-bouncer-ctx";

export interface SettledPayment {
  ctxId: string;
  transaction: string;
  network: string;
  payer?: string;
  amount: string;
  asset: string;
}

export function usdToAmount(cfg: BouncerConfig["hedera"], usd: number): string {
  if (cfg.asset === "0.0.0") {
    // HBAR in tinybars (1 HBAR = 1e8 tinybars)
    return Math.max(1, Math.round((usd / cfg.hbarUsd) * 1e8)).toString();
  }
  return Math.max(1, Math.round(usd * 10 ** cfg.assetDecimals)).toString();
}

export function createX402(
  cfg: BouncerConfig,
  getCtx: (id: string | undefined) => BouncerContext | undefined,
  onSettled: (p: SettledPayment) => void,
) {
  const facilitator = new HTTPFacilitatorClient({ url: cfg.hedera.facilitatorUrl });
  const server = new x402ResourceServer(facilitator).register(cfg.hedera.network, new ExactHederaScheme());

  server.onAfterSettle(async (c) => {
    const transport = c.transportContext as { request?: HTTPRequestContext } | undefined;
    const ctxId = transport?.request?.adapter.getHeader(CTX_HEADER) ?? "";
    onSettled({
      ctxId,
      transaction: c.result.transaction,
      network: c.result.network,
      payer: c.result.payer,
      amount: c.requirements.amount,
      asset: c.requirements.asset,
    });
  });

  const routes: RoutesConfig = {};
  for (const r of cfg.routes) {
    routes[r.route] = {
      description: r.description,
      mimeType: "application/json",
      accepts: {
        scheme: "exact",
        network: cfg.hedera.network,
        payTo: cfg.hedera.payTo,
        maxTimeoutSeconds: 120,
        price: (context: HTTPRequestContext) => {
          const ctx = getCtx(context.adapter.getHeader(CTX_HEADER));
          const usd = ctx ? ctx.priceUsd : r.unverifiedUsd;
          return { asset: cfg.hedera.asset, amount: usdToAmount(cfg.hedera, usd) };
        },
      },
    };
  }
  return paymentMiddleware(routes, server);
}
