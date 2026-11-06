# HANDOFF

**Milestone:** M0 → M1 (setup done, starting M1)
**Last commit:** see `git log -1`
**Just done:** repo scaffold, docs skeletons, DECISIONS/BLOCKERS from docs research, auto-resume script.

## Exact next step
1. Scaffold pnpm workspace (`packages/middleware`, `apps/demo-api`, `apps/agents`).
2. M1a: x402 loop on Hedera testnet (`@x402/express` + `@x402/hedera`, Blocky402). Needs `HEDERA_OPERATOR_ID/KEY` in `.env`.
3. M1b: ENSv2 Sepolia subname + signature check. Needs `ENS_DEPLOYER_KEY` funded.
4. M1c: World device-flow verification validated server-side. Needs `WORLD_CLIENT_ID/SECRET`.

## Waiting on humans (BLOCKERS.md #1–#3)
- Hedera testnet account, Sepolia funded key, World portal OIDC client.

## Verify
- `git log --oneline -5`

## ❓ Questions
- ENS parent name: default `bouncer.eth` if available on ENSv2 Sepolia, else `bouncer-agents.eth`.
