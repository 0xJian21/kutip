"use client";

import { useEffect, useState } from "react";
import { Check, Wallet } from "lucide-react";
import { SimulateControl } from "@/components/invoices/simulate-control";
import { QrCode } from "@/components/pay/qr-code";
import { formatDate, formatDateTime, shortAddress, solscanTx } from "@/lib/ui/format";
import { formatSol, formatUsdc } from "@/lib/ui/money";
import { data } from "@/lib/ui/data";
import type { PayInvoice } from "@/lib/ui/types";

/**
 * Buyer pay page body. Public, mobile-first, no login.
 * Flips live to the success state when the payment lands.
 */
export function PayCard({ initial, href }: { initial: PayInvoice; href: string }) {
  const [pay, setPay] = useState(initial);
  useEffect(() => data.subscribePayInvoice(initial.invoiceId, setPay), [initial.invoiceId]);

  const paid = pay.status === "paid" || pay.status === "settled";
  const seen = pay.status === "seen";
  const overdue = pay.status === "overdue";

  if (paid) {
    return (
      <section aria-live="polite" className="rounded-lg border border-line bg-surface p-6 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-paid-bg text-paid-fg">
          <Check size={28} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">Payment received</h1>
        <p className="mt-1 text-base text-ink-2">Thank you. {pay.exporterName} has been notified and a receipt is on its way.</p>
        <div className="money mt-5 text-money-lg text-ink">{formatUsdc(pay.amountUsdc)} <span className="text-[0.45em] font-medium">USDC</span></div>
        {pay.payment?.inputMint === "SOL" && pay.payment.inputAmount !== undefined ? (
          <p className="mt-1 text-base tabular text-ink-2">You paid {formatSol(pay.payment.inputAmount)} SOL, converted at payment time.</p>
        ) : null}
        <dl className="mt-5 grid gap-2 border-t border-line pt-4 text-left text-sm">
          <div className="flex justify-between gap-4"><dt className="text-ink-2">Invoice</dt><dd className="tabular text-ink">{pay.invoiceNumber}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-ink-2">Status</dt><dd className="text-ink">{pay.status === "settled" ? "Final" : "Received, becoming final"}</dd></div>
          {pay.paidAt ? <div className="flex justify-between gap-4"><dt className="text-ink-2">Time</dt><dd className="tabular text-ink">{formatDateTime(pay.paidAt)} MYT</dd></div> : null}
          <div className="flex justify-between gap-4"><dt className="text-ink-2">Network fee</dt><dd className="text-ink">0, paid by Kutip</dd></div>
          {pay.payment ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Reference</dt>
              <dd><a href={solscanTx(pay.payment.signature)} target="_blank" rel="noopener noreferrer" className="tabular text-accent underline-offset-4 hover:underline">{shortAddress(pay.payment.signature, 6)}</a></dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4"><SimulateControl invoiceId={pay.invoiceId} status={pay.status} compact /></div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="px-6 pt-6 text-center">
        <p className="text-sm text-ink-2">{pay.exporterName}</p>
        <h1 className="mt-1 text-lg font-medium text-ink">Invoice {pay.invoiceNumber}</h1>
        <div className="money mt-3 text-money-xl text-ink">
          {formatUsdc(pay.amountUsdc)}
          <span className="ml-1.5 align-baseline text-[0.4em] font-medium">USDC</span>
        </div>
        <p className={`mt-1 text-base tabular ${overdue ? "font-medium text-overdue-fg" : "text-ink-2"}`}>
          {overdue ? "Was due" : "Due"} {formatDate(pay.dueDate)}
        </p>
      </div>

      <div className="mx-auto mt-5 w-56 max-w-full px-6">
        <div className="rounded-md border border-line bg-paper p-3">
          {seen ? (
            <div className="flex aspect-square items-center justify-center text-center">
              <p className="text-base text-ink-2" aria-live="polite">
                <span aria-hidden="true" className="mb-2 block h-2 w-2 mx-auto animate-pulse rounded-full bg-accent" />
                Payment seen. Checking…
              </p>
            </div>
          ) : (
            <QrCode value={pay.solanaPayUrl} />
          )}
        </div>
        <p className="mt-2 text-center text-sm text-ink-2">Scan with Phantom, Solflare or Backpack</p>
      </div>

      <div className="mt-5 px-6">
        <a href={href} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-md font-medium text-on-accent transition-colors duration-(--dur-fast) hover:bg-accent-hover">
          <Wallet size={18} aria-hidden="true" />
          Open in wallet
        </a>
      </div>

      <ul className="mx-6 mt-5 divide-y divide-line border-t border-line text-base">
        <li className="flex items-start justify-between gap-4 py-3">
          <span className="shrink-0 text-ink-2">Pay with</span>
          <span className="text-right text-ink">{pay.acceptedTokens.join(", ")}<span className="block text-sm text-ink-3">SOL and USDT convert automatically</span></span>
        </li>
        <li className="flex items-start justify-between gap-4 py-3">
          <span className="shrink-0 text-ink-2">Network fee</span>
          <span className="text-right text-ink">None<span className="block text-sm text-ink-3">Kutip pays it. You need 0 SOL for gas.</span></span>
        </li>
        <li className="flex items-start justify-between gap-4 py-3">
          <span className="shrink-0 text-ink-2">Goes to</span>
          <span className="text-right text-ink">{pay.exporterName}<span className="block text-sm text-ink-3">Their own account, not Kutip&apos;s</span></span>
        </li>
      </ul>

      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <p className="text-xs text-ink-3">This page updates by itself when your payment arrives.</p>
        <SimulateControl invoiceId={pay.invoiceId} status={pay.status} compact />
      </div>
    </section>
  );
}
