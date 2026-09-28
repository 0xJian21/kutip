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
