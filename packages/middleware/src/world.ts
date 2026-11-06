// World ID Agent Pass via World IdP (OIDC) Device Authorization Grant.
// Docs: auth.world.org/docs (guides/oidc, step-up, id-token).
//  - backend starts a device authorization (client secret never leaves the server)
//  - the human opens verification_uri_complete (QR) and completes World ID
//  - backend polls the token endpoint and VALIDATES the id_token (JWKS, iss, aud, exp, auth_time)
//  - only then is the challenge "approved". Denied / expired / cancelled → never approved.
// Device authentication "always requires fresh authentication" (World docs), so every
// challenge is a fresh human verification.
import { createHash, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type ChallengeStatus = "pending" | "approved" | "denied" | "expired" | "cancelled" | "error";

export interface Challenge {
  id: string;
  purpose: string; // e.g. "bind:research.dev.bouncer.eth" or "stepup:<agent>:GET /premium/dataset"
  status: ChallengeStatus;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  createdAt: number;
  expiresAt: number;
  humanHash?: string; // salted hash of (iss, sub) — raw subject never stored
  acr?: string;
  amr?: string[];
  authTime?: number;
  reason?: string;
}

export interface WorldConfig {
  issuer: string; // https://auth.world.org
  clientId: string;
  clientSecret: string;
  humanSalt: string;
  /** Our own TTL for a challenge (seconds), independent of World's device code lifetime. */
  ttlSec: number;
  /** acr values that count as a verified human. Empty = accept any validated token with an acr. */
  acceptedAcr?: string[];
  onChange?: (c: Challenge) => void;
}

interface Discovery {
  token_endpoint: string;
  device_authorization_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

export function createWorld(cfg: WorldConfig) {
  const challenges = new Map<string, Challenge>();
  const deviceCodes = new Map<string, string>(); // challengeId -> device_code (server only)
  let disco: Discovery | null = null;
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  const basic = "Basic " + Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString("base64");

  async function discovery(): Promise<Discovery> {
    if (!disco) {
      const r = await fetch(`${cfg.issuer}/.well-known/openid-configuration`);
      if (!r.ok) throw new Error(`World discovery failed: ${r.status}`);
      disco = (await r.json()) as Discovery;
      jwks = createRemoteJWKSet(new URL(disco.jwks_uri));
    }
    return disco;
  }

  function update(c: Challenge, patch: Partial<Challenge>) {
    Object.assign(c, patch);
    if (c.status !== "pending") deviceCodes.delete(c.id);
    cfg.onChange?.(c);
  }

  function humanHash(iss: string, sub: string) {
    return createHash("sha256").update(`${cfg.humanSalt}|${iss}|${sub}`).digest("hex");
  }

  async function validateIdToken(idToken: string, c: Challenge): Promise<JWTPayload> {
    const d = await discovery();
    const { payload } = await jwtVerify(idToken, jwks!, { issuer: d.issuer, audience: cfg.clientId, algorithms: ["RS256"] });
    if (!payload.sub) throw new Error("id_token has no sub");
    // Freshness: the authentication must have happened during THIS challenge.
    const authTime = typeof payload.auth_time === "number" ? payload.auth_time : payload.iat ?? 0;
    if (authTime * 1000 < c.createdAt - 30_000) throw new Error("authentication is not fresh");
    const acr = typeof payload.acr === "string" ? payload.acr : undefined;
    if (cfg.acceptedAcr?.length && (!acr || !cfg.acceptedAcr.includes(acr))) throw new Error(`acr not accepted: ${acr ?? "none"}`);
    return payload;
  }

  async function poll(c: Challenge, intervalSec: number) {
    const d = await discovery();
    let interval = intervalSec;
    while (c.status === "pending") {
      await new Promise((r) => setTimeout(r, interval * 1000));
      if (c.status !== "pending") return;
      if (Date.now() > c.expiresAt) return update(c, { status: "expired", reason: `not completed within ${cfg.ttlSec}s` });
      const deviceCode = deviceCodes.get(c.id);
      if (!deviceCode) return;
      let r: Response;
      try {
        r = await fetch(d.token_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", authorization: basic },
          body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode }),
        });
      } catch {
        continue; // network blip: keep polling until our TTL
      }
      const body = (await r.json().catch(() => ({}))) as Record<string, string>;
      if (r.ok && body.id_token) {
        try {
          const p = await validateIdToken(body.id_token, c);
          return update(c, {
            status: "approved",
            humanHash: humanHash(String(p.iss), String(p.sub)),
            acr: p.acr as string | undefined,
            amr: p.amr as string[] | undefined,
            authTime: p.auth_time as number | undefined,
          });
        } catch (e) {
          return update(c, { status: "denied", reason: `id_token rejected: ${(e as Error).message}` });
        }
      }
      // Documented device-flow errors (auth.world.org/docs/guides/oidc)
      if (r.status === 503 || r.status === 429) return update(c, { status: "error", reason: `World IdP ${r.status}` });
      switch (body.error) {
        case "authorization_pending":
          continue;
        case "slow_down":
          interval += 5;
          continue;
        case "access_denied":
          return update(c, { status: "denied", reason: "human denied the request" });
        case "expired_token":
          return update(c, { status: "expired", reason: "World device code expired" });
        default:
          return update(c, { status: "denied", reason: body.error || `token endpoint ${r.status}` });
      }
    }
  }

  return {
    async start(purpose: string, ttlSec = cfg.ttlSec): Promise<Challenge> {
      const d = await discovery();
      const params: Record<string, string> = { scope: "openid" };
      const r = await fetch(d.device_authorization_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", authorization: basic },
        body: new URLSearchParams(params),
      });
      const body = (await r.json().catch(() => ({}))) as Record<string, any>;
      if (!r.ok) throw new Error(`World device_authorization failed: ${r.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
      const now = Date.now();
      const c: Challenge = {
        id: randomUUID(),
        purpose,
        status: "pending",
        userCode: body.user_code,
        verificationUri: body.verification_uri,
        verificationUriComplete: body.verification_uri_complete ?? body.verification_uri,
        createdAt: now,
        expiresAt: now + Math.min(ttlSec, Number(body.expires_in ?? ttlSec)) * 1000,
      };
      challenges.set(c.id, c);
      deviceCodes.set(c.id, body.device_code);
      cfg.onChange?.(c);
      poll(c, Number(body.interval ?? 5)).catch((e) => update(c, { status: "error", reason: String(e?.message ?? e) }));
      return c;
    },
    get(id: string) {
      return challenges.get(id);
    },
    cancel(id: string) {
      const c = challenges.get(id);
      if (c && c.status === "pending") update(c, { status: "cancelled", reason: "cancelled by human" });
      return c;
    },
    /** Public view: never includes device_code or raw identifiers. */
    view(c: Challenge) {
      const { id, purpose, status, userCode, verificationUriComplete, createdAt, expiresAt, acr, reason } = c;
      return { id, purpose, status, userCode, verificationUriComplete, createdAt, expiresAt, acr, reason };
    },
  };
}

export type World = ReturnType<typeof createWorld>;
