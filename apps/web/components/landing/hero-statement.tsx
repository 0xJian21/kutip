"use client";

import { useEffect, useState } from "react";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/ui/status";
import { StatusPill } from "@/components/ui/status-pill";

const SEQUENCE: Array<{ status: InvoiceStatus; at: number }> = [
  { status: "sent", at: 0 },
  { status: "seen", at: 1400 },
  { status: "paid", at: 2400 },
  { status: "settled", at: 3900 },
];
const STAGES = ["sent", "seen", "paid", "settled"] as const;
const TIMES = ["14:02:10", "14:02:11", "14:02:12", "14:02:24"];

/**
 * The landing hero: a statement row that settles once, on load.
 * The one orchestrated moment on the page. With reduced motion it starts settled.
 */
export function HeroStatement() {
  const [status, setStatus] = useState<InvoiceStatus>("sent");

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = SEQUENCE.slice(1).map((s) => setTimeout(() => setStatus(s.status), reduced ? 0 : s.at + 600));
    return () => timers.forEach(clearTimeout);
  }, []);

  const done = STAGES.indexOf(status as (typeof STAGES)[number]) + 1;

  return (
    <div className="rounded-md border border-line bg-surface shadow-float">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <p className="text-sm text-ink-2">Teratai Woodworks Sdn. Bhd.</p>
          <p className="text-base font-medium text-ink">Statement, today</p>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-ink">Harbourline Interiors Pty Ltd</p>
            <p className="text-sm tabular text-ink-2">INV-2026-0152 · Sydney · paid in SOL, received USDC</p>
          </div>
          <div className="text-right">
            <div className="money text-money-md text-ink"><span className="mr-0.5 text-[0.55em] font-medium">RM</span>210.75</div>
            <p className="text-sm tabular text-ink-2">50.00 USD</p>
          </div>
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Payment progress">
          {STAGES.map((s, i) => {
            const complete = i < done;
            return (
              <li key={s} className="min-w-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className={`h-full origin-left rounded-full bg-accent transition-transform duration-(--dur-slow) ease-(--ease-out) ${complete ? "scale-x-100" : "scale-x-0"}`} />
                </div>
                <div className={`mt-1.5 truncate text-xs ${complete ? "font-medium text-ink" : "text-ink-3"}`}>{s === "seen" ? "Seen" : INVOICE_STATUS_LABEL[s]}</div>
                <div className="tabular text-xs text-ink-3">{complete ? TIMES[i] : "—"}</div>
              </li>
            );
          })}
        </ol>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
          <div><dt className="text-ink-3">Buyer paid</dt><dd className="tabular text-ink">0.2831 SOL</dd></div>
          <div><dt className="text-ink-3">You received</dt><dd className="tabular text-ink">50.000000 USDC</dd></div>
          <div><dt className="text-ink-3">Fees, both sides</dt><dd className="tabular text-ink">RM0.04</dd></div>
        </dl>
      </div>
    </div>
  );
}
