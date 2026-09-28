"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Wallet } from "lucide-react";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { SimulateControl } from "@/components/invoices/simulate-control";
import { QrCode } from "@/components/pay/qr-code";
import { Button } from "@/components/ui/button";
import { Card, Inset } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime, shortAddress, solscanTx } from "@/lib/ui/format";
import { formatSol, formatUsdc } from "@/lib/ui/money";
import { fetchPayInvoice } from "@/lib/data/actions";
import { debounce, useBroadcast } from "@/lib/data/live";
import { mockData } from "@/lib/mock";
import { MOCK } from "@/lib/ui/data";
import type { PayInvoice } from "@/lib/ui/types";

/**
 * Buyer pay page body. Public, mobile-first, no login.
 * The invoice reads as a document first; "Confirm and pay" opens the QR / wallet step.
 * Flips live to the success state when the payment lands (Broadcast `invoice:<id>`).
 * The solana: link is only ever a QR or a deep link, never text to copy: a pasted
 * transaction-request URL reads as "invalid address" in wallets (Spike A).
 */
export function PayCard({ initial, solHref }: { initial: PayInvoice; solHref?: string }) {
  const [pay, setPay] = useState(initial);
  const [token, setToken] = useState<"auto" | "SOL">("auto");
  const [confirming, setConfirming] = useState(false);
  const id = initial.invoiceId;
  useEffect(() => (MOCK ? mockData.subscribePayInvoice(id, setPay) : undefined), [id]);
  // Public topic: an event only says "look again"; the success state comes from the server's answer.
  const refetch = useMemo(() => debounce(() => void fetchPayInvoice(id).then((p) => p && setPay(p)).catch(() => {}), 150), [id]);
  useBroadcast(MOCK ? null : `invoice:${id}`, refetch);
  const href = token === "SOL" && solHref ? solHref : pay.solanaPayUrl;

  const paid = pay.status === "paid" || pay.status === "settled";
  const seen = pay.status === "seen";
  const overdue = pay.status === "overdue";

  const document = (
    <InvoiceDocument
      compact
      tone="flat"
      showTotal={paid}
      from={{ name: pay.exporterName, logo: pay.exporterLogoUrl, lines: pay.exporterAddress ? [pay.exporterAddress] : [] }}
      to={{ name: pay.buyerName, lines: pay.buyerAddress ? [pay.buyerAddress] : [] }}
      number={pay.invoiceNumber}
      issuedAt={pay.issuedAt}
      dueDate={pay.dueDate}
      status={paid || overdue || seen ? pay.status : undefined}
      lineItems={pay.lineItems}
      totalUsdc={pay.amountUsdc}
      note={null}
    />
  );

  if (paid) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Card aria-live="polite" className="text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-paid-bg text-paid-fg">
            <Check size={28} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Payment received</h1>
          <p className="mt-1 text-base text-ink-2">Thank you. {pay.exporterName} has been notified and a receipt is on its way.</p>
          <div className="money mt-5 text-money-lg text-ink">
            {formatUsdc(pay.amountUsdc)} <span className="text-[0.45em] font-semibold text-ink-3">USDC</span>
          </div>
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
        </Card>
        {document}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {document}

      <Card>
        {!confirming ? (
          <>
            <p className="text-sm font-medium text-ink-2">Amount due</p>
            <p className="money mt-1 text-money-xl text-ink">
              {formatUsdc(pay.amountUsdc)} <span className="text-[0.45em] font-semibold text-ink-3">USDC</span>
            </p>
            <p className="mt-1.5 text-sm text-ink-2">Pay with USDC, or SOL converted on the spot. No gas fee: the amount shown is the amount that arrives.</p>
            <Button variant="secondary" size="lg" className="mt-5 w-full" onClick={() => setConfirming(true)}>
              Confirm and pay
            </Button>
            <p className="mt-3 text-center text-sm text-ink-3">Next: scan a QR or open your wallet. Nothing is charged until you approve there.</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Pay {formatUsdc(pay.amountUsdc)} USDC</h2>
              {solHref ? (
                <Tabs
                  label="Pay in"
                  variant="segmented"
                  size="sm"
                  value={token}
                  onChange={setToken}
                  items={[
                    { value: "auto", label: "USDC" },
                    { value: "SOL", label: "SOL" },
                  ]}
                />
              ) : null}
            </div>
            <Inset className="mx-auto mt-4 w-56 max-w-full p-3">
              <div className="rounded-sm bg-surface p-2">
                {seen ? (
                  <div className="flex aspect-square items-center justify-center text-center">
                    <p className="text-base text-ink-2" aria-live="polite">
                      <span aria-hidden="true" className="mx-auto mb-2 block h-2 w-2 animate-pulse rounded-full bg-accent" />
                      Payment seen. Checking…
                    </p>
                  </div>
                ) : (
                  <QrCode value={href} />
                )}
              </div>
            </Inset>
            <p className="mt-2 text-center text-sm text-ink-2">Scan with Phantom or Solflare</p>
            <a href={href} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-md font-medium text-on-accent transition-colors duration-(--dur-fast) hover:bg-accent-hover">
              <Wallet size={18} aria-hidden="true" />
              Open in wallet
            </a>
            <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
              <li className="flex items-start justify-between gap-4 py-2.5">
                <span className="shrink-0 text-ink-2">Pay with</span>
                <span className="text-right text-ink">{pay.acceptedTokens.join(", ")}<span className="block text-xs text-ink-3">SOL and USDT convert automatically</span></span>
              </li>
              <li className="flex items-start justify-between gap-4 py-2.5">
                <span className="shrink-0 text-ink-2">Network fee</span>
                <span className="text-right text-ink">None<span className="block text-xs text-ink-3">Kutip pays it. You need 0 SOL for gas.</span></span>
              </li>
              <li className="flex items-start justify-between gap-4 py-2.5">
                <span className="shrink-0 text-ink-2">Goes to</span>
                <span className="text-right text-ink">{pay.exporterName}<span className="block text-xs text-ink-3">Their own account, not Kutip&apos;s</span></span>
              </li>
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-3">This page updates by itself when your payment arrives.</p>
              <SimulateControl invoiceId={pay.invoiceId} status={pay.status} compact />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
