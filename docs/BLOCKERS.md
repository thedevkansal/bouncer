# Blockers

| # | Time (IST) | Blocker | Tried | Workaround / status |
|---|---|---|---|---|
| 1 | 21:15 | Need Hedera testnet account (ID + ECDSA/ED25519 key) with HBAR for merchant + agent payer | — | **Human action**: create at portal.hedera.com, put in `.env` as `HEDERA_OPERATOR_ID/KEY`. Script `scripts/hedera-setup.ts` creates payer/merchant accounts + HCS topic from it. |
| 2 | 21:15 | Need Sepolia EOA with ETH for ENSv2 deploys | — | **Human action**: fund `ENS_DEPLOYER_KEY` from a Sepolia faucet. |
| 3 | 21:15 | Need World IdP OIDC client (client_id + secret) with device grant | Docs say register in portal with Google sign-in | **Human action**: register at auth.world.org/portal, enable device authorization, put `WORLD_CLIENT_ID/SECRET` in `.env`. |
| 4 | 21:15 | "Agent Pass" has no dedicated SDK/page in auth.world.org docs (pages /docs/agent-pass are empty SPA shells) | Read overview, getting-started, oidc, step-up, id-token, testing, xaa, mcp-authorization, llms.txt | Prize page links Agent Pass Docs → auth.world.org/docs (World IdP). Using OIDC device grant as documented. ❓ Confirm with World mentors at booth. |
| 5 | 21:15 | Testnet USDC HTS token id not in Hedera x402 docs | — | Settle in HBAR (tinybars). HTS USDC stretch goal. |
| 6 | 21:15 | Which Sepolia Universal Resolver is canonical for ENSv2 not stated | Probed `ROOT_REGISTRY()` on all 3 | ✅ Resolved 22:05: all three return ENSv2 RootRegistry `0xb458…c43f`. Using `0xeEeE…EeEe`. |
| 7 | 21:15 | `npm view` CLI hangs on this machine (registry reachable via curl) | — | Use pnpm / curl. |
