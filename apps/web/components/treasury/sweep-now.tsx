"use client";

import { useEffect, useState, useTransition } from "react";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Inset } from "@/components/ui/card";
import { Facts } from "@/components/ui/panel";
import { Chip } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { sweepNow, sweepPreview, type SweepExecution, type SweepPreview } from "@/lib/data/treasury-actions";
import { formatSol, formatUsdc, toMyr, formatMyr, type BnmRate } from "@/lib/ui/money";
import { shortAddress } from "@/lib/ui/format";

const STEPS = [
  { key: "checked", label: "Checked" },
  { key: "signed", label: "Signed" },
  { key: "chain", label: "On Solana" },
  { key: "recorded", label: "Recorded" },
];

type Phase = { kind: "loading" } | { kind: "preview"; preview: SweepPreview } | { kind: "running"; preview: SweepPreview; step: number } | { kind: "done"; preview: SweepPreview; result: SweepExecution } | { kind: "error"; error: string; preview?: SweepPreview };

/**
 * "Sweep now" (IMPROVEMENTS T2 + A2): preview what the agent would move (which buyer
 * accounts, amounts, destination, network fee paid by Kutip, the T2 cap check), then run
 * it with the stepper Checked → Signed by agent → On Solana → Recorded.
 */
export function SweepNowDialog({ open, onClose, rate, onDone }: { open: boolean; onClose: () => void; rate: BnmRate; onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [pending, start] = useTransition();

  // Load a fresh preview each time the dialog opens (inside a transition, never during render).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    start(async () => {
      setPhase({ kind: "loading" });
      const r = await sweepPreview();
      if (cancelled) return;
      setPhase(r.ok ? { kind: "preview", preview: r.value } : { kind: "error", error: r.error });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function run(preview: SweepPreview) {
    setPhase({ kind: "running", preview, step: 1 });
    start(async () => {
      const t = setTimeout(() => setPhase((p) => (p.kind === "running" ? { ...p, step: 2 } : p)), 1200);
      const r = await sweepNow();
      clearTimeout(t);
      if (r.ok) {
        setPhase({ kind: "done", preview, result: r.value });
        onDone?.();
      } else setPhase({ kind: "error", error: r.error, preview });
    });
  }

  const preview = phase.kind === "preview" || phase.kind === "running" || phase.kind === "done" ? phase.preview : phase.kind === "error" ? phase.preview : undefined;
  const step = phase.kind === "done" ? 4 : phase.kind === "running" ? phase.step : phase.kind === "preview" ? 1 : 0;

  return (
    <Dialog open={open} onClose={onClose} title="Sweep now" caption="Move what is waiting in buyer accounts into your treasury, inside the agent's daily cap.">
      <Stepper size="sm" steps={STEPS} done={step} live={phase.kind === "running"} className="mb-5" />

      {phase.kind === "loading" ? <p className="text-base text-ink-2">Reading buyer accounts on Solana…</p> : null}

      {preview ? (
        <>
          <Inset className="divide-y divide-line px-4">
            {preview.items.map((i) => (
              <div key={i.buyerId} className="flex items-center justify-between gap-3 py-2.5 text-base">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{i.buyerName}</span>
                  <span className="block text-xs tabular text-ink-3">{shortAddress(i.vault)}</span>
                </span>
                <span className="text-right tabular">
                  <span className="block font-medium text-ink">{formatUsdc(i.amountUsdc)} USDC</span>
                  <span className="block text-xs text-ink-3">{formatMyr(toMyr(i.amountUsdc, rate))}</span>
                </span>
              </div>
            ))}
            {preview.items.length === 0 ? <p className="py-3 text-base text-ink-2">No buyer account holds USDC right now.</p> : null}
          </Inset>
          <Facts
            className="mt-4"
            items={[
              { label: "Total", value: <span className="font-medium">{formatUsdc(preview.totalUsdc)} USDC</span> },
              { label: "Destination", value: <span className="inline-flex items-center gap-2">Your treasury <Address value={preview.destinationVault} /></span>, muted: true },
              { label: "Network fee", value: `${formatSol(preview.networkFeeLamports, 6)} SOL, paid by Kutip`, muted: true },
              { label: "Transactions", value: String(preview.transactions), muted: true },
              ...(preview.heldByCapUsdc > 0n ? [{ label: "Stays until the cap resets", value: `${formatUsdc(preview.heldByCapUsdc)} USDC`, muted: true }] : []),
            ]}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone={preview.rule.ok ? "accent" : "neutral"}>Rule {preview.rule.id}</Chip>
            <span className="text-sm text-ink-2">{preview.rule.reason}</span>
          </div>
          {preview.unprovisioned.length ? <p className="mt-2 text-xs text-ink-3">Not yet on Solana: {preview.unprovisioned.join(", ")}.</p> : null}
        </>
      ) : null}

      {phase.kind === "done" ? (
        <Inset className="mt-4 grid gap-1.5 p-4 text-sm">
          <p className="text-base font-medium text-ink">Swept {formatUsdc(phase.result.totalUsdc)} USDC into your treasury</p>
          {phase.result.sweeps.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="text-ink-2">{s.buyerIds.length} account{s.buyerIds.length === 1 ? "" : "s"} · {formatUsdc(s.amountUsdc)} USDC</span>
              <Address value={s.signature} kind="tx" label="View on Solscan" />
            </div>
          ))}
        </Inset>
      ) : null}

      {phase.kind === "error" ? <p role="alert" className="mt-4 text-sm text-disputed-fg">{phase.error}</p> : null}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{phase.kind === "done" ? "Close" : "Cancel"}</Button>
        {phase.kind === "preview" ? (
          <Button onClick={() => run(phase.preview)} disabled={pending || phase.preview.mode !== "sweep"}>
            Sweep {phase.preview.mode === "sweep" ? `${formatUsdc(phase.preview.totalUsdc)} USDC` : "now"}
          </Button>
        ) : null}
        {phase.kind === "running" ? <Button disabled>{phase.step < 2 ? "Signing with the agent key…" : "Sending to Solana…"}</Button> : null}
      </div>
    </Dialog>
  );
}
