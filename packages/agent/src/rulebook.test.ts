import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK, parseRulebook, replyAutonomy, type Rulebook } from "./rulebook";

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
      replies: { remindersAndReceipts: "automatic", buyerReplies: "draft" },
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

describe("rulebook replies (E3)", () => {
  it("defaults to automatic reminders and receipts, drafts for buyer replies", () => {
    expect(DEFAULT_RULEBOOK.replies).toEqual({ remindersAndReceipts: "automatic", buyerReplies: "draft" });
  });

  it("fills in the default replies section for rulebooks stored before it existed", () => {
    const { replies: _drop, ...legacy } = DEFAULT_RULEBOOK;
    expect(parseRulebook(legacy).replies).toEqual(DEFAULT_RULEBOOK.replies);
  });

  it("rejects an unknown mode", () => {
    expect(() => parseRulebook({ ...DEFAULT_RULEBOOK, replies: { remindersAndReceipts: "automatic", buyerReplies: "always" } })).toThrow();
  });

  describe("replyAutonomy", () => {
    const withMode = (buyerReplies: Rulebook["replies"]["buyerReplies"]): Rulebook => ({ ...DEFAULT_RULEBOOK, replies: { ...DEFAULT_RULEBOOK.replies, buyerReplies } });

    it("drafts everything in the default mode", () => {
      expect(replyAutonomy(DEFAULT_RULEBOOK, "question")).toBe("draft");
      expect(replyAutonomy(DEFAULT_RULEBOOK, "claims_paid")).toBe("draft");
    });

    it("answers routine questions on its own only in routine mode", () => {
      expect(replyAutonomy(withMode("routine"), "question")).toBe("automatic");
      expect(replyAutonomy(withMode("routine"), "claims_paid")).toBe("automatic");
    });

    it("never answers discounts or disputes on its own, whatever the mode", () => {
      expect(replyAutonomy(withMode("routine"), "discount_request")).toBe("draft");
      expect(replyAutonomy(withMode("routine"), "dispute")).toBe("draft");
    });

    it("acknowledges a promised date on its own only when it is within 7 days", () => {
      expect(replyAutonomy(withMode("routine"), "will_pay_on_date", { promiseDays: 7 })).toBe("automatic");
      expect(replyAutonomy(withMode("routine"), "will_pay_on_date", { promiseDays: 8 })).toBe("draft");
      expect(replyAutonomy(withMode("routine"), "will_pay_on_date")).toBe("draft");
    });

    it("is off when the owner turned buyer replies off", () => {
      expect(replyAutonomy(withMode("off"), "question")).toBe("off");
      expect(replyAutonomy(withMode("off"), "dispute")).toBe("off");
    });
  });
});
