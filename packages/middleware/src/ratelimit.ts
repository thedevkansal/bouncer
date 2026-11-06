// Rate limits. The core insight: verified traffic is limited PER HUMAN, aggregated
// across every agent that human runs. Spinning up 1,000 agents gains nothing.

const windows = new Map<string, number[]>(); // key -> request timestamps (ms)

function hit(key: string, windowMs: number, max: number, now = Date.now()): boolean {
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    windows.set(key, arr);
    return false;
  }
  arr.push(now);
  windows.set(key, arr);
  return true;
}

/** Verified: one shared bucket per human hash (NOT per agent). */
export function allowVerified(humanHash: string, perMin: number): boolean {
  return hit(`human:${humanHash}`, 60_000, perMin);
}

/** Unverified: each agent gets 1 request per `minIntervalSec`. */
export function allowUnverified(agent: string, minIntervalSec: number): boolean {
  return hit(`agent:${agent}`, minIntervalSec * 1000, 1);
}

export function humanUsage(humanHash: string): number {
  const now = Date.now();
  return (windows.get(`human:${humanHash}`) ?? []).filter((t) => now - t < 60_000).length;
}

export function resetRateLimits() {
  windows.clear();
}
