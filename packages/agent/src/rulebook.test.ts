import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK, parseRulebook } from "./rulebook";

describe("rulebook", () => {
  it("defaults match SPEC §4", () => {
    expect(DEFAULT_RULEBOOK).toEqual({
      collections: {
        firstReminderDaysBeforeDue: 3,
        maxMessagesPer48h: 1,
        quietHoursStart: 18,
        quietHoursEnd: 9,
        maxDiscountPctWithoutApproval: 2,
        escalateAfterOverdueReminders: 2,
        escalateOnDispute: true,
      },
      treasury: {
        acceptedTokens: ["USDC", "SOL", "USDT"],
        sweepDaily: true,
        sweepRandomised: true,
        agentDailyLimitUsdc: 5_000_000_000n,
        otherMovementsNeedApproval: true,
        cashOutAlertMarginBps: 50n,
      },
    });
  });

  it("round-trips through JSON (bigints stored as digit strings in jsonb)", () => {
    const json = JSON.parse(
      JSON.stringify(DEFAULT_RULEBOOK, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
    expect(parseRulebook(json)).toEqual(DEFAULT_RULEBOOK);
  });

  it("rejects a fractional USDC limit", () => {
    const bad = { ...DEFAULT_RULEBOOK, treasury: { ...DEFAULT_RULEBOOK.treasury, agentDailyLimitUsdc: "5000.5" } };
    expect(() => parseRulebook(bad)).toThrow();
  });

  it("rejects a discount cap above 20% and a zero message allowance", () => {
    const c = DEFAULT_RULEBOOK.collections;
    expect(() => parseRulebook({ ...DEFAULT_RULEBOOK, collections: { ...c, maxDiscountPctWithoutApproval: 25 } })).toThrow();
    expect(() => parseRulebook({ ...DEFAULT_RULEBOOK, collections: { ...c, maxMessagesPer48h: 0 } })).toThrow();
  });

  it("rejects a quiet-hours window that leaves no sending hours", () => {
    const c = DEFAULT_RULEBOOK.collections;
    expect(() => parseRulebook({ ...DEFAULT_RULEBOOK, collections: { ...c, quietHoursStart: 9, quietHoursEnd: 9 } })).toThrow();
  });
});
