"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Address } from "@/components/ui/address";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Inset } from "@/components/ui/card";
import { MoneyCell } from "@/components/ui/money";
import { Facts } from "@/components/ui/panel";
import { Chip } from "@/components/ui/status-pill";
import { Skeleton } from "@/components/ui/states";
import { Stepper } from "@/components/ui/stepper";
import { sweepNow, sweepPreview, type SweepExecution, type SweepPreview } from "@/lib/data/treasury-actions";
import { defaultSelection, selectable, summariseSelection, type SweepAccount } from "@/lib/treasury/sweep-model";
import { formatMyr, formatSol, formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";
import { formatDate } from "@/lib/ui/format";

const STEPS = [
  { key: "choose", label: "Choose" },
  { key: "checked", label: "Checked" },
  { key: "signed", label: "Signed" },
  { key: "chain", label: "On Solana" },
  { key: "recorded", label: "Recorded" },
];

type Phase =
  | { kind: "loading" }
  | { kind: "choose"; preview: SweepPreview }
  | { kind: "running"; preview: SweepPreview; step: number }
  | { kind: "done"; preview: SweepPreview; result: SweepExecution }
  | { kind: "error"; error: string; preview?: SweepPreview };

/**
 * "Sweep now" (IMPROVEMENTS T2 + A2). The owner ticks which buyer accounts to sweep; the live
 * total, fee and cap check follow the ticks. Only the ticked accounts are sent to the server,
 * which re-reads them on-chain and re-checks the rules before the agent signs.
 * Stepper: Choose → Checked → Signed → On Solana → Recorded.
 */
export function SweepNowDialog({ open, onClose, rate, onDone }: { open: boolean; onClose: () => void; rate: BnmRate; onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  // A fresh on-chain read each time the dialog opens (inside a transition, never during render).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    start(async () => {
      setPhase({ kind: "loading" });
      const r = await sweepPreview();
      if (cancelled) return;
      if (r.ok) {
        setPicked(new Set(defaultSelection(r.value)));
        setPhase({ kind: "choose", preview: r.value });
      } else setPhase({ kind: "error", error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const preview = phase.kind === "loading" ? undefined : phase.preview;
  const selection = useMemo(() => (preview ? summariseSelection(preview, picked) : undefined), [preview, picked]);
  const locked = phase.kind !== "choose";

  function run(p: SweepPreview, buyerIds: string[]) {
    setPhase({ kind: "running", preview: p, step: 1 });
    start(async () => {
      const t = setTimeout(() => setPhase((x) => (x.kind === "running" ? { ...x, step: 3 } : x)), 1500);
      const r = await sweepNow({ buyerIds });
      clearTimeout(t);
      if (r.ok) {
        setPhase({ kind: "done", preview: p, result: r.value });
        onDone?.();
      } else setPhase({ kind: "error", error: r.error, preview: p });
    });
  }

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const step = phase.kind === "done" ? 5 : phase.kind === "running" ? phase.step : 0;
  const movable = preview ? preview.accounts.filter(selectable) : [];
  const allPicked = movable.length > 0 && movable.every((a) => picked.has(a.buyerId));

  return (
    <Dialog open={open} onClose={onClose} title="Sweep now" caption="Choose the buyer accounts to move into your treasury. The agent moves each one inside its daily cap.">
      <Stepper size="sm" steps={STEPS} done={step} live={phase.kind === "running"} className="mb-5" />

      {phase.kind === "loading" ? (
        <div aria-busy="true" aria-label="Reading buyer accounts on Solana" className="divide-y divide-line rounded-lg ring-1 ring-inset ring-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-4.5 w-4.5 rounded-xs" />
              <Skeleton className="h-7 w-7 rounded-sm" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : null}

      {preview && selection ? (
        <>
          <fieldset disabled={locked} className="min-w-0">
            <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
              <legend className="float-left text-sm font-medium text-ink">
                Buyer accounts{movable.length ? <span className="font-normal text-ink-3"> {selection.buyerIds.length} of {movable.length} ticked</span> : null}
              </legend>
              {movable.length > 1 ? (
                <Button variant="ghost" size="sm" className="-mr-2.5" onClick={() => setPicked(allPicked ? new Set() : new Set(movable.map((a) => a.buyerId)))}>
                  {allPicked ? "Select none" : "Select all"}
                </Button>
              ) : null}
            </div>
            <ul className="clear-both divide-y divide-line overflow-hidden rounded-lg ring-1 ring-inset ring-line">
              {preview.accounts.map((a) => (
                <AccountRow key={a.buyerId} account={a} rate={rate} checked={picked.has(a.buyerId) && selectable(a)} onToggle={() => toggle(a.buyerId)} />
              ))}
            </ul>
          </fieldset>

          {movable.length === 0 ? (
            <p className="mt-4 text-base text-ink-2">Nothing to sweep right now. When a buyer pays, the money lands in their account here and you can move it.</p>
          ) : (
            <>
              <Inset className="mt-4 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium text-ink">To your treasury</span>
                  <MoneyCell usdc={selection.totalUsdc} rate={rate} className="text-lg" />
                </div>
                <Facts
                  className="mt-3 border-t border-line pt-3"
                  items={[
                    { label: "Destination", value: <span className="inline-flex items-center gap-2">Your treasury <Address value={preview.destinationVault} /></span>, muted: true },
                    { label: "Network fee", value: selection.transactions ? `${formatSol(selection.networkFeeLamports, 6)} SOL, paid by Kutip` : "None", muted: true },
                    { label: "Transactions", value: String(selection.transactions), muted: true },
                    ...(selection.heldByCapUsdc > 0n ? [{ label: "Stays until the cap resets", value: `${formatMyr(toMyr(selection.heldByCapUsdc, rate))} · ${formatUsdc(selection.heldByCapUsdc)} USD`, muted: true }] : []),
                  ]}
                />
              </Inset>
              <div className="mt-3 flex items-start gap-2">
                <Chip tone={selection.rule.ok ? "accent" : "neutral"}>Rule {selection.rule.id}</Chip>
                <span className="text-sm text-ink-2">{selection.rule.reason}</span>
              </div>
            </>
          )}
        </>
      ) : null}

      {phase.kind === "done" ? (
        <Inset className="mt-4 grid gap-1.5 p-4 text-sm" aria-live="polite">
          <p className="text-base font-medium text-ink">Swept {formatUsdc(phase.result.totalUsdc)} USD into your treasury</p>
          {phase.result.sweeps.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{s.buyerIds.length} account{s.buyerIds.length === 1 ? "" : "s"}, {formatUsdc(s.amountUsdc)} USD</span>
              <Address value={s.signature} kind="tx" label="View on Solscan" />
            </div>
          ))}
        </Inset>
      ) : null}

      {phase.kind === "error" ? <p role="alert" className="mt-4 text-sm text-disputed-fg">{phase.error}</p> : null}

      {/* Sticky so the action stays in reach however many buyer accounts there are. */}
      <div className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>{phase.kind === "done" ? "Close" : "Cancel"}</Button>
        {phase.kind === "choose" && selection ? (
          <Button onClick={() => run(phase.preview, selection.buyerIds)} disabled={pending || !selection.rule.ok} title={selection.rule.ok ? undefined : selection.rule.reason}>
            {selection.rule.ok ? `Sweep ${formatUsdc(selection.totalUsdc)} USD` : "Sweep"}
          </Button>
        ) : null}
        {phase.kind === "running" ? <Button disabled>{phase.step < 3 ? "Checking and signing…" : "Sending to Solana…"}</Button> : null}
      </div>
    </Dialog>
  );
}

function AccountRow({ account: a, rate, checked, onToggle }: { account: SweepAccount; rate: BnmRate; checked: boolean; onToggle: () => void }) {
  const can = selectable(a);
  const last = a.lastSweepAt ? `Last swept ${formatDate(a.lastSweepAt)}` : "Never swept";
  return (
    <li className={`transition-colors duration-(--dur-fast) ${checked ? "bg-accent-soft/60" : ""}`}>
      <label className={`flex items-center gap-3 px-4 py-3 ${can ? "cursor-pointer hover:bg-paper-2/50" : "cursor-not-allowed"}`}>
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={!can} onChange={onToggle} />
        <span
          aria-hidden="true"
          className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-xs border transition-colors duration-(--dur-fast) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
            checked ? "border-accent bg-accent text-on-accent" : can ? "border-line-strong bg-surface" : "border-line bg-paper-2"
          }`}
        >
          {checked ? <Check size={12} strokeWidth={3} /> : null}
        </span>
        <Avatar name={a.buyerName} size="sm" shape="square" />
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-2 text-base leading-snug ${can ? "text-ink" : "text-ink-2"}`} title={a.buyerName}>{a.buyerName}</span>
          <span className="block text-sm text-ink-3">{can ? `${last}. ${a.note}` : a.note}</span>
        </span>
        {a.balanceUsdc > 0n ? (
          <MoneyCell usdc={can ? a.sweepableUsdc : a.balanceUsdc} rate={rate} className={can ? "" : "opacity-70"} />
        ) : (
          <span className="shrink-0 text-sm tabular text-ink-3">Empty</span>
        )}
      </label>
    </li>
  );
}
