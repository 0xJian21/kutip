"use client";

import { useEffect, useState } from "react";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/ui/status";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Amount } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";

const SEQUENCE: Array<{ status: InvoiceStatus; at: number }> = [
  { status: "sent", at: 0 },
  { status: "seen", at: 1400 },
  { status: "paid", at: 2400 },
  { status: "settled", at: 3900 },
];
const STAGES = ["sent", "seen", "paid", "settled"] as const;
const TIMES = ["14:02:10", "14:02:11", "14:02:12", "14:02:24"];

/**
 * The landing hero: one invoice settling, once, on load.
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
  const live = status === "seen" || status === "paid";

  return (
    <Card className="shadow-float">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name="Harbourline Interiors" size="md" shape="square" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">Harbourline Interiors Pty Ltd</p>
            <p className="truncate text-sm tabular text-ink-2">INV-2026-0152 · Sydney · paid in SOL, received USDC</p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-2">Received</p>
          <Amount sen={21_075n} size="lg" />
        </div>
        <p className="text-sm tabular text-ink-2">50.00 USD · BNM rate 4.2150</p>
      </div>
      <Stepper
        size="sm"
        className="mt-5"
        done={done}
        live={live}
        steps={STAGES.map((s, i) => ({ key: s, label: s === "seen" ? "Seen" : INVOICE_STATUS_LABEL[s], caption: i < done ? TIMES[i] : "—" }))}
      />
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
        <div><dt className="text-ink-3">Buyer paid</dt><dd className="tabular font-medium text-ink">0.2831 SOL</dd></div>
        <div><dt className="text-ink-3">You received</dt><dd className="tabular font-medium text-ink">50.000000 USDC</dd></div>
        <div><dt className="text-ink-3">Fees, both sides</dt><dd className="tabular font-medium text-ink">RM0.04</dd></div>
      </dl>
    </Card>
  );
}
