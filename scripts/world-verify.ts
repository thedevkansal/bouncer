// One real World ID Agent Pass verification, validated server-side.
// Usage: pnpm world:verify [--cancel-after <sec>]
import { createWorld } from "../packages/middleware/src/world.js";
import { need } from "./lib/env.js";

const world = createWorld({
  issuer: process.env.WORLD_ISSUER || "https://auth.world.org",
  clientId: need("WORLD_CLIENT_ID"),
  clientSecret: need("WORLD_CLIENT_SECRET"),
  humanSalt: need("WORLD_HUMAN_SALT"),
  ttlSec: Number(process.env.STEPUP_TTL_SEC || 120),
});

const c = await world.start("bind:" + (process.env.AGENT_ENS_NAME || "agent"));
console.log(`\nOpen on your phone / browser and complete World ID:\n  ${c.verificationUriComplete}\n  code: ${c.userCode}\n  expires in ${Math.round((c.expiresAt - Date.now()) / 1000)}s\n`);
const cancelIdx = process.argv.indexOf("--cancel-after");
if (cancelIdx > 0) setTimeout(() => world.cancel(c.id), Number(process.argv[cancelIdx + 1]) * 1000);

while (c.status === "pending") await new Promise((r) => setTimeout(r, 1000));
console.log("result:", c.status, c.reason ?? "");
if (c.status === "approved") {
  console.log("validated id_token ✓  acr:", c.acr, "amr:", c.amr, "humanHash:", c.humanHash!.slice(0, 16) + "…");
}
process.exit(0);
