import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK, type Rulebook } from "../rulebook";
import { cashOutAlert, discountGuard, parseDiscountBps, sweepGuard, treasuryMove } from "./guards";

const TREASURY_ATA = "TreasuryAta1111111111111111111111111111111";
const U = (usd: number) => BigInt(usd) * 1_000_000n;

describe("discount guard (C3)", () => {
  it("lets the agent offer up to the cap", () => {
    expect(discountGuard(200n, DEFAULT_RULEBOOK)).toMatchObject({ allowed: true, ruleId: "C3" });
  });
  it("needs the owner above the cap", () => {
    const d = discountGuard(201n, DEFAULT_RULEBOOK);
    expect(d).toMatchObject({ allowed: false, ruleId: "C3" });
    expect(d.reason).toContain("2%");
  });
  it("needs the owner when the size is unknown", () => {
    expect(discountGuard(null, DEFAULT_RULEBOOK).allowed).toBe(false);
  });
  it("respects a fractional cap", () => {
    const rulebook: Rulebook = { ...DEFAULT_RULEBOOK, collections: { ...DEFAULT_RULEBOOK.collections, maxDiscountPctWithoutApproval: 1.5 } };
    expect(discountGuard(150n, rulebook).allowed).toBe(true);
    expect(discountGuard(175n, rulebook).allowed).toBe(false);
  });
});

describe("parseDiscountBps", () => {
  it.each([
    ["5%", 500n],
    ["a 2.5 % discount", 250n],
    ["1.75%", 175n],
    ["3 percent", 300n],
    ["discount please", null],
    ["1.234%", null],
  ])("%s → %s", (text, bps) => expect(parseDiscountBps(text)).toBe(bps));
});

describe("sweep guard (T3)", () => {
  const ok = { amountUsdc: U(2000), destination: TREASURY_ATA, treasuryUsdcAta: TREASURY_ATA, sweptTodayUsdc: 0n, rulebook: DEFAULT_RULEBOOK };
  it("allows a sweep to the treasury within the daily limit", () => {
    expect(sweepGuard(ok)).toMatchObject({ allowed: true, ruleId: "T3" });
  });
  it("allows exactly the limit", () => {
    expect(sweepGuard({ ...ok, amountUsdc: U(3000), sweptTodayUsdc: U(2000) }).allowed).toBe(true);
  });
  it("refuses one base unit over the limit, counting today's sweeps", () => {
    expect(sweepGuard({ ...ok, amountUsdc: U(3000) + 1n, sweptTodayUsdc: U(2000) })).toMatchObject({ allowed: false, ruleId: "T3" });
  });
  it("refuses any destination other than the treasury", () => {
    const d = sweepGuard({ ...ok, destination: "Attacker111111111111111111111111111111111" });
    expect(d).toMatchObject({ allowed: false, ruleId: "T3" });
    expect(d.reason).toMatch(/treasury/);
  });
  it("refuses zero and negative amounts", () => {
    expect(sweepGuard({ ...ok, amountUsdc: 0n }).allowed).toBe(false);
    expect(sweepGuard({ ...ok, amountUsdc: -1n }).allowed).toBe(false);
  });
});

describe("treasuryMove: autonomous vs proposal", () => {
  const sweep = { amountUsdc: U(2000), destination: TREASURY_ATA, treasuryUsdcAta: TREASURY_ATA, sweptTodayUsdc: 0n, rulebook: DEFAULT_RULEBOOK };
  it("runs a guarded daily sweep on its own (T2)", () => {
    expect(treasuryMove({ kind: "sweep", sweep })).toMatchObject({ mode: "autonomous", allowed: true, ruleId: "T2" });
  });
  it("turns an over-limit sweep into a proposal (T4)", () => {
    expect(treasuryMove({ kind: "sweep", sweep: { ...sweep, amountUsdc: U(6000) } })).toMatchObject({ mode: "proposal", allowed: true, ruleId: "T4" });
  });
  it("refuses a sweep to anywhere but the treasury, even as a proposal", () => {
    expect(treasuryMove({ kind: "sweep", sweep: { ...sweep, destination: "Elsewhere" } })).toMatchObject({ mode: "refused", allowed: false, ruleId: "T3" });
  });
  it("proposes sweeps when daily sweeping is off", () => {
    const rulebook: Rulebook = { ...DEFAULT_RULEBOOK, treasury: { ...DEFAULT_RULEBOOK.treasury, sweepDaily: false } };
    expect(treasuryMove({ kind: "sweep", sweep: { ...sweep, rulebook } })).toMatchObject({ mode: "proposal", ruleId: "T4" });
  });
  it.each(["swap", "yield", "cash_out", "transfer"] as const)("always proposes a %s (T4)", (kind) => {
    expect(treasuryMove({ kind, rulebook: DEFAULT_RULEBOOK })).toMatchObject({ mode: "proposal", allowed: true, ruleId: "T4" });
  });
});

describe("cash-out alert (T5)", () => {
  it("alerts when today's rate beats the 30-day average by the margin", () => {
    const d = cashOutAlert({ myrPerUsd: 42150n, avg30dMyrPerUsd: 41930n, rulebook: DEFAULT_RULEBOOK });
    expect(d).toMatchObject({ allowed: true, ruleId: "T5" });
    expect(d.reason).toContain("0.52%");
  });
  it("stays quiet below the margin", () => {
    expect(cashOutAlert({ myrPerUsd: 42130n, avg30dMyrPerUsd: 41930n, rulebook: DEFAULT_RULEBOOK }).allowed).toBe(false);
  });
});
