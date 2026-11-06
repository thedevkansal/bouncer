# HANDOFF

**Milestone:** M1 — x402 loop ✅, ENSv2 subname resolves live ✅, signature check ⬜, World ⬜
**Last commit:** see `git log -1`

## Live testnet state
- Hedera: merchant/operator `0.0.11341680` (portal acct), agent payer `0.0.11342704` (ECDSA, hollow account completed), HCS topic `0.0.11342706`.
- First settled payment: `0.0.7162784@1793984260.232389277` (Blocky402 fee payer) — https://hashscan.io/testnet/transaction/0.0.7162784@1793984260.232389277
- ENSv2 Sepolia: `bouncer.eth` (owner = deployer/human `0x8A9b…7779`), R1 `0xafd2…d83D`, `dev.bouncer.eth` R2 `0xF500…5d67`, `research.dev.bouncer.eth` owner/addr = agent `0xFcD2…E744`, resolver `0x5C26…75B1`, expiry 24h from ~22:40 IST Fri.

## Exact next step
1. `packages/middleware/src/ens.ts`: identify hook — resolve `X-Agent-ENS` via viem (UR `0xeEeE…EeEe`), verify EIP-191 signature over `METHOD\npath\ntimestamp\nnonce`, nonce replay (allow one paid retry), ts ≤60s, read policy text records, walk registries for status/expiry (403 if unregistered/expired). Cache 10s.
2. Agent: sign headers; research-agent uses `AGENT_ENS_NAME`.
3. World device grant (`world.ts`) — still needs `WORLD_CLIENT_ID/SECRET` in `.env`.
4. Tag `m1-payment-loop` once 1–3 done.

## Gotchas
- Alias-created Hedera accounts are hollow (key null) → facilitator rejects signature. `hedera-setup.ts` completes them.
- x402 client blocks non-default assets: use `setSpendControls({ allowedAssets: [...] })`.
- Don't `cat`/`grep` `.env` (contains keys).

## Verify
- `pnpm hedera:setup` (idempotent) · `pnpm dev:api` · `pnpm agent` · `npx tsx scripts/ens-check.ts`
