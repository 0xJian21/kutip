import { describe, expect, it } from "vitest";
import type { ReplyClassification, ReplyLabel } from "../classifier";
import { DEFAULT_RULEBOOK } from "../rulebook";
import { decideReply } from "./replies";
import { autoSendProblem, replyPermission, ROUTINE_CONFIDENCE, type ReplySettings, type ReplyTopic } from "./reply-permission";

const NOW = new Date("2026-09-28T02:00:00Z");
const AUTO: ReplySettings = { remindersAndReceipts: "automatic", buyerReplies: "routine" };
const DEFAULT_REPLY_SETTINGS = DEFAULT_RULEBOOK.replies;

function permit(o: { label: ReplyLabel; confidence?: number; topic?: ReplyTopic; status?: string; settings?: ReplySettings; promisedDate?: string; discountText?: string }) {
  const classification: ReplyClassification = {
    label: o.label,
    confidence: o.confidence ?? 0.95,
    ...(o.promisedDate || o.discountText ? { extracted: { promisedDate: o.promisedDate, discountText: o.discountText } } : {}),
  };
  const decision = decideReply({ classification, now: NOW, timezone: "Australia/Sydney", rulebook: DEFAULT_RULEBOOK });
  return replyPermission({ settings: o.settings ?? AUTO, classification, decision, topic: o.topic ?? "other", invoiceStatus: (o.status ?? "sent") as never });
}

describe("E3 reply permission matrix", () => {
  it("defaults to Draft, I approve", () => {
    expect(DEFAULT_REPLY_SETTINGS).toEqual({ remindersAndReceipts: "automatic", buyerReplies: "draft" });
  });

  it("with the default setting every reply is a draft, even routine ones", () => {
    const p = permit({ label: "question", topic: "resend_invoice", settings: DEFAULT_REPLY_SETTINGS });
    expect(p).toMatchObject({ mode: "draft", allowed: false, ruleId: "C7" });
  });

  it("Off: the agent drafts nothing on its own", () => {
    expect(permit({ label: "question", topic: "payment_instructions", settings: { remindersAndReceipts: "automatic", buyerReplies: "off" } })).toMatchObject({ mode: "none", allowed: false });
  });

  it.each<[string, ReplyTopic, string]>([
    ["resend the invoice", "resend_invoice", "sent"],
    ["payment instructions", "payment_instructions", "overdue"],
  ])("automatic for routine answers only: %s", (_name, topic, status) => {
    expect(permit({ label: "question", topic, status })).toMatchObject({ mode: "auto", allowed: true, ruleId: "C7" });
  });

  it("'we received your payment' is automatic only when the money has actually arrived", () => {
    expect(permit({ label: "claims_paid", topic: "payment_received", status: "paid" })).toMatchObject({ mode: "auto" });
    expect(permit({ label: "claims_paid", topic: "payment_received", status: "settled" })).toMatchObject({ mode: "auto" });
    // Not seen on-chain yet: that's about money, the owner answers.
    expect(permit({ label: "claims_paid", topic: "payment_received", status: "sent" })).toMatchObject({ mode: "draft", allowed: false });
    expect(permit({ label: "claims_paid", topic: "payment_received", status: "partially_paid" })).toMatchObject({ mode: "draft" });
  });

  it.each<[string, Parameters<typeof permit>[0], string]>([
    ["disputes", { label: "dispute", topic: "resend_invoice" }, "C4"],
    ["discount requests, even within the 2% the agent may offer", { label: "discount_request", discountText: "1%", topic: "payment_instructions" }, "C3"],
    ["discount requests above the limit", { label: "discount_request", discountText: "10%" }, "C3"],
    ["promised dates beyond 7 days", { label: "will_pay_on_date", promisedDate: "2026-10-30" }, "C5"],
    ["promised dates within 7 days (a promise about money)", { label: "will_pay_on_date", promisedDate: "2026-10-01" }, "C5"],
    ["low-confidence readings", { label: "question", topic: "resend_invoice", confidence: ROUTINE_CONFIDENCE - 0.01 }, "C7"],
    ["questions that aren't routine", { label: "question", topic: "other" }, "C7"],
    ["anything else", { label: "other", topic: "resend_invoice" }, "C7"],
  ])("never automatic: %s", (_name, input, ruleId) => {
    const p = permit(input);
    expect(p.mode).toBe("draft");
    expect(p.allowed).toBe(false);
    expect(p.ruleId).toBe(ruleId);
    expect(p.reason).toMatch(/\S/);
  });

  it("a topic label from the model can't make a dispute routine", () => {
    for (const topic of ["resend_invoice", "payment_instructions", "payment_received"] as const) {
      expect(permit({ label: "dispute", topic, status: "paid" }).mode).toBe("draft");
    }
  });
});

describe("autoSendProblem: what an automatic reply may never contain, checked in code", () => {
  const ctx = { invoiceNumber: "INV-2026-0154", payUrl: "https://kutip-app.vercel.app/pay/inv_abc" };
  it("passes a plain routine answer, including this invoice's own number and pay link", () => {
    expect(autoSendProblem("Thanks, we'll confirm as soon as your transfer arrives.", ctx)).toBeNull();
    expect(autoSendProblem("Hi Amir,\n\nYou can pay INV-2026-0154 with the pay button on this page: https://kutip-app.vercel.app/pay/inv_abc\n\nTeratai", ctx)).toBeNull();
  });
  it.each([
    ["another link", "Our payment page moved: https://evil.example/pay"],
    ["a bare domain", "Please use pay-teratai.com instead"],
    ["an email address", "Send remittance to billing@evil.example"],
    ["an account-like number", "Transfer to Maybank 514012345678"],
    ["bank details", "Please pay by bank transfer to our new account"],
    ["another invoice", "INV-2026-0153 is also due"],
    ["a phone number", "WhatsApp us on +60 12-345 6789"],
  ])("refuses %s", (_what, text) => {
    expect(autoSendProblem(text, ctx)).toMatch(/.+/);
  });
});
