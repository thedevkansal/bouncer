# HANDOFF

**Milestone:** M1 in progress (code for x402 loop written + typechecks; not yet run on chain)
**Last commit:** see `git log -1`

## Done
- pnpm workspace; `packages/middleware` (pipeline, per-human rate limits, x402 dynamic price via `@x402/express` + `@x402/hedera`, settle hook), `apps/demo-api` (manifest, SSE, 2 paid routes), `apps/agents/src/research-agent.ts` (x402 auto-pay).
- `scripts/gen-keys.ts` (keys already in local `.env`), `scripts/hedera-setup.ts`.
- ENSv2 Sepolia ABIs in `packages/contracts/abis/` (from contracts-v2 @07e55a05 deployments).

## Blocked on humans (as of 22:05)
- Hedera faucet → `0x4148FAa9761545d502C3826Cc395a53e5f63b521` (portal.hedera.com/faucet). Not funded yet.
- Sepolia ETH → `0x8A9b7EcA3e5572B081a73bfEB8c63b846d247779`. Balance 0.
- World portal OIDC client → `WORLD_CLIENT_ID/SECRET` in `.env`. Empty.

## Exact next step
1. Once Hedera funded: `pnpm hedera:setup` → `pnpm dev:api` → `pnpm agent` → record tx id in README/QUALIFICATION.
2. Write `scripts/ens-setup.ts`: MockUSDC.mint → approve ETHRegistrar → commit → wait MIN_COMMITMENT_AGE → register parent with subregistry = UserRegistry proxy (VerifiableFactory.deployProxy) → register `dev` (subregistry R2) → register `research` in R2 (owner = agent EVM, roleBitmap 0 = non-transferable, expiry 24h, own PermissionedResolver) → setAddress/setText policy → grantSetterRoles(setText "bouncer.status") to agent.
3. Write `packages/middleware/src/ens.ts` (identify hook: live resolve + sig + nonce + registry getState) and `world.ts` (device grant + jose id_token validation).

## Verify
- `pnpm -r typecheck`

## ❓ Questions
- ENS parent: try `bouncer.eth`, fall back to `bouncer-agents.eth` if `isAvailable` is false.
