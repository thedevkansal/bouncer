# Qualification

Status: ⬜ todo · 🟡 partial · ✅ done

## Hedera — AI Agents That Pay: x402 on Hedera
| Requirement | How | Evidence | Status |
|---|---|---|---|
| x402 endpoint settling on Hedera testnet via listed facilitator | `@x402/express` + `@x402/hedera`, Blocky402 testnet | tx `0.0.7162784@1793984260.232389277` — [HashScan](https://hashscan.io/testnet/transaction/0.0.7162784@1793984260.232389277), 0.4 HBAR agent 0.0.11342704 → merchant 0.0.11341680, SUCCESS | ✅ |
| Agent finds endpoint + pays end-to-end, no human | `/.well-known/bouncer.json` + `@x402/fetch` agent (`apps/agents/src/research-agent.ts`) | same tx; agent run with no approval | ✅ |
| Public repo, README with setup/architecture/payment flow + tx id | README | TBD | ⬜ |
| Demo video ≤5 min with HashScan link | video/ | TBD | ⬜ |
| Extra: spending controls + HITL above threshold | ENS policy + World step-up | TBD | ⬜ |
| Extra: HCS audit topic | HCS topic | topic `0.0.11342706` created; messages TBD (M2) | 🟡 |
| Extra: agent-side spend cap | `x402Client.setSpendControls` per-payment HBAR cap | `apps/agents/src/research-agent.ts` | ✅ |
| Extra: HTS USDC | HBAR first (USDC id not in docs) | — | ⬜ |

## World — Agent Pass
| Requirement | How | Evidence | Status |
|---|---|---|---|
| Official World ID Agent Pass | World IdP OIDC device grant (auth.world.org) | TBD | ⬜ |
| Complete journey request→completion→validated→action | step-up on /premium/dataset | TBD | ⬜ |
| Denied/expired/cancelled path, action does not occur | challenge TTL 120s + cancel + access_denied | TBD | ⬜ |
| Backend validation, no secrets client-side | jose JWKS verify in API | TBD | ⬜ |
| Integration debrief | docs/WORLD_FEEDBACK.md | TBD | ⬜ |

## ENS — Best Use of ENSv2
| Requirement | How | Evidence | Status |
|---|---|---|---|
| ENSv2 on Sepolia | `bouncer.eth` via ETHRegistrar; own UserRegistry proxies R1 `0xafd24C00F565792338e786ec21F4c35d6AE2d83D` (*.bouncer.eth), R2 `0xF500553aB98Cf5c79589c30813ED10dc74bc5d67` (*.dev.bouncer.eth); agent resolver `0x5C268735993A5043b70c244a9D648F2d9E6675B1` | `scripts/ens-setup.ts`, `scripts/ens-check.ts` | ✅ |
| ENSv2 central | identity, EAC perms, resolver policy, registry revoke | TBD | ⬜ |
| No hard-coded values | live viem reads, 10s cache | TBD | ⬜ |
| Live demo link + open source | Vercel/Render + GitHub | TBD | ⬜ |
| Bonus: agents as namespaces | `<agent>.<human>.<parent>` | TBD | ⬜ |

## ETHGlobal
| Requirement | How | Evidence | Status |
|---|---|---|---|
| Code written during hackathon, libs listed | README | TBD | ⬜ |
| AI usage disclosed | docs/AI_USAGE.md + README | TBD | ⬜ |
| Public repo, MIT | LICENSE | LICENSE | ✅ |
