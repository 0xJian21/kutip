"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { InvoiceStatus } from "@/lib/ui/status";

/**
 * The hero's one orchestrated moment: a payment flipping Seen → Paid → Settled at the speed it
 * really did on mainnet (29 Sep 2026: Paid 153 ms after Seen, Settled 7.86 s after). Runs once;
 * with reduced motion it starts settled.
 */
const STEPS: Array<{ status: InvoiceStatus; at: number; label: string; time: string }> = [
  { status: "seen", at: 1600, label: "Payment seen", time: "0.00 s" },
  { status: "paid", at: 1600 + 153, label: "Paid", time: "+0.15 s" },
  { status: "settled", at: 1600 + 7860, label: "Settled", time: "+7.86 s" },
];

export function PaymentFlip({ className = "" }: { className?: string }) {
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = STEPS.map((s, i) => setTimeout(() => setReached(i + 1), reduced ? 0 : s.at));
    return () => timers.forEach(clearTimeout);
  }, []);

  const status: InvoiceStatus = reached === 0 ? "sent" : STEPS[reached - 1]!.status;
  return (
    <div className={`w-64 rounded-lg bg-surface p-4 shadow-float ring-1 ring-line ${className}`} aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">INV-2026-0154</p>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular text-ink">
        <span className="mr-0.5 text-sm font-semibold text-ink-2">RM</span>4<span className="text-ink-3">.08</span>
      </p>
      <p className="text-xs tabular text-ink-3">1.000000 USDC received. Buyer fee: 0</p>
      <ol className="mt-3 grid gap-1.5 border-t border-line pt-3">
        {STEPS.map((s, i) => {
          const on = i < reached;
          return (
            <li key={s.status} className={`flex items-center justify-between text-xs transition-colors duration-(--dur-base) ${on ? "text-ink" : "text-ink-3"}`}>
              <span className="flex items-center gap-2">
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-(--dur-base) ${on ? "bg-accent text-on-accent" : "ring-1 ring-inset ring-line-strong"}`}>
                  {on ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                {s.label}
              </span>
              <span className="tabular">{on ? s.time : ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
