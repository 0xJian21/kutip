"use client";

import { useEffect, useState } from "react";
import { MoneyFigure } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { data } from "@/lib/ui/data";
import { dueLabel, formatDate } from "@/lib/ui/format";
import type { InvoiceDetail } from "@/lib/ui/types";
import { ReceiptCard } from "./receipt-card";
import { SimulateControl } from "./simulate-control";
import { StatusBar } from "./status-bar";

/**
 * The live part of the invoice page: header figure, status pill, status bar,
 * receipt. Subscribes after mount so simulated state never causes a hydration mismatch.
 */
export function InvoiceLive({ initial }: { initial: InvoiceDetail }) {
  const [detail, setDetail] = useState(initial);
  useEffect(() => data.subscribeInvoice(initial.invoice.id, setDetail), [initial.invoice.id]);

  const { invoice, buyer, payments, rate } = detail;
  const payment = payments.at(-1);
  const urgent = invoice.status === "overdue" || invoice.status === "disputed";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span className="tabular">{invoice.number}</span>
            <StatusPill status={invoice.status} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{buyer.name}</h1>
          <p className={`mt-1 text-base tabular ${urgent ? "font-medium text-overdue-fg" : "text-ink-2"}`}>
            Due {formatDate(invoice.dueDate)}
            {invoice.status !== "settled" && invoice.status !== "paid" ? <span> · {dueLabel(invoice.dueDate)}</span> : null}
          </p>
        </div>
        <MoneyFigure usdc={invoice.amountUsdc} rate={rate} size="lg" align="right" className="sm:items-end" />
      </div>

      <Panel title="Payment" aside={<SimulateControl invoiceId={invoice.id} status={invoice.status} />}>
        <StatusBar invoice={invoice} />
      </Panel>

      {payment ? (
        <div className="mt-6">
          <ReceiptCard payment={payment} invoice={invoice} rate={rate} />
        </div>
      ) : null}
    </>
  );
}
