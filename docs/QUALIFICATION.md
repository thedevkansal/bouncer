# Qualification

Status: ⬜ todo · 🟡 partial · ✅ done

## Hedera — AI Agents That Pay: x402 on Hedera
| Requirement | How | Evidence | Status |
|---|---|---|---|
| x402 endpoint settling on Hedera testnet via listed facilitator | `@x402/express` + `@x402/hedera`, Blocky402 testnet | tx id: TBD | ⬜ |
| Agent finds endpoint + pays end-to-end, no human | `/.well-known/bouncer.json` + `@x402/fetch` agent | TBD | ⬜ |
| Public repo, README with setup/architecture/payment flow + tx id | README | TBD | ⬜ |
| Demo video ≤5 min with HashScan link | video/ | TBD | ⬜ |
| Extra: spending controls + HITL above threshold | ENS policy + World step-up | TBD | ⬜ |
| Extra: HCS audit topic | HCS topic | topic id: TBD | ⬜ |
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
| ENSv2 on Sepolia | own PermissionedRegistry via VerifiableFactory | addresses: TBD | ⬜ |
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
