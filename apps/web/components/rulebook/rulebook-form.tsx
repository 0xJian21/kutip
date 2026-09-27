"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { saveRulebook } from "@/lib/data/actions";
import { formatUsdc, parseUsdc } from "@/lib/ui/money";
import type { Rulebook } from "@/lib/ui/types";

const NUM = "h-8 w-16 rounded-sm border border-line-strong bg-surface px-2 text-center text-base tabular text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

function Rule({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="w-7 shrink-0 text-sm tabular text-ink-3">{id}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-base leading-8 text-ink">{children}</span>
    </li>
  );
}

function Hour({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-base tabular text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>{h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}</option>
      ))}
    </select>
  );
}

/** The rulebook as sentences with the numbers editable in place. */
export function RulebookForm({ initial }: { initial: Rulebook }) {
  const [rb, setRb] = useState(initial);
  const [saved, setSaved] = useState<Rulebook>(initial);
  const [limitText, setLimitText] = useState(formatUsdc(initial.treasury.agentDailyLimitUsdc, 0).replace(/,/g, ""));
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const c = rb.collections;
  const t = rb.treasury;
  const setC = (patch: Partial<Rulebook["collections"]>) => setRb((r) => ({ ...r, collections: { ...r.collections, ...patch } }));
  const setT = (patch: Partial<Rulebook["treasury"]>) => setRb((r) => ({ ...r, treasury: { ...r.treasury, ...patch } }));
  const dirty = JSON.stringify(rb, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) !== JSON.stringify(saved, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

  function toggleToken(tok: "USDC" | "SOL" | "USDT") {
    if (tok === "USDC") return;
    setT({ acceptedTokens: t.acceptedTokens.includes(tok) ? t.acceptedTokens.filter((x) => x !== tok) : [...t.acceptedTokens, tok] });
  }

  function save() {
    const limit = parseUsdc(limitText);
    if (limit === null || limit <= 0n) return setNotice("Enter a daily limit above 0.");
    startTransition(async () => {
      const next = await saveRulebook({ ...rb, treasury: { ...rb.treasury, agentDailyLimitUsdc: limit } });
      setRb(next);
      setSaved(next);
      setNotice("Saved. The agent follows the new rules from its next action.");
      setTimeout(() => setNotice(null), 4000);
    });
  }

  function discard() {
    setRb(saved);
    setLimitText(formatUsdc(saved.treasury.agentDailyLimitUsdc, 0).replace(/,/g, ""));
    setNotice(null);
  }

  return (
    <div className="grid gap-6">
      <Panel title="Collections" aside="How the agent chases invoices">
        <ol className="divide-y divide-line">
          <Rule id="C1">
            Send the first reminder
            <input aria-label="Days before due" type="number" min={0} max={30} className={NUM} value={c.firstReminderDaysBeforeDue} onChange={(e) => setC({ firstReminderDaysBeforeDue: Number(e.target.value) })} />
            days before the due date.
          </Rule>
          <Rule id="C2">
            Send at most
            <input aria-label="Messages per 48 hours" type="number" min={1} max={5} className={NUM} value={c.maxMessagesPer48h} onChange={(e) => setC({ maxMessagesPer48h: Number(e.target.value) })} />
            message every 48 hours, only between
            <Hour label="Quiet hours end" value={c.quietHoursEnd} onChange={(n) => setC({ quietHoursEnd: n })} />
            and
            <Hour label="Quiet hours start" value={c.quietHoursStart} onChange={(n) => setC({ quietHoursStart: n })} />
            in the buyer&apos;s local time.
          </Rule>
          <Rule id="C3">
            Never offer a discount above
            <input aria-label="Max discount percent" type="number" min={0} max={20} step={0.5} className={NUM} value={c.maxDiscountPctWithoutApproval} onChange={(e) => setC({ maxDiscountPctWithoutApproval: Number(e.target.value) })} />
            % without asking you.
          </Rule>
          <Rule id="C4">
            Escalate to you after
            <input aria-label="Overdue reminders before escalation" type="number" min={1} max={10} className={NUM} value={c.escalateAfterOverdueReminders} onChange={(e) => setC({ escalateAfterOverdueReminders: Number(e.target.value) })} />
            overdue reminders with no reply,
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={c.escalateOnDispute} onChange={(e) => setC({ escalateOnDispute: e.target.checked })} className="h-4 w-4 accent-(--accent)" />
              and on any dispute.
            </label>
          </Rule>
        </ol>
      </Panel>

      <Panel title="Treasury" aside="What the agent may do with money">
        <ol className="divide-y divide-line">
          <Rule id="T1">
            Accept
            <span className="inline-flex flex-wrap gap-1.5">
              {(["USDC", "SOL", "USDT"] as const).map((tok) => {
                const on = t.acceptedTokens.includes(tok);
                return (
                  <button key={tok} type="button" aria-pressed={on} disabled={tok === "USDC"} onClick={() => toggleToken(tok)} className={`inline-flex h-7 items-center rounded-full px-2.5 text-sm font-medium transition-colors duration-(--dur-fast) ${on ? "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30" : "bg-paper-2 text-ink-3 hover:text-ink"} disabled:opacity-100`}>
                    {tok}
                  </button>
                );
              })}
            </span>
            <span className="text-ink-2">SOL and USDT are converted to USDC at payment time, so you always receive the exact invoice amount.</span>
          </Rule>
          <Rule id="T2">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={t.sweepDaily} onChange={(e) => setT({ sweepDaily: e.target.checked })} className="h-4 w-4 accent-(--accent)" />
              Sweep buyer accounts into the main treasury once a day
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={t.sweepRandomised} onChange={(e) => setT({ sweepRandomised: e.target.checked })} className="h-4 w-4 accent-(--accent)" />
              at a random time.
            </label>
          </Rule>
          <Rule id="T3">
            The agent may move at most USD
            <input aria-label="Agent daily limit in USD" inputMode="decimal" className={`${NUM} w-24`} value={limitText} onChange={(e) => setLimitText(e.target.value)} />
            per buyer account per day. <span className="text-ink-2">Enforced on chain by a Squads spending limit, not by Kutip.</span>
          </Rule>
          <Rule id="T4">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={t.otherMovementsNeedApproval} onChange={(e) => setT({ otherMovementsNeedApproval: e.target.checked })} className="h-4 w-4 accent-(--accent)" />
              Anything else needs your approval first.
            </label>
          </Rule>
          <Rule id="T5">
            Tell me when the USD to MYR rate beats the 30-day average by
            <input aria-label="Cash-out alert margin in percent" type="number" min={0} max={10} step={0.1} className={NUM} value={Number(t.cashOutAlertMarginBps) / 100} onChange={(e) => setT({ cashOutAlertMarginBps: BigInt(Math.round(Number(e.target.value) * 100)) })} />
            %.
          </Rule>
        </ol>
      </Panel>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 shadow-float">
        <p className="text-base text-ink-2" aria-live="polite">{notice ?? (dirty ? "You have unsaved changes." : "The agent is following these rules.")}</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={discard} disabled={!dirty || pending}>Discard</Button>
          <Button onClick={save} disabled={!dirty || pending}>{pending ? "Saving…" : "Save rules"}</Button>
        </div>
      </div>
    </div>
  );
}
