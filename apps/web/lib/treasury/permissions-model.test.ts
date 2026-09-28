import { DEFAULT_RULEBOOK } from "@kutip/agent";
import { describe, expect, it } from "vitest";
import { applyPermissions, describePermissions, permissionsOf } from "./permissions-model";

describe("permissionsOf / applyPermissions", () => {
  it("reads the four permissions out of the rulebook", () => {
    expect(permissionsOf(DEFAULT_RULEBOOK)).toEqual({ dailyCapUsdc: 5_000_000_000n, destination: "treasury", buyerReplies: "draft", remindersAndReceipts: "automatic", maxDiscountPct: 2 });
  });
  it("writes them back without touching the other rules", () => {
    const next = applyPermissions(DEFAULT_RULEBOOK, { dailyCapUsdc: 3_000_000_000n, destination: "treasury", buyerReplies: "routine", remindersAndReceipts: "draft", maxDiscountPct: 1.5 });
    expect(next.treasury.agentDailyLimitUsdc).toBe(3_000_000_000n);
    expect(next.replies).toEqual({ remindersAndReceipts: "draft", buyerReplies: "routine" });
    expect(next.collections.maxDiscountPctWithoutApproval).toBe(1.5);
    expect(next.collections.firstReminderDaysBeforeDue).toBe(3);
    expect(next.treasury.acceptedTokens).toEqual(DEFAULT_RULEBOOK.treasury.acceptedTokens);
  });
  it("rejects a cap of zero and a discount above 20%", () => {
    expect(() => applyPermissions(DEFAULT_RULEBOOK, { ...permissionsOf(DEFAULT_RULEBOOK), dailyCapUsdc: -1n })).toThrow();
    expect(() => applyPermissions(DEFAULT_RULEBOOK, { ...permissionsOf(DEFAULT_RULEBOOK), maxDiscountPct: 25 })).toThrow();
  });
});

describe("describePermissions", () => {
  it("says what the agent may do, in the owner's words", () => {
    const lines = describePermissions(permissionsOf(DEFAULT_RULEBOOK));
    expect(lines[0]).toContain("USD 5,000 per buyer account per day");
    expect(lines[1]).toMatch(/Draft replies/);
    expect(lines[3]).toContain("2% discount");
    expect(describePermissions({ ...permissionsOf(DEFAULT_RULEBOOK), buyerReplies: "off" })[1]).toMatch(/Do not answer/);
  });
});
