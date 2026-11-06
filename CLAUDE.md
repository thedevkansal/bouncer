Before doing anything, read docs/HANDOFF.md and docs/PROGRESS.md.

# Bouncer — build prompt (ETHGlobal Mumbai 2026)

You are a senior engineer helping a hackathon team build **Bouncer** at ETHGlobal Mumbai.
Hacking ends **09:00 IST Sat Nov 7, 2026**. It is ~21:00 IST Fri. We submit by **08:00 IST**.
Optimise for a working, honest, live demo, not completeness.

---

## 1. What Bouncer is
Drop-in middleware for any HTTP API that charges AI agents per request via **x402** (HTTP 402 Payment Required) and prices them by whether a verified unique human backs them.

- Human-backed agents pay a fair base price. Unverified agents pay surge prices and get throttled ("bounced").
- Every agent is an **ENSv2 subname** with its own identity, permissions, spend policy and revocation.
- Rate limits aggregate **per human**, not per agent, so spinning up 1,000 agents gains nothing. This is the core insight; keep it visible in code and demo.
- Routine calls are fully autonomous. Spending **above a threshold** triggers a **fresh human verification** (World ID Agent Pass) before the action happens.

Tagline: **"Real agents get in. Bots get bounced."**

---

## 2. Partner prize picks (max 3 — these are final)
| Partner | Track | Pool |
|---|---|---|
| Hedera | AI Agents That Pay: x402 on Hedera | $6,500 |
| World | World ID Agent Pass (non-continuity, $5,000 track) | $5,000 |
| ENS | Best Use of ENSv2 | $7,000 |

- Do **NOT** add any other sponsor's SDK. Bolt-ons hurt us.
- **No Arkiv / Swarm.** The Arkiv+Swarm bonus only comes with an Arkiv track submission, and Arkiv counts as a pick. We have none left.
- Each partner must be load-bearing (removing it breaks the product):
  - **Hedera:** the x402 payment rail. Every paid request settles on Hedera testnet, and every agent's spending is logged to an HCS topic.
  - **World:** Agent Pass is the ONLY signal for human-backed pricing, and the gate for above-threshold actions.
  - **ENS:** agent identity (signatures map to an ENSv2 name), permissions (EAC roles), policy (resolver records) and revocation (registry).

---

## 3. Prize qualification (hard requirements; verified from ethglobal.com/events/mumbai/prizes)
Maintain `docs/QUALIFICATION.md`: a table of **requirement → how we meet it → evidence (file/line, tx id, link)**.
Re-check it at M1, M2, M3 and before submission. Flag any risk in `docs/HANDOFF.md`.

### Hedera — "AI Agents That Pay: x402 on Hedera"
Must:
- [ ] At least one x402-protected endpoint that **settles on Hedera testnet** through a facilitator listed in the Hedera docs (**Official x402, Ax402, or Blocky402**) **or a facilitator we run ourselves**.
- [ ] An agent or client that **finds the endpoint** and completes **at least one paid request end to end with no human approving**.
- [ ] Public GitHub repo with a README covering **setup, architecture and the payment flow**, including the **Hedera transaction ID of at least one settled payment**.
- [ ] Demo video **≤ 5 minutes** that shows a payment settling and **links to it on HashScan**.

Extra points we target:
- [ ] Spending controls: budgets, per-merchant limits, allowlists, and **human-in-the-loop approval above a set amount** (our World step-up).
- [ ] An **HCS topic as a tamper-evident audit log of each agent's spending**.
- [ ] Settle in an **HTS token (testnet USDC)** if available. Otherwise HBAR, documented.
- [ ] Optional, only if cheap: Hedera Agent Kit / Network MCP for the demo agent.

Docs (read before coding): https://docs.hedera.com/solutions/ai/x402 · /how-it-works · /pay-with-x402 · /merchant-integration · /facilitators · /exact-scheme · https://github.com/x402-foundation/x402

### World — "World ID Agent Pass"
Must:
- [ ] Integrate with the **official World ID Agent Pass**.
- [ ] Demonstrate the **complete journey**: verification request → user completion → validated result → the protected agent action happens.
- [ ] Demonstrate a **denied / expired / cancelled path where the protected action does NOT occur** (no payment settles, no data served).
- [ ] **Validate results in a secure backend.** Never expose client secrets. Never treat an unvalidated client response as authorization.
- [ ] Include a short **integration debrief** in `docs/WORLD_FEEDBACK.md`: time to first success, friction, missing capability or docs, and the one improvement with the greatest impact.

