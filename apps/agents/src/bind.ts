// Bind an ENS agent to its human via World ID Agent Pass (validated in the API backend).
//   pnpm bind [agent.ens.name]
import { API } from "./lib.js";

const agent = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : process.env.AGENT_ENS_NAME!;
const r = await fetch(`${API}/world/bind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent }) });
const c = (await r.json()) as any;
if (!r.ok) {
  console.error("bind failed:", c);
  process.exit(1);
}
console.log(`\nBind ${agent} to your World ID — open and approve:\n  ${c.verificationUriComplete}\n  code ${c.userCode}  (expires ${new Date(c.expiresAt).toLocaleTimeString()})\n`);
let s = c;
while (s.status === "pending") {
  await new Promise((res) => setTimeout(res, 2000));
  s = await (await fetch(`${API}/world/challenge/${c.id}`)).json();
}
console.log("result:", s.status, s.reason ?? "");
console.log("bindings:", await (await fetch(`${API}/world/bindings`)).json());
process.exit(0);
