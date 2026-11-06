# World ID Agent Pass — integration debrief

- **Time to first success:** started reading docs 21:00 IST; first validated approval 23:30 IST (~2.5h, ~40 min of which was account/app-setting confusion).
- **What we used:** World IdP OIDC Device Authorization Grant (`/api/v1/device_authorization` → `/api/v1/token`), id_token validated with `jose` against `jwks_uri` (RS256, iss, aud, auth_time freshness). Client secret only in server env.

## Friction
1. "Agent Pass" is not named anywhere in auth.world.org/docs; `/docs/agent-pass` routes render an empty SPA shell. We inferred Agent Pass = World IdP OIDC from the prize page links.
2. Portal app default "Orb" accepted accounts → our new World ID (passkey only) got `access_denied` with a generic "Something went wrong" page. The page only shows a reference id, not *why* (account lacks Orb proof). Switching the app to "Any account" fixed it.
3. Prize page says "proofs are mocked", but the portal/app flow still asked for an Orb for Proof of human. Unclear what "mocked" covers.
4. Redirect URIs must be HTTPS (no `http://localhost`), even for apps that only use the device grant.
5. No npm SDK named in docs; generic OIDC worked fine.

## Missing capability / docs
- A clear "Agent Pass" page: how an agent's key/identity is bound to a human, with an end-to-end example.
- Device-flow denial reason (e.g. `error_description: account lacks required acr`) instead of bare `access_denied`.

## One improvement with the greatest impact
Return a specific error (and show it on the hosted page) when the user's account doesn't meet the app's accepted-accounts level — that alone cost us most of our debugging time.
