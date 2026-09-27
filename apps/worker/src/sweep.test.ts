import { expect, test } from "vitest";
import { loadSweeper, nextSweepAt } from "./sweep";

// Window: 10:00–18:00 Malaysia time (02:00–10:00 UTC), at a random minute.
test("picks a random minute in today's window if it is still ahead", () => {
  expect(nextSweepAt(new Date("2026-09-27T00:30:00Z"), 0)).toEqual(new Date("2026-09-27T02:00:00Z"));
  expect(nextSweepAt(new Date("2026-09-27T00:30:00Z"), 0.5)).toEqual(new Date("2026-09-27T06:00:00Z"));
});

test("rolls to tomorrow when today's pick has passed", () => {
  expect(nextSweepAt(new Date("2026-09-27T07:00:00Z"), 0.5)).toEqual(new Date("2026-09-28T06:00:00Z"));
  expect(nextSweepAt(new Date("2026-09-27T20:00:00Z"), 0)).toEqual(new Date("2026-09-28T02:00:00Z")); // 04:00 MYT on the 28th
});

test("stays whole minutes and inside the window even at random → 1", () => {
  const t = nextSweepAt(new Date("2026-09-27T00:00:00Z"), 0.999999);
  expect(t.getTime() % 60_000).toBe(0);
  expect(t < new Date("2026-09-27T10:00:00Z")).toBe(true);
});

test("the sweeper hook is skipped while Session 5 hasn't exported runDailySweep", async () => {
  expect(await loadSweeper(async () => ({}))).toBeNull();
  expect(await loadSweeper(async () => { throw new Error("Cannot find module"); })).toBeNull();
  const fn = async () => {};
  expect(await loadSweeper(async () => ({ runDailySweep: fn }))).toBe(fn);
});
