"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyFigure } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { fetchInvoice } from "@/lib/data/actions";
import { debounce, useBroadcast } from "@/lib/data/live";
import { mergeInvoiceEvent, parseInvoiceEvent, parsePaymentEvent } from "@/lib/data/merge";
import { MOCK } from "@/lib/ui/data";
import { mockData } from "@/lib/mock";
import { dueLabel, formatDate, formatTime } from "@/lib/ui/format";
import type { InvoiceDetail } from "@/lib/ui/types";
import { ReceiptCard } from "./receipt-card";
import { SimulateControl } from "./simulate-control";
import { stageIndex, waitingText } from "./status-bar";

/**
 * The live part of the invoice page: header figure, status pill, the stepper,
 * receipt. Broadcast `invoice:<id>` events are applied as they arrive (Seen → Paid →
 * Settled), then the full detail is refetched through a server action.
 */
export function InvoiceLive({ initial, exporterId }: { initial: InvoiceDetail; exporterId: string }) {
  const [detail, setDetail] = useState(initial);
  const id = initial.invoice.id;
  const [seed, setSeed] = useState(initial);
  if (seed !== initial) {
    // Server re-render (e.g. after a simulated reply) brings a fresh snapshot.
    setSeed(initial);
    setDetail(initial);
  }
  useEffect(() => (MOCK ? mockData.subscribeInvoice(id, setDetail) : undefined), [id]);
  const refetch = useMemo(() => debounce(() => void fetchInvoice(id).then((d) => d && setDetail(d)).catch(() => {}), 400), [id]);
  useBroadcast(MOCK ? null : `invoice:${id}`, (event, payload) => {
    if (event === "invoice") setDetail((d) => ({ ...d, invoice: mergeInvoiceEvent(d.invoice, parseInvoiceEvent(payload)) }));
    if (event === "payment") {
      const p = parsePaymentEvent(payload);
      setDetail((d) => ({ ...d, payments: [...d.payments.filter((x) => x.signature !== p.signature), p] }));
    }
    refetch();
  });
  // owner:<exporterId> carries no ids (public topic), so any change refetches this invoice (debounced).
  useBroadcast(MOCK ? null : `owner:${exporterId}`, refetch);

  const { invoice, buyer, payments, rate } = detail;
  const payment = payments.at(-1);
  const urgent = invoice.status === "overdue" || invoice.status === "disputed";
  const done = stageIndex(invoice.status);
  const live = invoice.status === "seen" || invoice.status === "paid";
  const at = (iso?: string) => (iso ? formatTime(iso) : "—");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={buyer.name} size="lg" shape="square" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span className="tabular">{invoice.number}</span>
              <StatusPill status={invoice.status} />
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{buyer.name}</h1>
            <p className={`mt-1 text-base tabular ${urgent ? "font-medium text-overdue-fg" : "text-ink-2"}`}>
              Due {formatDate(invoice.dueDate)}
              {invoice.status !== "settled" && invoice.status !== "paid" ? <span> · {dueLabel(invoice.dueDate)}</span> : null}
            </p>
          </div>
        </div>
        <MoneyFigure usdc={invoice.amountUsdc} rate={rate} size="lg" align="right" className="sm:items-end" />
      </div>

      <Card>
        <CardHeader title="Payment" caption={<span className="inline-flex items-center gap-2" aria-live="polite">{live ? <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}{waitingText(invoice)}</span>} aside={<SimulateControl invoiceId={invoice.id} status={invoice.status} />} />
        <Stepper
          className="mt-5"
          done={done}
          live={live}
          steps={[
            { key: "sent", label: "Sent", caption: at(invoice.sentAt) },
            { key: "seen", label: <><span className="sm:hidden">Seen</span><span className="hidden sm:inline">Payment seen</span></>, caption: at(invoice.seenAt) },
            { key: "paid", label: "Paid", caption: at(invoice.paidAt) },
            { key: "settled", label: "Settled", caption: at(invoice.settledAt) },
          ]}
        />
      </Card>

      {payment ? (
        <div className="mt-5 lg:mt-6">
          <ReceiptCard payment={payment} invoice={invoice} rate={rate} />
        </div>
      ) : null}
    </>
  );
}
