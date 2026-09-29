"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentStatusPill, Chip } from "@/components/ui/status-pill";
import { Address } from "@/components/ui/address";
import { decideAction } from "@/lib/data/actions";
import { useApproveProposal } from "@/lib/treasury/use-approve-proposal";
import { MOCK } from "@/lib/ui/data";
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
  const [seed, setSeed] = useState(action);
  if (seed !== action) {
    setSeed(action);
    setCurrent(action);
  }
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { approve, reject, state } = useApproveProposal();
  const buyer = buyers.find((b) => b.id === current.buyerId);
  // Squads proposals carry their index (agent_actions.proposal_index); older rows only say "proposal #N: …" in the summary.
  const proposalIndex = MOCK ? undefined : current.proposalIndex !== undefined ? String(current.proposalIndex) : /^proposal #(\d+)/.exec(current.inputSummary)?.[1];
  const signing = state.status === "signing" || state.status === "sending";

  function update(next: AgentAction) {
    setCurrent(next);
    onChange?.(next);
  }

  function decide(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      try {
        if (proposalIndex) {
          // One passkey prompt (Touch ID): approve + execute, or reject, on-chain; fee paid by Kutip. The route settles the action.
          const signature = decision === "approved" ? await approve(proposalIndex, current.id) : await reject(proposalIndex, current.id);
          update({ ...current, status: decision === "approved" ? "executed" : "rejected", txSignature: signature });
          return;
        }
        const next = await decideAction(current.id, decision);
        if (next) update(next);
      } catch (e) {
        setError(friendlyApproveError((e as Error).message));
      }
    });
  }

  return (
    // Two columns: what happened on the left; the status last, flush right and vertically centred,
    // with Approve / Reject under it while the action waits on the owner.
    <article className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 ${compact ? "px-4 py-3 sm:px-6" : "px-4 py-4 sm:px-6"}`}>
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-sm font-medium text-ink">{AGENT_KIND_LABEL[current.kind]}</span>
          {buyer ? <span className="text-sm text-ink-2">{buyer.name}</span> : null}
          {invoiceNumber && current.invoiceId ? (
            <Link href={`/invoices/${current.invoiceId}`} className="text-sm tabular text-accent underline-offset-4 hover:underline">
              {invoiceNumber}
            </Link>
          ) : null}
          <span className="whitespace-nowrap text-sm tabular text-ink-3" title={formatDateTime(current.createdAt)}>
            {relativeTime(current.createdAt)}
          </span>
        </div>
        <p className="text-base text-ink">{current.decision}</p>
        {compact ? null : <p className="text-base text-ink-2">{current.reason}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <Chip>Rule {current.ruleId}</Chip>
          <Chip>{confidenceLabel(current.confidence)} confidence</Chip>
          {current.txSignature ? <Address value={current.txSignature} kind="tx" label="View on Solscan" /> : null}
        </div>
        {error ? <p role="alert" className="text-sm text-disputed-fg">{error}</p> : null}
        {signing ? <p className="text-sm text-ink-2" aria-live="polite">{state.status === "signing" ? "Your device will ask for Touch ID or Face ID to sign your decision." : "Signed. Sending to Solana…"}</p> : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        <AgentStatusPill status={current.status} />
        {current.status === "proposed" ? (
          <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
            <Button variant="secondary" size="sm" onClick={() => decide("approved")} disabled={pending} className="sm:order-last">
              {state.status === "signing" ? "Confirm with your passkey…" : state.status === "sending" ? "Sending…" : pending ? "Approving…" : "Approve"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => decide("rejected")} disabled={pending}>
              Reject
            </Button>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function friendlyApproveError(msg: string): string {
  if (/passkey first|not authenticated|sign in/i.test(msg)) return "Sign in with your passkey to approve. Your session in this browser has ended.";
  if (/cancel|abort|notallowed|denied|rejected/i.test(msg)) return "Cancelled before your device confirmed. Nothing was signed.";
  if (/session has ended/i.test(msg)) return msg;
  return `Couldn't approve: ${msg}`;
}
