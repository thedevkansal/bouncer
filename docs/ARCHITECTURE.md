# Architecture

```mermaid
sequenceDiagram
  participant A as Agent
  participant B as Bouncer middleware
  participant E as ENSv2 (Sepolia)
  participant W as World IdP
  participant F as x402 facilitator
  participant H as Hedera (HTS/HCS)
  A->>B: GET /.well-known/bouncer.json
  A->>B: GET /premium/research (X-Agent-ENS, X-Agent-Signature)
  B->>E: resolve addr + policy text records + registry status
  B->>B: verify sig, nonce, ts<=60s; human lookup (salted hash)
  B->>B: price + per-human rate limit
  alt cost > stepUpAbove
    B-->>A: 403 step_up_required (challengeId)
    W-->>B: fresh device-flow verification, id_token validated
  end
  B-->>A: 402 PaymentRequired (hedera:testnet, exact)
  A->>B: retry with x402 payment header
  B->>F: verify + settle
  F->>H: submit TransferTransaction
  B->>H: HCS audit message
  B-->>A: 200 + data
```

Components: see CLAUDE.md §8. Details filled in as built.
