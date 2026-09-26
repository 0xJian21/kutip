"use client";

import { formatTime } from "@/lib/ui/format";
import type { Invoice } from "@/lib/ui/types";

const STAGES = [
  { key: "sent", label: "Sent", short: "Sent", at: (i: Invoice) => i.sentAt },
  { key: "seen", label: "Payment seen", short: "Seen", at: (i: Invoice) => i.seenAt },
  { key: "paid", label: "Paid", short: "Paid", at: (i: Invoice) => i.paidAt },
  { key: "settled", label: "Settled", short: "Settled", at: (i: Invoice) => i.settledAt },
] as const;

/** How many stages are complete for a status. */
export function stageIndex(status: Invoice["status"]): number {
  switch (status) {
    case "draft":
      return 0;
    case "sent":
    case "overdue":
    case "disputed":
      return 1;
    case "seen":
    case "partially_paid":
      return 2;
    case "paid":
      return 3;
    case "settled":
      return 4;
  }
}

function waitingText(invoice: Invoice): string {
  switch (invoice.status) {
    case "draft":
      return "Not sent yet";
    case "sent":
      return "Waiting for the buyer to pay";
    case "overdue":
      return "Past due, still waiting";
    case "disputed":
      return "Paused: the buyer raised a dispute";
    case "seen":
      return "Checking the payment";
    case "partially_paid":
      return "Part of the amount received; waiting for the rest";
    case "paid":
      return "Received. Becoming final…";
    case "settled":
      return "Final and in your treasury";
  }
}

/**
 * The one orchestrated moment: Sent → Payment seen → Paid → Settled.
 * Segments fill as stages land; with reduced motion they snap.
 */
export function StatusBar({ invoice }: { invoice: Invoice }) {
  const done = stageIndex(invoice.status);
  const live = invoice.status === "seen" || invoice.status === "paid";
  return (
    <div>
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-2" aria-label="Payment progress">
        {STAGES.map((s, i) => {
          const complete = i < done;
          const current = i === done - 1;
          const at = s.at(invoice);
          return (
            <li key={s.key} className="min-w-0" aria-current={current ? "step" : undefined}>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full origin-left rounded-full bg-accent transition-transform duration-(--dur-slow) ease-(--ease-out) ${complete ? "scale-x-100" : "scale-x-0"}`}
                />
              </div>
              <div className={`mt-2 truncate text-sm ${complete ? "font-medium text-ink" : "text-ink-3"}`}>
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              <div className="truncate tabular text-xs text-ink-3">{complete && at ? formatTime(at) : "—"}</div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 flex items-center gap-2 text-base text-ink-2" aria-live="polite">
        {live ? <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
        {waitingText(invoice)}
      </p>
    </div>
  );
}
