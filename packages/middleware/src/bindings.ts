// Agent → human bindings. Created ONLY from a World challenge that our backend
// validated (status "approved"). Stores the salted human hash, never the raw subject.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function createBindings(file = ".state/bindings.json") {
  let map: Record<string, { humanHash: string; boundAt: number; acr?: string }> = {};
  try {
    if (existsSync(file)) map = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    map = {};
  }
  const save = () => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(map, null, 1));
  };
  return {
    bind(agent: string, humanHash: string, acr?: string) {
      map[agent.toLowerCase()] = { humanHash, boundAt: Date.now(), acr };
      save();
    },
    humanFor(agent: string): string | null {
      return map[agent.toLowerCase()]?.humanHash ?? null;
    },
    unbind(agent: string) {
      delete map[agent.toLowerCase()];
      save();
    },
    all() {
      return Object.entries(map).map(([agent, v]) => ({ agent, humanHash: v.humanHash.slice(0, 12), boundAt: v.boundAt, acr: v.acr }));
    },
  };
}

export type Bindings = ReturnType<typeof createBindings>;
