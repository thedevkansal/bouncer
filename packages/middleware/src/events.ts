// In-process event bus feeding the dashboard over SSE.
import { EventEmitter } from "node:events";

export interface BouncerEvent {
  ts: number;
  type: "request" | "payment" | "audit" | "stepup" | "ens" | "info";
  agent?: string;
  humanHash?: string | null;
  verified?: boolean;
  path?: string;
  verdict?: string;
  priceUsd?: number;
  txId?: string;
  hashscan?: string;
  detail?: Record<string, unknown>;
}

export const bus = new EventEmitter();
bus.setMaxListeners(100);
const recent: BouncerEvent[] = [];

export function emit(e: Omit<BouncerEvent, "ts">) {
  const ev = { ts: Date.now(), ...e };
  recent.push(ev);
  if (recent.length > 500) recent.shift();
  bus.emit("event", ev);
}

export function recentEvents() {
  return recent.slice();
}

export function clearEvents() {
  recent.length = 0;
}
