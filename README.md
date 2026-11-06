# Bouncer

**Real agents get in. Bots get bounced.**

Drop-in middleware for any HTTP API that charges AI agents per request via x402 on Hedera, and prices them by whether a verified unique human (World ID Agent Pass) backs them. Every agent is an ENSv2 subname with its own identity, permissions, spend policy and revocation. Rate limits aggregate per human, so spinning up 1,000 agents gains nothing.

Built at ETHGlobal Mumbai 2026. Work in progress; see `docs/`.

License: MIT
