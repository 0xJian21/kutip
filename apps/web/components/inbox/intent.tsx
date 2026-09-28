import type { ReplyIntent } from "@/lib/ui/types";

export const INTENT_LABEL: Record<ReplyIntent, string> = {
  will_pay_on_date: "Promise to pay",
  dispute: "Dispute",
  discount_request: "Discount request",
  claims_paid: "Says it's paid",
  question: "Question",
  other: "Other",
};

const INTENT_CLASS: Record<ReplyIntent, string> = {
  will_pay_on_date: "bg-seen-bg text-seen-fg",
  dispute: "bg-disputed-bg text-disputed-fg",
  discount_request: "bg-partial-bg text-partial-fg",
  claims_paid: "bg-paid-bg text-paid-fg",
  question: "bg-accent-soft text-accent",
  other: "bg-paper-2 text-ink-2",
};

/** The agent's reading of a buyer message. */
export function IntentChip({ intent }: { intent: ReplyIntent }) {
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${INTENT_CLASS[intent]}`}>{INTENT_LABEL[intent]}</span>;
}
