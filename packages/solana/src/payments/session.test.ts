import { describe, expect, it, test } from "vitest";
import { blockingScreening, chooseMode, InFlight, LiveTxCache, RateLimiter, reusableScreening } from "./session";

const T0 = 1_000_000;

describe("LiveTxCache (one live tx per invoice)", () => {
  test("returns the same built tx for the same invoice + buyer while it is fresh", () => {
    const c = new LiveTxCache({ ttlMs: 45_000 });
    c.set("inv1", "buyerA", "tx-a", T0);
    expect(c.get("inv1", "buyerA", T0 + 44_000)).toBe("tx-a");
  });
  test("expires after the ttl", () => {
    const c = new LiveTxCache({ ttlMs: 45_000 });
    c.set("inv1", "buyerA", "tx-a", T0);
    expect(c.get("inv1", "buyerA", T0 + 45_001)).toBeUndefined();
  });
  test("a different buyer never receives another wallet's tx", () => {
    const c = new LiveTxCache({ ttlMs: 45_000 });
    c.set("inv1", "buyerA", "tx-a", T0);
    expect(c.get("inv1", "buyerB", T0 + 1)).toBeUndefined();
  });
  test("a new build replaces the live tx for that invoice", () => {
    const c = new LiveTxCache({ ttlMs: 45_000 });
    c.set("inv1", "buyerA", "tx-a", T0);
    c.set("inv1", "buyerB", "tx-b", T0 + 1);
    expect(c.get("inv1", "buyerA", T0 + 2)).toBeUndefined();
    expect(c.get("inv1", "buyerB", T0 + 2)).toBe("tx-b");
  });
});

describe("RateLimiter (sliding window)", () => {
  it("forgets keys whose window has passed, so random wallet keys can't grow it forever", () => {
    const r = new RateLimiter({ limit: 1, windowMs: 1_000 });
    for (let i = 0; i < 5_000; i++) r.allow(`wallet:${i}`, 0);
    for (let i = 0; i < 5_000; i++) r.allow(`later:${i}`, 10_000);
    expect(r.size()).toBe(5_000); // the first 5,000 expired and were dropped
  });
  test("allows up to the limit within the window, then refuses", () => {
    const r = new RateLimiter({ limit: 3, windowMs: 60_000 });
    expect(r.allow("k", T0)).toBe(true);
    expect(r.allow("k", T0 + 1)).toBe(true);
    expect(r.allow("k", T0 + 2)).toBe(true);
    expect(r.allow("k", T0 + 3)).toBe(false);
  });
  test("frees a slot once the oldest hit leaves the window", () => {
    const r = new RateLimiter({ limit: 2, windowMs: 60_000 });
    r.allow("k", T0);
    r.allow("k", T0 + 10_000);
    expect(r.allow("k", T0 + 59_999)).toBe(false);
    expect(r.allow("k", T0 + 60_001)).toBe(true);
  });
  test("keys are independent", () => {
    const r = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(r.allow("a", T0)).toBe(true);
    expect(r.allow("b", T0)).toBe(true);
  });
});