Judging note: they want "a meaningful action that needs a human identity or approval layer, not simply a login screen." Our above-threshold step-up is exactly that.
Note from World: proofs are currently mocked with fake identities (no sandbox app needed). Say so in the README.
Docs: https://auth.world.org/docs · Portal: https://auth.world.org/portal

### ENS — "Best Use of ENSv2"
Must:
- [ ] Built on **ENSv2 on Ethereum Sepolia** (not ENSv1 / NameWrapper).
- [ ] ENSv2 features **central** to the product, not cosmetic.
- [ ] Demo is **functional with NO hard-coded values**: names, addresses, policies and revocation are resolved live.
- [ ] Showcase has a **link to a LIVE demo**, and the code is open source on GitHub.
- [ ] Bonus: **AI agents as namespaces**, each with its own identity and permissions (this is us).

Docs: https://docs.ens.domains/ensv2/permissioned-registry · /ensv2/permissioned-resolver/ · /ensv2/enhanced-access-control/ · /ensv2/tutorial-contract-developers/ · ENSIP-26 Agent Text Records https://docs.ens.domains/ensip/26/ · ENSIP-25 · ens-cli https://github.com/ensdomains/ens-cli

### ETHGlobal general
- [ ] All project code written during the hackathon. List any boilerplate and libraries in the README.
- [ ] **Say how AI was used** (ETHGlobal rules require it): `docs/AI_USAGE.md` + a README section.
- [ ] Public repo with an open-source license (MIT).

---

## 4. Engineering rules
- Read official docs before using any SDK. **Do NOT invent function names, ABIs, endpoints or addresses.** If you can't find the real API, stop and log it in `docs/BLOCKERS.md`.
- Testnets only: Hedera testnet, Ethereum Sepolia. Never mainnet keys.
- Never fake a sponsor call in the demo path. Any fallback must be real code, labelled in the UI ("fallback mode") and in the README.
- TypeScript everywhere. pnpm monorepo. Solidity (Foundry) only where ENSv2 contracts require it. No microservices; no Docker unless needed.
- Secrets only in env vars. Commit `.env.example` with every variable documented.

---

## 5. Git & GitHub (judges review commit history — follow strictly)
- One **public** repo named `bouncer`, MIT license.
- Commit small and often: after every working step, at least every 30–45 min of work. **Push immediately after each commit.**
- Conventional Commits, e.g. `feat(middleware): return 402 with x402 payment requirements`, `fix(ens): bust policy cache after revocation`, `docs(readme): add Hedera settlement flow`. No "wip", "update", "final final".
- **Never force-push, squash or rewrite history on main. Never fake or edit commit timestamps.**
- No mega-commits. Split by feature.
- Each teammate commits from their **own** GitHub account and git identity. Check `git config user.name/user.email` first.
- Short-lived branches (`feat/x402-loop`, `feat/ensv2-registry`, `feat/world-stepup`, `feat/dashboard`) merged via quick PRs. Small direct commits to main are fine when time-critical; **main must always run**.
- Tags: `m1-payment-loop`, `m2-full-flow`, `m3-demo-ready`, `v1.0-submission`.
- `.gitignore`: node_modules, .env*, build output, logs/, raw video files.
- If a secret leaks: rotate it immediately and log it.
- Push and tag `v1.0-submission` before 08:00 IST. No commits after submission.

---

## 6. Docs as memory (maintain at all times)
Every session must be resumable from files alone. Update docs **before every commit** and **before stopping for any reason**.

