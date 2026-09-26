import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK, type Rulebook } from "../rulebook";
import type { ReplyClassification } from "../classifier";
import { decideReply, LOW_CONFIDENCE } from "./replies";

const now = new Date("2026-09-25T16:42:00Z"); // 11:42 in Austin
const input = (classification: ReplyClassification, rulebook: Rulebook = DEFAULT_RULEBOOK) => ({ classification, now, timezone: "America/Chicago", rulebook });

describe("decideReply", () => {
  it("pauses reminders for a dated promise within 7 days (C5)", () => {
    const d = decideReply(input({ label: "will_pay_on_date", confidence: 0.94, extracted: { promisedDate: "2026-10-01" } }));
    expect(d).toMatchObject({ action: "pause", ruleId: "C5", promisedDate: "2026-10-01", allowed: true });
  });

  it("escalates a promise too far out", () => {
    expect(decideReply(input({ label: "will_pay_on_date", confidence: 0.94, extracted: { promisedDate: "2026-10-03" } }))).toMatchObject({ action: "escalate", ruleId: "C5" });
  });

  it("escalates a promised date already in the past, in the buyer's zone", () => {
    expect(decideReply(input({ label: "will_pay_on_date", confidence: 0.9, extracted: { promisedDate: "2026-09-24" } }))).toMatchObject({ action: "escalate" });
  });

  it("ignores a malformed promised date and keeps the schedule", () => {
    expect(decideReply(input({ label: "will_pay_on_date", confidence: 0.9, extracted: { promisedDate: "October 1st" } }))).toMatchObject({ action: "continue", ruleId: "C2" });
  });

  it("keeps the schedule when a promise has no date", () => {
    expect(decideReply(input({ label: "will_pay_on_date", confidence: 0.9 }))).toMatchObject({ action: "continue", ruleId: "C2" });
  });

  it("escalates a dispute (C4)", () => {
    expect(decideReply(input({ label: "dispute", confidence: 0.91 }))).toMatchObject({ action: "escalate", ruleId: "C4", markDisputed: true });
  });

  it("keeps reminding through a dispute when the owner turned that rule off", () => {
    const rulebook: Rulebook = { ...DEFAULT_RULEBOOK, collections: { ...DEFAULT_RULEBOOK.collections, escalateOnDispute: false } };
    expect(decideReply(input({ label: "dispute", confidence: 0.91 }, rulebook))).toMatchObject({ action: "continue", ruleId: "C4" });
  });

  it("escalates a discount above the cap (C3)", () => {
    const d = decideReply(input({ label: "discount_request", confidence: 0.88, extracted: { discountText: "5%" } }));
    expect(d).toMatchObject({ action: "escalate", ruleId: "C3" });
    expect(d.reason).toContain("5%");
  });

  it("lets the agent offer a discount within the cap (C3)", () => {
    expect(decideReply(input({ label: "discount_request", confidence: 0.88, extracted: { discountText: "2%" } }))).toMatchObject({ action: "offer_discount", ruleId: "C3", discountBps: 200n });
  });

  it("escalates a discount request with no size", () => {
    expect(decideReply(input({ label: "discount_request", confidence: 0.88 }))).toMatchObject({ action: "escalate", ruleId: "C3" });
  });

  it("escalates 'already paid' so a human checks (the chain is the authority)", () => {
    expect(decideReply(input({ label: "claims_paid", confidence: 0.95 }))).toMatchObject({ action: "escalate", ruleId: "C4" });
  });

  it("escalates a question", () => {
    expect(decideReply(input({ label: "question", confidence: 0.95 }))).toMatchObject({ action: "escalate" });
  });

  it("keeps the schedule for anything else", () => {
    expect(decideReply(input({ label: "other", confidence: 0.95 }))).toMatchObject({ action: "continue" });
  });

  it("escalates any label below the confidence floor", () => {
    const d = decideReply(input({ label: "will_pay_on_date", confidence: LOW_CONFIDENCE - 0.01, extracted: { promisedDate: "2026-10-01" } }));
    expect(d).toMatchObject({ action: "escalate", ruleId: "C4" });
    expect(d.reason).toMatch(/sure/);
  });
});
