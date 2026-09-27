import { describe, expect, test } from "vitest";
import { chooseMode, LiveTxCache, RateLimiter } from "./session";

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