- `CLAUDE.md` (repo root): this whole prompt. First line: "Before doing anything, read docs/HANDOFF.md and docs/PROGRESS.md."
- `docs/HANDOFF.md`: **most important.** Overwrite on every stop or commit. Include: current milestone, what was just done (commit hash), the exact next step, half-done or broken items, verify commands, and ❓ questions (pick a safe default; don't block).
- `docs/PROGRESS.md`: M1–M5 checklist with `[ ]`/`[x]` and IST timestamps.
- `docs/QUALIFICATION.md`: requirement → how → evidence, for all three partners and ETHGlobal.
- `docs/DECISIONS.md`: time, decision, why, alternatives rejected.
- `docs/ARCHITECTURE.md`: components, request flow, Mermaid diagram.
- `docs/PARTNERS.md`: per partner: what we use, exact files and lines, testnet addresses and tx ids, fallback status, "what breaks if removed".
- `docs/SETUP.md`: from-zero setup, env vars, faucets, ENS deployment and subname issuance.
- `docs/TESTING.md`: how to verify each milestone.
- `docs/BLOCKERS.md`: blockers, what was tried, workaround.
- `docs/DEMO.md`: demo flow, what to say, recovery if something fails live.
- `docs/SUBMISSION.md`: draft submission-form answers, per-partner paragraphs, links.
- `docs/WORLD_FEEDBACK.md`: the required World debrief.
- `docs/AI_USAGE.md`: what was AI-assisted.
- `CHANGELOG.md`: one line per meaningful change, newest first.

Keep them short and factual. Commit with `docs(...)`.

---

## 7. Auto-resume after usage limits reset
- Work in small steps: run → commit → push → update HANDOFF.md + PROGRESS.md.
- If near a limit or the context is long: stop new work, write HANDOFF.md, commit, push.
- On every fresh start: read `CLAUDE.md` → `docs/HANDOFF.md` → `docs/PROGRESS.md` → `git log --oneline -15` → `git status`, then continue the exact next step. Don't redo or re-plan.
- Clock rules: after **02:00 IST**, bug fixes and docs only. After **07:30 IST**, no code changes. When tag `v1.0-submission` exists, create `docs/DONE` and stop.
- Unattended safety: only touch this repo. No force-push or history rewrites, no deleting branches, no unknown dependencies, never print or commit secrets, never use mainnet keys. Log ❓ and pick the safest default.

At setup, create `scripts/auto-resume.sh` (see that file), `chmod +x` it, and add `logs/` to `.gitignore`.

---

## 8. Architecture
```
packages/middleware   Express middleware bouncer({ pricing, ens, world, facilitator, hcs })
packages/contracts    ENSv2 Permissioned Registry setup for agent subnames (Foundry), deploy scripts
apps/demo-api         Express API: GET /premium/research?q= (cheap) and GET /premium/dataset (above threshold)
                      + GET /.well-known/bouncer.json (discovery manifest: endpoints, prices, network)
apps/dashboard        Next.js live dashboard (SSE): requests, verdicts, payments (HashScan links),
                      HCS audit log, step-up approvals; "Run demo" button; presentation mode
apps/agents           research-agent (human-backed, ENS subname, autonomous x402 payer)
                      swarm (50 unverified agents)
scripts/              ENS deploy + subname issuance, World setup, Hedera testnet funding, HCS topic creation
video/                script, captions, title/end cards, ffmpeg build script
```

---

## 9. Request flow (implement exactly)
1. The agent discovers the API via `/.well-known/bouncer.json`, then calls it with headers `X-Agent-ENS` and `X-Agent-Signature` (signature over method+path+timestamp+nonce, by the key the ENS name resolves to).
2. Middleware:
   - **a. Identity (ENSv2).** Resolve the subname live (viem, Sepolia). Verify the signature against the resolved address. Reject on mismatch, replayed nonce, or a timestamp older than 60s.
   - **b. Policy & revocation (ENSv2).** Read policy from the subname's Permissioned Resolver: maxSpendPerDay, rateLimitPerMin, allowedPaths, stepUpAbove. Use ENSIP-26 agent text-record keys where they fit and namespaced `bouncer.*` keys otherwise. If the subname is revoked or expired in the registry → 403. Cache at most 10s.
   - **c. Human backing (World).** Check whether the agent is bound to a verified human via an Agent Pass result previously validated in **our backend**. Map it to a per-human key; store only a salted hash and never publish the raw identifier.
   - **d. Pricing.** Verified: $0.001/request, 60 req/min **per human aggregated across all their agents**. Unverified: $0.02/request, 1 req/10s per agent. All configurable.
   - **e. Step-up (World).** If the request costs more than `stepUpAbove` (e.g. /premium/dataset at $0.50), return 403 `step_up_required` with a challenge id. The dashboard or the human's device completes a **fresh Agent Pass verification**, and the backend validates it. Approved → the agent retries with the challenge id and proceeds to payment. **Denied, expired (e.g. 120s) or cancelled → the action never happens and no payment settles.** Log both outcomes.
   - **f. Payment (Hedera x402).** If unpaid → 402 with x402 payment requirements (Hedera exact scheme: amount, asset, payTo, network = Hedera testnet). The agent pays autonomously and retries with the x402 payment header. Verify and settle via a listed facilitator (Official x402 / Ax402 / Blocky402). **Fallback:** run our own facilitator per the Hedera exact-scheme spec (still qualifies), labelled in the README.
   - **g. Audit (Hedera HCS).** Submit a message per settled payment to our HCS topic: agent ENS, human-hash, amount, tx id, path, timestamp. The dashboard reads it back from the Mirror Node.
   - **h. Serve & emit.** Serve the response and push an event to the dashboard.

---

## 10. ENSv2 design
- Parent name on Sepolia (`bouncer.eth` or the team's name). Deploy our own **Permissioned Registry** for agent subnames: `<agent>.<human>.bouncer.eth`.
- Agent subnames are **expiring** (24h default, renewable), **revocable** by the parent, and **non-transferable** (a verified agent name can't be sold to a bot farm).
- Each agent subname gets its own **Permissioned Resolver**.
- **Enhanced Access Control** roles:
  - The human owner role can edit policy records.
  - The agent-key role can edit ONLY `bouncer.status` / heartbeat, **never its own policy**.
  - The Bouncer service is read-only.
- Revocation = registry revoke (not a text flag). The middleware sees it within 10s.
- Optional: wildcard resolution under the parent for new agents.

---

## 11. Milestones (after each: commit, push, tag, update docs, report how to test)
- **M1 (by 23:00):** x402 402→pay→200 loop settling on Hedera testnet (record tx id). ENSv2 subname resolves live, with the signature check working. One Agent Pass verification validated server-side. Tag `m1-payment-loop`.
- **M2 (by 01:00):** Full flow a–h: per-human aggregation, EAC permissions, registry revocation, the step-up approve AND deny/expire paths, and the HCS audit log. Tag `m2-full-flow`.
- **M3 (by 02:00):** Dashboard with presentation mode; agents and swarm scripts; `pnpm demo`. **Deployed live**: dashboard on Vercel, API + middleware on Render, secrets in server env. Public "Run demo" button (rate-limited). Live URL in README. Tag `m3-demo-ready`. **FEATURE FREEZE.**
- **M4 (02:00–05:00):** bug fixes, QUALIFICATION.md fully green, WORLD_FEEDBACK.md, AI_USAGE.md, README complete.
- **M5 (05:00–07:30):** demo video (section 13).
- **08:00:** submit. Tag `v1.0-submission`. Create `docs/DONE`.

---

## 12. Demo flow (`pnpm demo`; press Enter to advance; deterministic reset)
1. **Swarm:** 50 unverified agents get 402s at surge price, and most are bounced.
2. **research.dev.bouncer.eth (human-backed)** discovers the API and pays $0.001 per call **autonomously**. Show the HashScan tx and the HCS audit entry.
3. The same human spins up 20 more agents: they share **one** human quota and gain nothing.
4. The agent tries to raise its own spend cap in ENS → **EAC rejects it onchain**.
5. The agent requests a $0.50 dataset → **step-up**: fresh Agent Pass verification → approved → paid → served. Repeat and **cancel or let it expire** → denied, nothing paid, nothing served.
6. **Revoke** the subname in the registry → the next request gets 403 live.
7. Slide: "Remove Hedera → agents can't pay. Remove World → can't tell humans from swarms. Remove ENS → no identity, permissions or revocation."

---

## 13. M5: Demo video (you prepare everything; humans record)
Hedera limit is **≤ 5 min**. Target **3:00–4:00**. Use a real human voiceover, not TTS. Deliverables in `/video`:
1. `script.md`, a timestamped script and shot list:
   - 0:00–0:15 hook: "APIs today either block every AI agent or get scraped to death."
   - 0:15–0:40 what Bouncer is + architecture diagram
   - 0:40–3:15 demo steps 1–6 (dashboard + terminal + **HashScan** + ENS app + World verification screen)
   - 3:15–3:40 the remove-a-partner slide
   - 3:40–4:00 what's next, **live demo URL**, repo link, team
2. Dashboard **presentation mode**: large fonts, high contrast, big counters (bounced / admitted / USD paid / step-ups approved / denied), 1920×1080.
3. `title.html` and `end.html` full-screen cards: name, tagline, team, live URL, repo. Partner names as text unless brand guidelines allow logos.
4. `captions.srt` matching the script.
5. `recording-checklist.md`: OBS 1080p/30fps, notifications off, clean browser profile, big terminal font, a warm-up `pnpm demo` run, 2 takes, separate voice track if the room is noisy.
6. `build-video.sh`: ffmpeg trims takes, concatenates title → demo → end, adds captions, normalises audio, and exports H.264 MP4 (libx264 `-preset veryfast`, CRF ~23, AAC) under 100 MB.
7. Upload as unlisted YouTube. Put the link in README + SUBMISSION.md.

Commit `/video` (not raw recordings) with `docs(video): ...`.

---

## 14. README (write as you go)
Problem · one-line pitch · **live demo URL** · architecture (Mermaid) · payment flow with **Hedera tx id + HashScan link** · HCS topic id · ENSv2 contract addresses and an example subname · World Agent Pass flow, including the denied path (note: mocked proofs) · per-partner "what breaks if removed" with file/line links · fallbacks · setup · libraries/boilerplate used · **AI usage** · demo video link · known limitations · MIT license.
