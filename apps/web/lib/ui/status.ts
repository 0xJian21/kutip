/** Invoice status vocabulary: plain English labels and the one place colour talks. */

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "seen"
  | "paid"
  | "settled"
  | "partially_paid"
  | "overdue"
  | "disputed";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  seen: "Payment seen",
  paid: "Paid",
  settled: "Settled",
  partially_paid: "Partly paid",
  overdue: "Overdue",
  disputed: "Disputed",
};

/** One-line meaning shown in tooltips and the status legend. */
export const INVOICE_STATUS_HINT: Record<InvoiceStatus, string> = {
  draft: "Not sent to the buyer yet",
  sent: "Waiting for payment",
  seen: "A payment has appeared and is being checked",
  paid: "Payment received",
  settled: "Payment final and in your treasury",
  partially_paid: "Some of the amount has been received",
  overdue: "Past its due date and unpaid",
  disputed: "The buyer raised a problem; needs you",
};

export const INVOICE_STATUS_CLASS: Record<InvoiceStatus, string> = {
  draft: "bg-paper-2 text-ink-2 ring-1 ring-inset ring-line",
  sent: "bg-paper-2 text-ink-2",
  seen: "bg-seen-bg text-seen-fg",
  paid: "bg-paid-bg text-paid-fg",
  settled: "bg-settled-bg text-settled-fg",
  partially_paid: "bg-partial-bg text-partial-fg",
  overdue: "bg-overdue-bg text-overdue-fg",
  disputed: "bg-disputed-bg text-disputed-fg",
};

export type AgentActionStatus = "proposed" | "approved" | "executed" | "rejected" | "escalated";

export const AGENT_STATUS_LABEL: Record<AgentActionStatus, string> = {
  proposed: "Needs your approval",
  approved: "Approved",
  executed: "Done",
  rejected: "Rejected",
  escalated: "Escalated to you",
};

export const AGENT_STATUS_CLASS: Record<AgentActionStatus, string> = {
  proposed: "bg-partial-bg text-partial-fg",
  approved: "bg-seen-bg text-seen-fg",
  executed: "bg-paid-bg text-paid-fg",
  rejected: "bg-paper-2 text-ink-2",
  escalated: "bg-overdue-bg text-overdue-fg",
};

export type AgentActionKind =
  | "reminder"
  | "classify_reply"
  | "sweep"
  | "sweep_proposal"
  | "escalate"
  | "cash_out_alert"
  | "extract_invoice"
  | "cancel_reminders";

export const AGENT_KIND_LABEL: Record<AgentActionKind, string> = {
  reminder: "Reminder",
  classify_reply: "Buyer reply",
  sweep: "Sweep",
  sweep_proposal: "Sweep proposal",
  escalate: "Escalation",
  cash_out_alert: "Cash-out alert",
  extract_invoice: "Invoice read",
  cancel_reminders: "Payment received",
};
