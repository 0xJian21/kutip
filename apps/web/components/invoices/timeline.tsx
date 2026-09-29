import { AgentStatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { AGENT_KIND_LABEL } from "@/lib/ui/status";
import { confidenceLabel, formatDateTime, localTimeLabel } from "@/lib/ui/format";
import type { AgentAction, Buyer, Message, ReplyIntent } from "@/lib/ui/types";

const INTENT_LABEL: Record<ReplyIntent, string> = {
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
  question: "bg-paper-2 text-ink-2",
  other: "bg-paper-2 text-ink-2",
};

/** Reminder timeline: what the agent did on this invoice, oldest first. */
export function ReminderTimeline({ actions, buyer }: { actions: AgentAction[]; buyer: Buyer }) {
  if (actions.length === 0) {
    return <EmptyState compact title="No reminders yet" body={`The first one goes out 3 days before the due date, in ${localTimeLabel(buyer.timezone)}.`} />;
  }
  const ordered = [...actions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {ordered.map((a) => (
        <li key={a.id} className="relative pb-5 pl-5 last:pb-0">
          <span aria-hidden="true" className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${a.status === "escalated" ? "bg-overdue-fg" : a.status === "proposed" ? "bg-partial-fg" : "bg-accent"}`} />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-ink">{AGENT_KIND_LABEL[a.kind]}</span>
            <span className="text-xs tabular text-ink-3">{formatDateTime(a.createdAt)} MYT</span>
          </div>
          <p className="mt-0.5 text-base text-ink">{a.decision}</p>
          <p className="text-sm text-ink-2">{a.reason}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs tabular text-ink-3">
            <AgentStatusPill status={a.status} />
            <span>Rule {a.ruleId} · {confidenceLabel(a.confidence)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Buyer messages with the agent's classification and confidence on replies. */
export function MessageThread({ messages, buyer }: { messages: Message[]; buyer: Buyer }) {
  if (messages.length === 0) {
    return <EmptyState compact title="No messages yet" body="Reminders and the buyer's replies will appear here." />;
  }
  return (
    <ol className="grid gap-4">
      {messages.map((m) => {
        const inbound = m.direction === "in";
        return (
          <li key={m.id} className={`max-w-[60ch] rounded-md px-4 py-3 ${inbound ? "border border-line bg-paper" : "ml-auto bg-paper-2"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="text-sm font-medium text-ink">{inbound ? buyer.contactName : "Kutip, for you"}</span>
              <span className="text-xs tabular text-ink-3">{formatDateTime(m.createdAt, buyer.timezone)} {localTimeLabel(buyer.timezone)}</span>
            </div>
            <p className="mt-0.5 text-sm text-ink-2">{m.subject}</p>
            {m.toAddress ? (
              <p className="mt-1 text-xs text-ink-3">
                {m.delivery === "sent" ? `Emailed to ${m.toAddress}` : `Not emailed to ${m.toAddress}: ${m.delivery === "skipped" ? "Kutip can only email you until a domain is verified" : m.delivery === "recorded" ? "no email provider set up" : "the email provider refused it"}`}
              </p>
            ) : null}
            <p className="mt-2 text-base text-ink">{m.body}</p>
            {m.classification ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs text-ink-3">
                <span>Agent read this as</span>
                <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${INTENT_CLASS[m.classification.intent]}`}>
                  {INTENT_LABEL[m.classification.intent]}
                </span>
                <span className="tabular">{confidenceLabel(m.classification.confidence)} confidence</span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
