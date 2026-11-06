# Decisions

Newest first. Times IST (Fri Nov 6 – Sat Nov 7, 2026).

## 21:15 — Stack and sponsor SDKs (from reading official docs)

### Hedera x402
- Docs read: docs.hedera.com/solutions/ai/x402 (+ how-it-works, pay-with-x402, merchant-integration, facilitators, exact-scheme).
- Packages (official reference impl, x402-foundation): `@x402/core` (`x402Client` from `@x402/core/client`, `x402ResourceServer` from `@x402/core/server`), `@x402/hedera` (`createClientHederaSigner`, `ExactHederaScheme` from `@x402/hedera/exact/client` and `/exact/server`), `@x402/express`, `@x402/fetch`, `@hiero-ledger/sdk` (docs say use this, not `@hashgraph/sdk`). Version 2.30.0.
- Protocol: x402 v2, scheme `exact`, network CAIP-2 `hedera:testnet`. Client sends a partially-signed `TransferTransaction`; facilitator is `feePayer`, co-signs and submits.
- **Facilitator: Blocky402 testnet `https://api.testnet.blocky402.com`** (feePayer 0.0.7162784, no API key). Backup: Official x402 `https://x402.org/facilitator` (feePayer 0.0.9185802). Both listed in Hedera docs. Selectable via `X402_FACILITATOR_URL`.
  - Why Blocky402 primary: Hedera-native, listed for testnet+mainnet. Official as hot backup (one env var).
  - Ax402: not on the Hedera facilitators page as read today; not used.
  - Own facilitator: fallback only if both fail (still qualifies per prize text).
- Asset: **HBAR (`0.0.0`) in tinybars** first. Testnet USDC token id is not given in the docs; HTS USDC is a stretch goal (needs token association on payer). Documented.
- HCS audit: `TopicCreateTransaction` / `TopicMessageSubmitTransaction` via `@hiero-ledger/sdk`; read back from Mirror Node REST `/api/v1/topics/{id}/messages`.

### World ID Agent Pass
- Prize page links "World ID Agent Pass Docs" → `https://auth.world.org/docs`. That product is **World IdP (OIDC)**; no separate "Agent Pass" SDK exists in the docs.
- We use the **OAuth 2.0 Device Authorization Grant** (the docs' headless-agent flow):
  - `POST https://auth.world.org/api/v1/device_authorization` (scope=openid, client auth) → `user_code`, `verification_uri_complete`, `device_code`, `interval`, `expires_in`.
  - Human opens `verification_uri_complete` (QR on dashboard) and completes World ID.
  - Backend polls `POST https://auth.world.org/api/v1/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`.
  - Backend validates `id_token` with `jose` against discovery `jwks_uri` (iss, aud=client_id, exp, acr).
  - Docs: "Device authentication always requires fresh authentication" → every step-up is a fresh verification.
  - Denied / expired: `access_denied`, `expired_token`, `invalid_grant` → action never happens. We add our own 120s challenge TTL and explicit cancel.
- Human key: pairwise `sub` from World → store only `sha256(salt || iss || sub)`.
- Client secret stays in server env only. Proofs on World side are mocked (fake identities) per prize page.

### ENSv2 (Sepolia)
- Docs read: permissioned-registry, permissioned-resolver, enhanced-access-control, tutorial-contract-developers, verifiable-factory, learn/deployments, ENSIP-26, ens-cli README.
- Contracts from docs deployments table (contracts-v2 @ 07e55a05): ETHRegistry `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`, ETHRegistrar `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3`, VerifiableFactory `0xda70306c98e97ece36f997a21368e53298572991`, UserRegistryImpl `0x9bd8a88719068d09ecee662f36c0e3856708366a`, PermissionedResolverImpl `0x115eb53f0c60696633855f90b138178fb40b2b2c`, UniversalResolver proxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` (to verify via `ROOT_REGISTRY()`).
- Plan: own `bouncer-*.eth` on ENSv2 Sepolia → deploy a UserRegistry (PermissionedRegistry) proxy via VerifiableFactory → `setSubregistry` → register `<human>` then `<agent>.<human>` with expiry 24h, no `ROLE_CAN_TRANSFER_ADMIN` (non-transferable), one PermissionedResolver proxy per agent.
- EAC: human gets ROLE_SET_TEXT (root) on the agent resolver; agent key gets ROLE_SET_TEXT only on resource `keccak256("bouncer.status")`; Bouncer service gets nothing (read-only).
- Revocation = `unregister(anyId)` on our registry; middleware checks `getStatus`/`getState` live, cache ≤10s.
- Reads via viem (`getEnsAddress`, `getEnsText` through Universal Resolver) + direct registry reads.
- Tooling: viem scripts first (no Foundry needed: we only deploy proxies of existing impls via VerifiableFactory). Foundry only if a custom contract is required.

### Repo / infra
- pnpm monorepo, TypeScript, Express 5 middleware, Next.js dashboard, tsx for running TS.
- In-memory state (rate limits, nonces, challenges) for hackathon; single API instance on Render.
