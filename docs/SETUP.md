# Setup (from zero)

1. Node ≥ 20, pnpm 9: `npm i -g pnpm@9`
2. `pnpm install`
3. `cp .env.example .env` and fill:
   - Hedera: create testnet account at https://portal.hedera.com → `HEDERA_OPERATOR_ID/KEY`
   - Sepolia: funded EOA → `ENS_DEPLOYER_KEY`
   - World: register OIDC client at https://auth.world.org/portal (enable device authorization) → `WORLD_CLIENT_ID/SECRET`
4. Scripts (filled in as built): `pnpm hedera:setup`, `pnpm ens:setup`, `pnpm dev`, `pnpm demo`.
