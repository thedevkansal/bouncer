# HANDOFF

**Milestone:** M1 ✅ (tag `m1-payment-loop`) → starting M2
**Last commit:** see `git log -1`

## Live testnet state
- Hedera: merchant/operator `0.0.11341680`, agent payer `0.0.11342704`, HCS topic `0.0.11342706`.
- Settled payments: `0.0.7162784@1793984260.232389277` (anon), `0.0.7162784@1793988508.867548265` (signed as research.dev.bouncer.eth).
- ENSv2 Sepolia: `bouncer.eth`, R1 `0xafd2…d83D`, R2 `0xF500…5d67`, `research.dev.bouncer.eth` → `0xFcD2…E744`, resolver `0x5C26…75B1`. **Agent name expires ~22:40 IST Sat** (24h) — renew before demo if needed.
- World: app set to "Any account"; first approval 23:30 IST (amr pop/user/mfa, no acr).

## Exact next step (M2)
1. Bind agent → human through API: `POST /world/bind {agent}` → QR → approved → `.state/bindings.json`. Then agent pays verified price ($0.001).
2. Step-up hook in `index.ts`: if price > policy.stepUpAboveUsd → create World challenge, 403 `step_up_required {challengeId, url}`; agent retries with `X-Stepup-Challenge`; only `approved` + same agent + same route + unused → proceed to x402. Denied/expired/cancelled → 403, no 402 ever issued.
3. HCS audit in `onSettled` (TopicMessageSubmitTransaction to 0.0.11342706) + `/audit` reading mirror node.
4. Per-human aggregation demo (20 agents, one human), maxSpendPerDay tracking.
5. Scripts: EAC reject (agent tries setText bouncer.maxSpendPerDay → revert), revoke (`R2.unregister(labelhash("research"))`).

## Gotchas
- Don't kill all node processes; kill only the PID on :4000.
- Don't cat/grep `.env`.
- Alias-created Hedera accounts are hollow until they pay a tx (handled in hedera-setup).

## Verify
- `pnpm dev:api` · `pnpm agent` (signed) · `pnpm agent -- --anon` · `pnpm world:verify` · `npx tsx scripts/ens-check.ts`
