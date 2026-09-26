/** What to do with a classified buyer reply. The classifier proposes; this decides. */
import type { ReplyClassification } from "../classifier";
import type { Rulebook } from "../rulebook";
import type { Decision } from "./decision";
import { discountGuard, parseDiscountBps } from "./guards";
import { addDays, formatIsoDate, localParts, parseIsoDate } from "./time";

/** Below this the agent does not act on its reading of a reply. */
export const LOW_CONFIDENCE = 0.7;
/** A promise further out than this is a negotiation, not a date. */
export const MAX_PROMISE_DAYS = 7;

export type ReplyDecision = Decision & {
  action: "pause" | "escalate" | "continue" | "offer_discount";
  promisedDate?: string;
  discountBps?: bigint;
  markDisputed?: boolean;
};

export function decideReply(input: { classification: ReplyClassification; now: Date; timezone: string; rulebook: Rulebook }): ReplyDecision {
  const { classification: c, rulebook } = input;
  if (c.confidence < LOW_CONFIDENCE) {
    return { action: "escalate", allowed: false, ruleId: "C4", reason: "The agent isn't sure what the buyer meant, so the owner reads it" };
  }

  switch (c.label) {
    case "will_pay_on_date": {
      const promised = safeDate(c.extracted?.promisedDate);
      if (!promised) return { action: "continue", allowed: true, ruleId: "C2", reason: "The buyer will pay but gave no date, so reminders continue" };
      const today = formatIsoDate(localParts(input.now, input.timezone));
      const latest = formatIsoDate(addDays(parseIsoDate(today), MAX_PROMISE_DAYS));
      if (promised < today) return { action: "escalate", allowed: false, ruleId: "C5", reason: "The buyer named a payment date that has already passed" };
      if (promised > latest) {
        return { action: "escalate", allowed: false, ruleId: "C5", reason: `The buyer promised ${promised}, more than ${MAX_PROMISE_DAYS} days away` };
      }
      return { action: "pause", allowed: true, ruleId: "C5", promisedDate: promised, reason: `The buyer promised to pay on ${promised}, within ${MAX_PROMISE_DAYS} days` };
    }
    case "dispute":
      return rulebook.collections.escalateOnDispute
        ? { action: "escalate", allowed: false, ruleId: "C4", markDisputed: true, reason: "The buyer raised a problem; any dispute goes to the owner" }
        : { action: "continue", allowed: true, ruleId: "C4", reason: "The buyer raised a problem, but the owner turned off escalation on disputes" };
    case "discount_request": {
      const bps = c.extracted?.discountText ? parseDiscountBps(c.extracted.discountText) : null;
      const guard = discountGuard(bps, rulebook);
      return guard.allowed ? { ...guard, action: "offer_discount", discountBps: bps! } : { ...guard, action: "escalate" };
    }
    case "claims_paid":
      return { action: "escalate", allowed: false, ruleId: "C4", reason: "The buyer says they paid but no matching payment has been seen" };
    case "question":
      return { action: "escalate", allowed: false, ruleId: "C4", reason: "The buyer asked a question only the owner should answer" };
    case "other":
      return { action: "continue", allowed: true, ruleId: "C2", reason: "Nothing in the reply changes the reminder schedule" };
  }
}

function safeDate(s: string | undefined): string | null {
  if (!s) return null;
  try {
    return formatIsoDate(parseIsoDate(s));
  } catch {
    return null;
  }
}
