"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentStatusPill } from "@/components/ui/status-pill";
import { Address } from "@/components/ui/address";
import { data } from "@/lib/ui/data";
import { confidenceLabel, formatDateTime, relativeTime } from "@/lib/ui/format";
import { AGENT_KIND_LABEL } from "@/lib/ui/status";
import type { AgentAction, Buyer } from "@/lib/ui/types";

export function ActionRow({
  action,
  buyers,
  invoiceNumber,
  compact = false,
  onChange,
}: {
  action: AgentAction;
  buyers: Buyer[];
  invoiceNumber?: string;
  compact?: boolean;
  onChange?: (next: AgentAction) => void;
}) {
  const [current, setCurrent] = useState(action);
  const [pending, startTransition] = useTransition();
  const buyer = buyers.find((b) => b.id === current.buyerId);

  function decide(decision: "approved" | "rejected") {
    startTransition(async () => {
      const next = await data.decideAction(current.id, decision);
      if (next) {
        setCurrent(next);
        onChange?.(next);
      }
    });
  }

  return (
    <article className={`grid gap-2 ${compact ? "px-4 py-3 sm:px-6" : "px-4 py-4 sm:px-6"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">{AGENT_KIND_LABEL[current.kind]}</span>
        {buyer ? <span className="text-sm text-ink-2">{buyer.name}</span> : null}
        {invoiceNumber && current.invoiceId ? (
          <Link href={`/invoices/${current.invoiceId}`} className="text-sm tabular text-accent underline-offset-4 hover:underline">
            {invoiceNumber}
          </Link>
        ) : null}
        <span className="ml-auto text-sm tabular text-ink-3" title={formatDateTime(current.createdAt)}>
          {relativeTime(current.createdAt)}
        </span>
      </div>
      <p className="text-base text-ink">{current.decision}</p>
      {compact ? null : <p className="text-base text-ink-2">{current.reason}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <AgentStatusPill status={current.status} />
        <span className="text-sm tabular text-ink-3">
          Rule {current.ruleId} · {confidenceLabel(current.confidence)} confidence
        </span>
        {current.txSignature ? <Address value={current.txSignature} kind="tx" label="View on Solscan" /> : null}
        {current.status === "proposed" ? (
          <span className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={() => decide("rejected")} disabled={pending}>
              Reject
            </Button>
            <Button variant="secondary" onClick={() => decide("approved")} disabled={pending}>
              {pending ? "Approving…" : "Approve"}
            </Button>
          </span>
        ) : null}
      </div>
    </article>
  );
}
