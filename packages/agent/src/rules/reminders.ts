/** C1/C2/C4/C5/C6: when the next reminder for an invoice may go out, and in what tone. */
import type { Rulebook } from "../rulebook";
import type { Decision, InvoiceStatus, RuleId } from "./decision";
import { addDays, HOURS_48, parseIsoDate, snapToWindow, zonedTime } from "./time";

export type Tone = "friendly" | "firm" | "final";

export type ReminderInput = {
  invoiceId: string;
  dueDate: string; // YYYY-MM-DD, read in the buyer's zone
  timezone: string; // IANA
  status: InvoiceStatus;
  /** Every outbound message to this buyer (any invoice). Drives the per-48h cap and the overdue count. */
  sent: Array<{ invoiceId: string; at: string }>;
  now: Date;
  rulebook: Rulebook;
  /** Buyer promised to pay on this date (validated by decideReply). Reminders resume the day after. */
  promisedDate?: string;
};

export type ReminderPlan = Decision & {
  sendAt: Date | null;
  tone?: Tone;
  /** True when the schedule stops because the owner must step in. */
  escalate: boolean;
};

const stop = (ruleId: RuleId, reason: string, escalate = false): ReminderPlan => ({ allowed: false, ruleId, reason, sendAt: null, escalate });

export function nextReminder(input: ReminderInput): ReminderPlan {
  const { rulebook, timezone, now } = input;
  const c = rulebook.collections;
  const due = parseIsoDate(input.dueDate);

  switch (input.status) {
    case "paid":
    case "settled":
      return stop("C6", "Payment received, so reminders are cancelled");
    case "seen":
      return stop("C6", "A payment is being checked, so reminders are on hold");
    case "disputed":
      return stop("C4", "The invoice is disputed and waits for the owner", true);
    case "draft":
      return stop("C1", "The invoice has not been sent yet");
  }

  const overdueFrom = zonedTime(addDays(due, 1), 0, timezone);
  const forInvoice = input.sent.filter((s) => s.invoiceId === input.invoiceId);
  const overdueSent = forInvoice.filter((s) => Date.parse(s.at) >= overdueFrom.getTime()).length;
  if (overdueSent >= c.escalateAfterOverdueReminders) {
    return stop("C4", `${overdueSent} overdue reminders sent with no payment, so the owner takes over`, true);
  }

  // Each constraint gives an earliest time; the latest one binds and names the rule.
  const candidates: Array<{ at: number; ruleId: RuleId; reason: string }> = [
    {
      at: forInvoice.length ? now.getTime() : Math.max(now.getTime(), zonedTime(addDays(due, -c.firstReminderDaysBeforeDue), c.quietHoursEnd, timezone).getTime()),
      ruleId: forInvoice.length ? "C2" : "C1",
      reason: forInvoice.length ? "The previous reminder was long enough ago" : `First reminder goes out ${c.firstReminderDaysBeforeDue} days before the due date`,
    },
  ];
  const buyerSends = input.sent.map((s) => Date.parse(s.at)).sort((a, b) => a - b);
  if (buyerSends.length >= c.maxMessagesPer48h) {
    candidates.push({
      at: buyerSends[buyerSends.length - c.maxMessagesPer48h]! + HOURS_48,
      ruleId: "C2",
      reason: `At most ${c.maxMessagesPer48h} message${c.maxMessagesPer48h > 1 ? "s" : ""} per 48 hours to this buyer`,
    });
  }
  if (input.promisedDate) {
    candidates.push({
      at: zonedTime(addDays(parseIsoDate(input.promisedDate), 1), c.quietHoursEnd, timezone).getTime(),
      ruleId: "C5",
      reason: `The buyer promised to pay on ${input.promisedDate}, so reminders wait until the day after`,
    });
  }
  const binding = candidates.reduce((a, b) => (b.at >= a.at ? b : a));
  const sendAt = snapToWindow(new Date(binding.at), timezone, c.quietHoursEnd, c.quietHoursStart);

  const isOverdue = sendAt.getTime() >= overdueFrom.getTime();
  const tone: Tone = !isOverdue ? "friendly" : overdueSent + 1 >= c.escalateAfterOverdueReminders ? "final" : "firm";

  return { allowed: true, ruleId: binding.ruleId, reason: `${binding.reason}, sent in the buyer's working hours`, sendAt, tone, escalate: false };
}
