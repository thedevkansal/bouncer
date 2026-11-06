import { readFileSync, writeFileSync, existsSync } from "node:fs";
import "dotenv/config";

const ENV = ".env";

/** Persist a value into .env (creating/overwriting the line) and process.env. */
export function saveEnv(name: string, value: string) {
  let text = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
  const re = new RegExp(`^${name}=.*$`, "m");
  text = re.test(text) ? text.replace(re, `${name}=${value}`) : `${text.trimEnd()}\n${name}=${value}\n`;
  writeFileSync(ENV, text);
  process.env[name] = value;
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (see .env.example)`);
  return v;
}
