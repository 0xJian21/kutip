"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bot, CheckCircle2, Mail, Globe, ClipboardPaste, RefreshCw, Sparkles } from "lucide-react";
import type { InboxThreadDetail, ThreadMessage } from "@kutip/db";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { MoneyCell } from "@/components/ui/money";
import { Chip, StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { confidenceLabel, formatDateTime, relativeTime } from "@/lib/ui/format";
import type { BnmRate } from "@/lib/ui/types";
import { approveAndSend, discardDraft, draftReply } from "./actions";
import { IntentChip } from "./intent";

const CHANNEL: Record<ThreadMessage["channel"], { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  pay_page: { label: "Pay page", icon: Globe },
  logged: { label: "Logged by you", icon: ClipboardPaste },
};

const SHOWN_ACTIONS = new Set(["classify_reply", "reply", "reminder", "escalate"]);

export function ThreadView({ detail, rate, busy, onChanged }: { detail: InboxThreadDetail; rate: BnmRate; busy: boolean; onChanged: () => void }) {
  const { invoice, buyer } = detail;
  const [messages, setMessages] = useState(detail.messages);
  const [seed, setSeed] = useState(detail.messages);
  if (seed !== detail.messages) {
    setSeed(detail.messages);
    setMessages(detail.messages);
  }
  const sent = messages.filter((m) => m.status === "sent");
  const draft = messages.find((m) => m.status === "draft");
  const notes = detail.actions.filter((a) => SHOWN_ACTIONS.has(a.kind)).slice(0, 4);
  const outstanding = invoice.amountUsdc - invoice.receivedUsdc;
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className={`grid gap-4 transition-opacity duration-(--dur-fast) ${busy ? "opacity-60" : ""}`}>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={buyer.name} size="md" shape="square" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{buyer.name}</h2>
            <p className="truncate text-sm text-ink-2">
              {buyer.contactName} · {buyer.city}, {buyer.countryName} ·{" "}
              <Link href={`/invoices/${invoice.id}`} className="tabular text-accent underline-offset-4 hover:underline">{invoice.number}</Link>
            </p>
          </div>
          <StatusPill status={invoice.status} />
          <MoneyCell usdc={outstanding > 0n ? outstanding : invoice.amountUsdc} rate={rate} />
        </div>
      </Card>

      <Card>
        {sent.length === 0 ? (
          <EmptyState compact title="No messages yet" body="The first reminder or buyer question starts this thread." />
        ) : (
          <ol className="grid gap-4">
            {sent.map((m) => (
              <Bubble key={m.id} m={m} buyerName={buyer.contactName} />
            ))}
          </ol>
        )}

        <div className="mt-5 border-t border-line pt-5">
          {draft ? (
            <DraftEditor
              key={draft.id}
              draft={draft}
              invoiceId={invoice.id}
              buyerEmail={buyer.email}
              onSent={(body, note) => {
                setNotice(note);
                setMessages((ms) => ms.map((m) => (m.id === draft.id ? { ...m, status: "sent", body, createdAt: new Date().toISOString() } : m)));
                onChanged();
              }}
              onReplaced={(next) => {
                setMessages((ms) => [...ms.filter((m) => m.status !== "draft"), next]);
                onChanged();
              }}
              onDiscarded={() => {
                setMessages((ms) => ms.filter((m) => m.id !== draft.id));
                onChanged();
              }}
            />
          ) : (
            <>
            {notice ? (
              <p role="status" className="mb-3 flex items-center gap-2 text-sm text-ink">
                <CheckCircle2 size={16} aria-hidden="true" className="text-paid-fg" />
                {notice}
              </p>
            ) : null}
            <DraftButton
              invoiceId={invoice.id}
              label={sent.at(-1)?.direction === "in" ? "Draft reply" : "Draft a message"}
              onDrafted={(next) => {
                setNotice(null);
                setMessages((ms) => [...ms, next]);
                onChanged();
              }}
            />
            </>
          )}
        </div>
      </Card>

      {notes.length ? (
        <Card padded={false}>
          <h3 className="flex items-center gap-2 px-5 pt-4 text-sm font-semibold text-ink sm:px-6">
            <Bot size={15} aria-hidden="true" className="text-accent" />
            Agent on this thread
          </h3>
          <ul className="mt-2 divide-y divide-line">
            {notes.map((a) => (
              <li key={a.id} className="grid gap-1 px-5 py-3 sm:px-6">
                <p className="text-sm text-ink">{a.decision}</p>
                <p className="text-sm text-ink-2">{a.reason}</p>
                <p className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Chip>Rule {a.ruleId}</Chip>
                  {a.kind === "classify_reply" ? <Chip>{confidenceLabel(a.confidence)} confidence</Chip> : null}
                  {a.approvedBy ? <Chip tone={a.approvedBy === "agent" ? "accent" : "neutral"}>{a.approvedBy === "agent" ? "Sent by the agent (routine)" : "Approved by you"}</Chip> : null}
                  <span className="ml-auto text-xs tabular text-ink-3" title={formatDateTime(a.createdAt)}>{relativeTime(a.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Bubble({ m, buyerName }: { m: ThreadMessage; buyerName: string }) {
  const inbound = m.direction === "in";
  const ch = CHANNEL[m.channel];
  return (
    <li className={`max-w-[62ch] rounded-lg px-4 py-3 ${inbound ? "border border-line bg-paper" : "ml-auto bg-paper-2"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="text-sm font-medium text-ink">{inbound ? buyerName : "You"}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          <ch.icon size={12} aria-hidden="true" />
          {ch.label} · <time dateTime={m.createdAt} className="tabular">{formatDateTime(m.createdAt)}</time>
        </span>
      </div>
      {m.channel === "email" && m.subject ? <p className="mt-0.5 text-sm text-ink-2">{m.subject}</p> : null}
      <p className="mt-1.5 whitespace-pre-line text-base text-ink">{m.body}</p>
      {inbound ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs text-ink-3">
          {m.classification ? (
            <>
              <span>Agent read this as</span>
              <IntentChip intent={m.classification.intent} />
              <span className="tabular">{confidenceLabel(m.classification.confidence)} confidence</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" className="animate-pulse text-accent" />The agent is reading this…</span>
          )}
        </div>
      ) : null}
    </li>
  );
}

function DraftButton({ invoiceId, label, onDrafted }: { invoiceId: string; label: string; onDrafted: (m: ThreadMessage) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-2">The agent drafts from this invoice’s facts only. You edit and approve before anything is sent.</p>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await draftReply(invoiceId);
            if (r.ok) onDrafted(r.value as ThreadMessage);
            else setError(r.error);
          })
        }
      >
        <Sparkles size={15} aria-hidden="true" />
        {pending ? "Drafting…" : label}
      </Button>
      {error ? <p role="alert" className="w-full text-sm text-disputed-fg">{error}</p> : null}
    </div>
  );
}

function DraftEditor({
  draft,
  invoiceId,
  buyerEmail,
  onSent,
  onReplaced,
  onDiscarded,
}: {
  draft: ThreadMessage;
  invoiceId: string;
  buyerEmail: string;
  onSent: (body: string, note: string) => void;
  onReplaced: (m: ThreadMessage) => void;
  onDiscarded: () => void;
}) {
  const [body, setBody] = useState(draft.body);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const where = draft.channel === "pay_page" ? "on the buyer's pay page" : `by email to ${buyerEmail}, Reply-To you`;

  function run(fn: () => Promise<void>) {
    setError(null);
    start(fn);
  }

  return (
    <section aria-label="Reply draft" className="grid gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={15} aria-hidden="true" className="text-accent" />
          Agent draft
        </h3>
        <Chip tone="accent">Waiting for your approval</Chip>
      </header>
      <Textarea aria-label="Reply" value={body} rows={Math.min(12, Math.max(5, body.split("\n").length + 1))} onChange={(e) => setBody(e.target.value)} />
      <p className="text-sm text-ink-2">Goes out {where}. Discounts, disputes and anything about money always wait for you.</p>
      {error ? <p role="alert" className="text-sm text-disputed-fg">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await discardDraft(draft.id);
              if (r.ok) onDiscarded();
              else setError(r.error);
            })
          }
        >
          Discard
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await draftReply(invoiceId);
              if (r.ok) onReplaced(r.value as ThreadMessage);
              else setError(r.error);
            })
          }
        >
          <RefreshCw size={13} aria-hidden="true" />
          Redraft
        </Button>
        <Button
          size="sm"
          disabled={pending || !body.trim()}
          onClick={() =>
            run(async () => {
              const r = await approveAndSend({ invoiceId, draftId: draft.id, body });
              if (!r.ok) return setError(r.error);
              const d = r.value.delivery;
              onSent(body, d === "shown" ? "Sent. The buyer sees it on their pay page." : d === "sent" ? `Emailed to ${buyerEmail}.` : d === "skipped" ? "Saved to the thread. Email skipped: the address isn't on the demo allowlist." : "Saved to the thread. The email didn't go out; check the email settings.");
            })
          }
        >
          {pending ? "Working…" : "Approve & send"}
        </Button>
      </div>
    </section>
  );
}
