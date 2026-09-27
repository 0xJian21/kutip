import * as schema from "@kutip/db/src/schema";
import { setup } from "@kutip/db/src/testing/fixtures";
import type { Db, Store } from "@kutip/db";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test } from "vitest";
import { average30d, fetchBnmRate, parseRate, updateRate } from "./rates";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8");

/** Serves the recorded BNM responses (noon session, quote=rm) by path. */
function bnmFetch(calls: string[] = []) {
  return (async (url: string, init?: RequestInit) => {
    calls.push(url);
    expect(new Headers(init?.headers).get("accept")).toBe("application/vnd.BNM.API.v1+json");
    const path = new URL(url).pathname;
    const body = path.endsWith("/USD") ? fixture("bnm-latest") : path.endsWith("/month/9") ? fixture("bnm-2026-09") : path.endsWith("/month/8") ? fixture("bnm-2026-08") : null;
    return body ? new Response(body) : new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

test("parseRate turns BNM's float noise into 4-decimal integers without float maths", () => {
  expect(parseRate(4.0774999999999997)).toBe(40775n);
  expect(parseRate(4.0750000000000002)).toBe(40750n);
  expect(parseRate(4.028)).toBe(40280n);
  expect(parseRate(4)).toBe(40000n);
  expect(parseRate(4.12345)).toBe(41235n); // half-up at the 5th decimal
});

test("average30d averages the trading days in the 30 calendar days ending on the rate date", () => {
  const rates = [
    { date: "2026-08-26", myrPerUsd: 99999n }, // 30 days before: outside the window
    { date: "2026-08-27", myrPerUsd: 40000n },
    { date: "2026-09-24", myrPerUsd: 40001n },
    { date: "2026-09-25", myrPerUsd: 40002n },
    { date: "2026-09-26", myrPerUsd: 88888n }, // after the rate date
  ];
  expect(average30d(rates, "2026-09-25")).toBe(40001n);
});

test("fetchBnmRate: latest noon middle rate + 30-day average from the recorded months", async () => {
  const calls: string[] = [];
  const r = await fetchBnmRate(bnmFetch(calls));
  expect(r).toEqual({ date: "2026-09-25", myrPerUsd: 40775n, avg30dMyrPerUsd: 40626n });
  expect(calls.every((u) => u.includes("session=1200") && u.includes("quote=rm"))).toBe(true);
});

describe("updateRate", () => {
  let db: Db;
  let store: Store;
  let exporterId: string;
  beforeEach(async () => ({ db, store, exporterId } = await setup()));

  test("records the rate and raises one cash-out alert per rate date when the margin is beaten (T5)", async () => {
    // 40775 vs avg 40626 (20 trading days, mean 4.06256) = +36 bps. Margin 30 bps → alert.
    const rb = await store.getRulebook(exporterId);
    await store.updateRulebook(exporterId, { ...rb, treasury: { ...rb.treasury, cashOutAlertMarginBps: 30n } });
    const logs: string[] = [];
    await updateRate({ store, fetchFn: bnmFetch(), log: (m) => logs.push(m), now: new Date("2026-09-27T04:00:00Z") });
    await updateRate({ store, fetchFn: bnmFetch(), log: (m) => logs.push(m), now: new Date("2026-09-27T10:00:00Z") });

    // (setup() seeds a later fake rate, so read the recorded row rather than "latest".)
    expect(await db.select().from(schema.fxRates).where(eq(schema.fxRates.date, "2026-09-25"))).toEqual([
      { date: "2026-09-25", myrPerUsd: 40775n, avg30dMyrPerUsd: 40626n },
    ]);
    const alerts = (await store.listAgentActions(exporterId)).filter((a) => a.kind === "cash_out_alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ ruleId: "T5", status: "executed", confidence: 1 });
    expect(alerts[0]!.inputSummary).toBe("BNM USD/MYR 4.0775 vs 30-day average 4.0626 (2026-09-25)");
    expect(alerts[0]!.decision).toBe("Told the owner today's rate is 0.36% above the 30-day average");
  });

  test("no alert under the default 0.5% margin", async () => {
    await updateRate({ store, fetchFn: bnmFetch(), log: () => {}, now: new Date("2026-09-27T04:00:00Z") });
    expect((await store.listAgentActions(exporterId)).filter((a) => a.kind === "cash_out_alert")).toEqual([]);
  });

  test("a BNM outage is logged, not thrown", async () => {
    const logs: string[] = [];
    const down = (async () => new Response("err", { status: 503 })) as unknown as typeof fetch;
    await updateRate({ store, fetchFn: down, log: (m) => logs.push(m), now: new Date() });
    expect(logs.join()).toMatch(/BNM rate update failed/);
  });
});
