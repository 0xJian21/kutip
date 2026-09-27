/**
 * Daily sweep at a randomised time (SPEC F7, privacy L3). The sweep itself is Session 5's
 * `runDailySweep` in @kutip/solana; until it is merged the hook logs and skips.
 */
import type { Store } from "@kutip/db";

export type SweepFn = (deps: { store: Store; now: Date; log: (msg: string) => void }) => Promise<void>;

const MYT_MS = 8 * 3_600_000;
const WINDOW_START_UTC_H = 2; // 10:00 Malaysia time
const WINDOW_MINUTES = 8 * 60; // until 18:00 Malaysia time

/** A random whole minute in the 10:00–18:00 MYT window: today's if still ahead of `after`, else tomorrow's. */
export function nextSweepAt(after: Date, random: number): Date {
  const minute = Math.min(WINDOW_MINUTES - 1, Math.floor(random * WINDOW_MINUTES));
  const mytDay = new Date(after.getTime() + MYT_MS);
  const at = (dayOffset: number) =>
    new Date(Date.UTC(mytDay.getUTCFullYear(), mytDay.getUTCMonth(), mytDay.getUTCDate() + dayOffset, WINDOW_START_UTC_H, minute));
  const today = at(0);
  return today > after ? today : at(1);
}

/** Session 5's sweeper if it has been merged, else null. */
export async function loadSweeper(load: () => Promise<Record<string, unknown>> = () => import("@kutip/solana") as Promise<Record<string, unknown>>): Promise<SweepFn | null> {
  try {
    const fn = (await load()).runDailySweep;
    return typeof fn === "function" ? (fn as SweepFn) : null;
  } catch {
    return null;
  }
}