describe("chooseMode", () => {
  const accepted = ["USDC", "SOL", "USDT"] as const;
  test("explicit token wins when accepted and enabled", () => {
    expect(chooseMode({ token: "SOL", accepted, solEnabled: true, usdcBalance: 10n, amount: 1n })).toEqual({ mode: "sol" });
  });
  test("explicit SOL while the fallback flag is off is refused with a wallet-facing message", () => {
    expect(chooseMode({ token: "SOL", accepted, solEnabled: false, usdcBalance: 10n, amount: 1n })).toEqual({ error: "SOL payments are temporarily unavailable; please pay in USDC" });
  });
  test("explicit token the exporter does not accept is refused", () => {
    expect(chooseMode({ token: "USDT", accepted: ["USDC"], solEnabled: true, usdcBalance: 10n, amount: 1n })).toEqual({ error: "This invoice accepts USDC" });
  });
  test("auto: USDC when the buyer holds enough", () => {
    expect(chooseMode({ accepted, solEnabled: true, usdcBalance: 5n, amount: 5n })).toEqual({ mode: "usdc" });
  });
  test("auto: SOL when USDC is short and SOL is accepted + enabled", () => {
    expect(chooseMode({ accepted, solEnabled: true, usdcBalance: 4n, amount: 5n })).toEqual({ mode: "sol" });
  });
  test("auto: USDC (and its balance error) when USDC is short and nothing else is available", () => {
    expect(chooseMode({ accepted: ["USDC"], solEnabled: true, usdcBalance: 4n, amount: 5n })).toEqual({ mode: "usdc" });
    expect(chooseMode({ accepted, solEnabled: false, usdcBalance: 4n, amount: 5n })).toEqual({ mode: "usdc" });
  });
  test("unknown token string is refused", () => {
    expect(chooseMode({ token: "BONK", accepted, solEnabled: true, usdcBalance: 0n, amount: 1n })).toEqual({ error: "This invoice accepts USDC, SOL, USDT" });
  });
});

describe("reusableScreening", () => {
  const now = new Date("2026-09-30T02:00:00Z");
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

  it("reuses a pass from the last 24 hours", () => {
    expect(reusableScreening({ result: "pass", reasons: ["ok"], createdAt: at(23) }, now)).toEqual({ result: "pass", reasons: ["ok", "reused screening from the last 24 h"] });
  });

  it("screens again after 24 hours, after a flag, or with no record", () => {
    expect(reusableScreening({ result: "pass", reasons: [], createdAt: at(25) }, now)).toBeNull();
    expect(reusableScreening({ result: "flag", reasons: [], createdAt: at(1) }, now)).toBeNull();
    expect(reusableScreening(null, now)).toBeNull();
  });
});

describe("InFlight", () => {
  it("shares one run between concurrent callers with the same key", async () => {
    const f = new InFlight<number>();
    let calls = 0;
    let release!: (n: number) => void;
    const work = () => { calls++; return new Promise<number>((r) => (release = r)); };
    const a = f.run("inv:wallet", work);
    const b = f.run("inv:wallet", work);
    release(7);
    expect(await Promise.all([a, b])).toEqual([7, 7]);
    expect(calls).toBe(1);
  });

  it("runs again once the first run settled, and keys are independent", async () => {
    const f = new InFlight<string>();
    let calls = 0;
    await f.run("k", async () => { calls++; return "x"; });
    await f.run("k", async () => { calls++; return "y"; });
    await Promise.all([f.run("a", async () => { calls++; return "a"; }), f.run("b", async () => { calls++; return "b"; })]);
    expect(calls).toBe(4);
  });

  it("forgets a failed run so the next caller retries", async () => {
    const f = new InFlight<string>();
    await expect(f.run("k", async () => { throw new Error("rpc down"); })).rejects.toThrow("rpc down");
    expect(await f.run("k", async () => "ok")).toBe("ok");
  });
});

describe("blockingScreening (a recorded flag blocks the wallet)", () => {
  const now = new Date("2026-09-30T02:00:00Z");
  it("a flag, however old, blocks until the owner clears it", () => {
    expect(blockingScreening({ result: "flag", reasons: ["first transaction involved a sanctioned address"], createdAt: "2026-01-01T00:00:00Z" })).toEqual({ result: "flag", reasons: ["first transaction involved a sanctioned address", "flagged by an earlier check"] });
  });
  it("a flag that only means the RPC was down does not block (screen again)", () => {
    expect(blockingScreening({ result: "flag", reasons: ["wallet could not be screened: timeout"], createdAt: now.toISOString() })).toBeNull();
  });
  it("a pass or no record does not block", () => {
    expect(blockingScreening({ result: "pass", reasons: [], createdAt: now.toISOString() })).toBeNull();
    expect(blockingScreening(null)).toBeNull();
  });
});
