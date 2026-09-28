"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Fingerprint, Mail, ShieldCheck } from "lucide-react";
import type { AgendaEvent, CommandPreview, InvoiceLine } from "@kutip/agent";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Inset } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Amount, MoneyCell } from "@/components/ui/money";
import { Chip, StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { formatDate, formatTime, dueLabel } from "@/lib/ui/format";
import { formatRate, formatUsdc, type BnmRate } from "@/lib/ui/money";
import { sendCommandReminder } from "./actions";

export type Preview = CommandPreview & { via?: "jev" | "haiku" };

/** What the agent proposes for one command. Reads are shown; anything that acts waits for a button. */
export function PreviewCard({ preview, onAsk, onDone }: { preview: Preview; onAsk: (text: string) => void; onDone?: () => void }) {
  switch (preview.kind) {
    case "invoices":
      return (
        <section aria-label={preview.title}>
          <Heading title={preview.title} aside={preview.lines.length ? `${preview.lines.length} ${preview.lines.length === 1 ? "invoice" : "invoices"}` : undefined} />
          {preview.lines.length === 0 ? (
            <EmptyState compact title="Nothing here" body="No invoices match right now." />
          ) : (
            <>
              <InvoiceRows lines={preview.lines} rate={preview.rate} onNavigate={onDone} />
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm text-ink-2">Still to collect</span>
                <MoneyCell usdc={preview.totalOutstandingUsdc} rate={preview.rate} />
              </div>
            </>
          )}
        </section>
      );
    case "invoice":
      return (
        <section aria-label={preview.line.number}>
          <Heading title={preview.line.number} aside={<StatusPill status={preview.line.status} />} />
          <InvoiceRows lines={[preview.line]} rate={preview.rate} onNavigate={onDone} />
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={`/invoices/${preview.line.id}`} size="sm" variant="secondary" onClick={onDone}>Open invoice</ButtonLink>
            {!["paid", "settled", "disputed"].includes(preview.line.status) ? (
              <Button size="sm" variant="ghost" onClick={() => onAsk(`Remind about ${preview.line.number}`)}>Draft a reminder</Button>
            ) : null}
          </div>
        </section>
      );
    case "reminder":
      return <ReminderPreview preview={preview} onDone={onDone} />;
    case "sweep":
      return (
        <section aria-label="Sweep preview">
          <Heading title="Sweep into the treasury" aside={<Chip>Preview</Chip>} />
          {preview.vaults.length === 0 ? (
            <EmptyState compact title="Nothing waiting" body="Every buyer account is empty; payments are already in the treasury." />
          ) : (
            <>
              <ul className="mt-2 divide-y divide-line">
                {preview.vaults.map((v) => (
                  <li key={v.buyerName} className="flex items-center gap-3 py-2.5">
                    <Avatar name={v.buyerName} size="sm" shape="square" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-ink">{v.buyerName}</span>
                      <span className="block text-xs text-ink-3">{v.mode === "autonomous" ? "Within the agent's daily limit" : v.mode === "proposal" ? "Needs your approval" : v.reason}</span>
                    </span>
                    <Chip>Rule {v.ruleId}</Chip>
                    <MoneyCell usdc={v.amountUsdc} rate={preview.rate} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm text-ink-2">Total to the treasury</span>
                <MoneyCell usdc={preview.totalUsdc} rate={preview.rate} />
              </div>
              <Confirm note="Network fee paid by Kutip (about 0.00002 SOL). The spending limit on Solana is the final check.">
                <ButtonLink href="/treasury?action=sweep" size="sm" onClick={onDone}>
                  Review & sweep
                  <ArrowRight size={14} aria-hidden="true" />
                </ButtonLink>
              </Confirm>
            </>
          )}
        </section>
      );
    case "cash_out":
      return (
        <section aria-label="Cash-out preview">
          <Heading title="Cash out to ringgit" aside={<Chip>Indicative</Chip>} />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Amount sen={preview.myrSen} size="lg" />
              <p className="mt-1 text-sm tabular text-ink-2">
                {formatUsdc(preview.amountUsdc)} USD · BNM rate {formatRate(preview.rate)}
              </p>
            </div>
            <div className="text-right text-sm text-ink-2">
              <p>To {preview.destination ?? "no exchange address yet"}</p>
              <p className="tabular">Treasury holds {formatUsdc(preview.treasuryUsdc)} USD</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-2">The exchange’s own rate and fee apply when you sell for ringgit there.</p>
          {preview.allowed ? (
            <Confirm note={preview.reason} icon="passkey">
              <ButtonLink href={`/treasury?action=cashout&usdc=${preview.amountUsdc}`} size="sm" onClick={onDone}>
                Review cash-out
                <ArrowRight size={14} aria-hidden="true" />
              </ButtonLink>
            </Confirm>
          ) : (
            <p role="alert" className="mt-3 text-sm text-disputed-fg">{preview.reason}.</p>
          )}
        </section>
      );
    case "agenda":
      return <AgendaList from={preview.from} to={preview.to} events={preview.events} onNavigate={onDone} />;
    case "clarify":
      return (
        <section aria-label="The agent needs more detail">
          <p className="text-base text-ink">{preview.message}</p>
          {preview.options.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {preview.options.map((o) => (
                <Button key={o} size="sm" variant="outline" onClick={() => onAsk(o)}>{o}</Button>
              ))}
            </div>
          ) : null}
        </section>
      );
    case "help":
      return (
        <section aria-label="What the agent can do">
          <p className="text-base text-ink">{preview.message}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {preview.examples.map((o) => (
              <Button key={o} size="sm" variant="outline" onClick={() => onAsk(o)}>{o}</Button>
            ))}
          </div>
        </section>
      );
  }
}

function Heading({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h3 className="text-md font-semibold text-ink">{title}</h3>
      {aside ? <span className="shrink-0 text-sm text-ink-2">{aside}</span> : null}
    </header>
  );
}

function InvoiceRows({ lines, rate, onNavigate }: { lines: InvoiceLine[]; rate: BnmRate; onNavigate?: () => void }) {
  return (
    <ul className="mt-2 divide-y divide-line">
      {lines.map((l) => (
        <li key={l.id}>
          <Link href={`/invoices/${l.id}`} onClick={onNavigate} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-(--dur-fast) hover:bg-paper-2/60">
            <Avatar name={l.buyerName} size="sm" shape="square" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base text-ink">{l.buyerName}</span>
              <span className="block truncate text-sm tabular text-ink-2">
                {l.number} · <span className={l.status === "overdue" ? "font-medium text-overdue-fg" : ""}>{dueLabel(l.dueDate)}</span>
              </span>
            </span>
            <span className="hidden sm:inline-flex"><StatusPill status={l.status} /></span>
            <MoneyCell usdc={l.outstandingUsdc} rate={rate} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Confirm({ note, icon = "shield", children }: { note: string; icon?: "shield" | "passkey"; children: React.ReactNode }) {
  const Icon = icon === "passkey" ? Fingerprint : ShieldCheck;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-paper-2 px-3.5 py-3">
      <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-ink-2">
        <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <span>{note}</span>
      </p>
      {children}
    </div>
  );
}

function ReminderPreview({ preview, onDone }: { preview: Extract<Preview, { kind: "reminder" }>; onDone?: () => void }) {
  const [subject, setSubject] = useState(preview.email.subject);
  const [body, setBody] = useState(preview.email.body);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: true; delivery: string } | { ok: false; error: string } | null>(null);

  function send() {
    start(async () => {
      const r = await sendCommandReminder({ invoiceId: preview.line.id, subject, body });
      setResult(r.ok ? { ok: true, delivery: r.value.delivery } : { ok: false, error: r.error });
    });
  }

  if (result?.ok) {
    return (
      <p role="status" className="flex items-center gap-2 text-base text-ink">
        <CheckCircle2 size={18} aria-hidden="true" className="text-paid-fg" />
        {result.delivery === "sent" ? `Reminder emailed to ${preview.to}.` : result.delivery === "skipped" ? "Reminder recorded. Email skipped: the address isn't on the demo allowlist." : "Reminder recorded in the thread."}
        {" "}
        <Link href={`/inbox?thread=${preview.line.id}`} onClick={onDone} className="font-medium text-accent underline-offset-4 hover:underline">Open thread</Link>
      </p>
    );
  }
  return (
    <section aria-label="Reminder draft">
      <Heading title={`Reminder for ${preview.line.number}`} aside={<Chip tone="accent">Draft</Chip>} />
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
        <Mail size={14} aria-hidden="true" /> To {preview.line.buyerName} · {preview.to}
      </p>
      <div className="mt-3 grid gap-3">
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message"><Textarea value={body} rows={7} onChange={(e) => setBody(e.target.value)} /></Field>
      </div>
      <Confirm note={`${preview.ruleNote} Rule ${preview.ruleId}. Nothing is sent until you press Send.`}>
        <span className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={send} disabled={pending || !subject.trim() || !body.trim()}>{pending ? "Sending…" : "Send reminder"}</Button>
        </span>
      </Confirm>
      {result && !result.ok ? <p role="alert" className="mt-2 text-sm text-disputed-fg">{result.error}</p> : null}
    </section>
  );
}

const KIND_LABEL: Record<AgendaEvent["kind"], string> = { due: "Due", promised: "Promised", reminder: "Reminder", sweep: "Sweep", rate_alert: "Rate alert" };
const KIND_TONE: Record<AgendaEvent["kind"], string> = {
  due: "bg-overdue-bg text-overdue-fg",
  promised: "bg-seen-bg text-seen-fg",
  reminder: "bg-accent-soft text-accent",
  sweep: "bg-paid-bg text-paid-fg",
  rate_alert: "bg-partial-bg text-partial-fg",
};

export function AgendaBadge({ kind }: { kind: AgendaEvent["kind"] }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium ${KIND_TONE[kind]}`}>{KIND_LABEL[kind]}</span>;
}

function AgendaList({ from, to, events, onNavigate }: { from: string; to: string; events: AgendaEvent[]; onNavigate?: () => void }) {
  const days = [...new Set(events.map((e) => e.date))];
  return (
    <section aria-label="This week">
      <Heading title="Your next 7 days" aside={<Link href="/calendar" onClick={onNavigate} className="inline-flex items-center gap-1 font-medium text-accent underline-offset-4 hover:underline"><CalendarDays size={14} aria-hidden="true" />Calendar</Link>} />
      <p className="text-sm text-ink-3">{formatDate(from)} – {formatDate(to)}</p>
      {events.length === 0 ? (
        <EmptyState compact title="A quiet week" body="No due dates, promised payments, reminders or sweeps planned." />
      ) : (
        <ol className="mt-2 grid gap-3">
          {days.map((d) => (
            <li key={d}>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{formatDate(d)}</p>
              <ul className="mt-1 grid gap-1">
                {events.filter((e) => e.date === d).map((e, i) => (
                  <li key={`${e.kind}-${e.invoiceId ?? i}`}>
                    <Inset className="flex items-center gap-2.5 px-3 py-2">
                      <AgendaBadge kind={e.kind} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {e.invoiceId ? <Link href={`/invoices/${e.invoiceId}`} onClick={onNavigate} className="hover:underline">{e.label}</Link> : e.label}
                        {e.buyerName && e.kind !== "promised" ? <span className="text-ink-2"> · {e.buyerName}</span> : null}
                      </span>
                      {e.at && e.kind !== "rate_alert" ? <span className="text-xs tabular text-ink-3">{formatTime(e.at, "Asia/Kuala_Lumpur", false)}</span> : null}
                      {e.amountUsdc !== undefined ? <span className="text-sm tabular text-ink-2">{formatUsdc(e.amountUsdc)} USD</span> : null}
                    </Inset>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
