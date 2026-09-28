/**
 * Agent reply permission (IMPROVEMENTS E3, rule C7). The owner's rulebook `replies.buyerReplies` (Session 8b):
 * "draft" (default: the agent drafts, the owner approves), "routine" (routine answers only), or "off".
 * Never automatic whatever the setting: disputes (C4), discounts (C3), promised dates (C5), anything about
 * money that hasn't arrived, low-confidence readings. The model only proposes the topic; this decides.
 * Stricter than rulebook.ts `replyAutonomy` (intent only): routine also needs a routine topic, and
 * "we received your payment" needs the money to have arrived. The inbox enforces this one.
 */
import type { ReplyClassification } from "../classifier";
import type { Rulebook } from "../rulebook";
import type { Decision, InvoiceStatus } from "./decision";
import type { ReplyDecision } from "./replies";

export type ReplySettings = Rulebook["replies"];

/** What a reply answers, as proposed by the drafting model. Only the first three can ever be routine. */
export const REPLY_TOPICS = ["resend_invoice", "payment_instructions", "payment_received", "other"] as const;
export type ReplyTopic = (typeof REPLY_TOPICS)[number];

/** Below this the agent never answers on its own. Stricter than LOW_CONFIDENCE, which only gates reading. */
export const ROUTINE_CONFIDENCE = 0.85;

const MONEY_IN: InvoiceStatus[] = ["paid", "settled"];

export type ReplyPermission = Decision & { mode: "auto" | "draft" | "none" };

export function replyPermission(input: {
  settings: ReplySettings;
  classification: ReplyClassification;
  decision: ReplyDecision;
  topic: ReplyTopic;
  invoiceStatus: InvoiceStatus;
}): ReplyPermission {
  const { settings, classification: c, decision, topic } = input;
  if (settings.buyerReplies === "off") {
    return { mode: "none", allowed: false, ruleId: "C7", reason: "Replies to buyer messages are off, so you answer this one yourself" };
  }
  const draft = (ruleId: Decision["ruleId"], reason: string): ReplyPermission => ({ mode: "draft", allowed: false, ruleId, reason });

  // Never automatic, whatever the setting.
  if (c.label === "dispute") return draft("C4", "Disputes always go to you; the agent only drafts");
  if (c.label === "discount_request") return draft("C3", "Anything about a discount needs your approval");
  if (c.label === "will_pay_on_date") return draft("C5", "A promised payment date is about money, so you confirm the reply");
  if (c.confidence < ROUTINE_CONFIDENCE) return draft("C7", "The agent isn't sure enough of what the buyer meant to answer alone");
  if (c.label === "claims_paid" && !MONEY_IN.includes(input.invoiceStatus)) {
    return draft(decision.ruleId, "The buyer says they paid but the money hasn't arrived, so you answer");
  }

  const routine =
    (c.label === "question" && (topic === "resend_invoice" || topic === "payment_instructions")) ||
    (c.label === "claims_paid" && topic === "payment_received" && MONEY_IN.includes(input.invoiceStatus));
  if (!routine) return draft("C7", "Only routine answers (resend invoice, how to pay, payment received) can go out automatically");
  if (settings.buyerReplies !== "routine") return draft("C7", "Your setting is Draft, I approve, so this waits for you");
  return { mode: "auto", allowed: true, ruleId: "C7", reason: "A routine answer, and you let the agent send those automatically" };
}

/**
 * Last gate before an automatic reply goes out (the owner never sees it first). The buyer's message is
 * untrusted input to the drafting model, so the draft may only point at this invoice and its own pay link:
 * no other links or domains, email addresses, account or phone numbers, bank-transfer wording or other
 * invoices. Returns the problem, or null. A problem turns the reply into a draft for the owner.
 */
export function autoSendProblem(text: string, own: { invoiceNumber: string; payUrl: string }): string | null {
  const t = text.split(own.payUrl).join(" ").split(own.invoiceNumber).join(" ");
  if (/https?:\/\/|www\./i.test(t) || /\b[a-z0-9-]+\.(?:com|net|org|io|co|my|app|xyz|info|biz|link|site|online|pay)\b/i.test(t)) return "it contains a link other than the invoice's pay page";
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) return "it contains an email address";
  if (/\d(?:[\s-]?\d){5,}/.test(t)) return "it contains a long number (account or phone)";
  if (/\b(bank|transfer|iban|swift|account (?:no|number)|wire|remit\w*|whatsapp|telegram|cheque|check payable)\b/i.test(t)) return "it mentions another way to pay or contact";
  const others = [...t.matchAll(/\bINV-\d{4}-\d{3,}\b/gi)].filter((m) => m[0].toUpperCase() !== own.invoiceNumber.toUpperCase());
  if (others.length) return `it mentions another invoice (${others[0]![0]})`;
  return null;
}
