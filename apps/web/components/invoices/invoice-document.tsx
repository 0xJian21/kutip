import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Inset } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/ui/format";
import { formatMyr, formatRate, formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";
import type { InvoiceStatus, LineItem } from "@/lib/ui/types";

export type DocumentParty = { name: string; lines?: string[]; logo?: string | null };

/**
 * The invoice as a document: what the buyer sees on the pay page, what the
 * exporter sees while creating it, and what sits at the top of the detail page.
 * White paper inside a well, so it reads as a sheet rather than another card.
 * `aside` is the slot beside the totals (a QR, or a note); `footer` sits under the sheet.
 */
export function InvoiceDocument({
  from,
  to,
  number,
  issuedAt,
  dueDate,
  status,
  lineItems,
  totalUsdc,
  receivedUsdc,
  rate,
  aside,
  footer,
  note = "Pay with USDC. No gas fee, no bank charges: the amount you see is the amount that arrives.",
  compact = false,
  showItems = true,
  showTotal = true,
  tone = "paper",
  className = "",
}: {
  from: DocumentParty;
  to?: DocumentParty;
  number: string;
  issuedAt?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  lineItems?: LineItem[];
  totalUsdc: bigint;
  receivedUsdc?: bigint;
  rate?: BnmRate;
  aside?: ReactNode;
  footer?: ReactNode;
  note?: ReactNode;
  compact?: boolean;
  /** false when the caller has no line items to show (the public pay page). */
  showItems?: boolean;
  /** false when the amount is stated prominently elsewhere on the screen. */
  showTotal?: boolean;
  /** "paper": a sheet inside a well (owner screens). "flat": a plain outlined card (pay page). */
  tone?: "paper" | "flat";
  className?: string;
}) {
  const pad = compact ? "p-5" : "p-5 sm:p-8";
  const items = lineItems ?? [];
  const balance = receivedUsdc !== undefined ? totalUsdc - receivedUsdc : undefined;
  const article = (
      <article className={`${tone === "flat" ? "rounded-xl bg-surface ring-1 ring-inset ring-line" : "rounded-md bg-surface shadow-card"} ${pad}`} aria-label={`Invoice ${number}`}>
        {/* The number block drops under the name on narrow screens, so the exporter's name is never cut. */}
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-[160px] items-center gap-3">
            <Avatar name={from.name} src={from.logo} size={compact ? "md" : "lg"} shape="square" />
            <div className="min-w-0">
              <p className="line-clamp-2 text-base font-semibold leading-snug text-ink">{from.name}</p>
              {from.lines?.map((l) => (
                <p key={l} className="text-xs text-ink-3">{l}</p>
              ))}
            </div>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Invoice</p>
            <p className="whitespace-nowrap tabular text-base font-medium text-ink">{number || "Next number"}</p>
            {status ? <div className="mt-1.5 flex justify-end"><StatusPill status={status} /></div> : null}
          </div>
        </header>

        <dl className={`mt-6 grid grid-cols-2 gap-4 text-sm ${to ? "sm:grid-cols-[1.4fr_1fr_1fr]" : ""}`}>
          {to ? (
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <dt className="text-ink-3">Billed to</dt>
              <dd className="mt-0.5 font-medium text-ink">{to.name}</dd>
              {to.lines?.map((l) => (
                <dd key={l} className="text-ink-2">{l}</dd>
              ))}
            </div>
          ) : null}
          {issuedAt !== undefined ? (
            <div>
              <dt className="text-ink-3">Issued</dt>
              <dd className="mt-0.5 tabular font-medium text-ink">{issuedAt ? formatDate(issuedAt) : "Today"}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-ink-3">Due</dt>
            <dd className={`mt-0.5 tabular font-medium ${status === "overdue" ? "text-overdue-fg" : "text-ink"}`}>{dueDate ? formatDate(dueDate) : "—"}</dd>
          </div>
        </dl>

        {showItems ? (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th scope="col" className="w-full pb-2 font-medium">Item</th>
              <th scope="col" className="w-[1%] whitespace-nowrap pb-2 pl-4 text-right font-medium">Qty</th>
              <th scope="col" className="hidden w-[1%] whitespace-nowrap pb-2 pl-4 text-right font-medium sm:table-cell">Unit, USD</th>
              <th scope="col" className="w-[1%] whitespace-nowrap pb-2 pl-4 text-right font-medium">Amount, USD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-ink-3">Line items appear here as you add them.</td>
              </tr>
            ) : (
              items.map((li, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-3 text-ink">{li.description || <span className="text-ink-3">Item {i + 1}</span>}</td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right tabular text-ink-2">{li.quantity}</td>
                  <td className="hidden whitespace-nowrap py-2.5 pl-4 text-right tabular text-ink-2 sm:table-cell">{formatUsdc(li.unitPriceUsdc)}</td>
                  <td className="whitespace-nowrap py-2.5 pl-4 text-right tabular font-medium text-ink">{formatUsdc(li.unitPriceUsdc * BigInt(li.quantity))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        ) : null}

        {showTotal || aside || note ? (
        <div className={`mt-5 grid gap-5 border-t border-line pt-5 ${aside ? "sm:grid-cols-[1fr_auto] sm:items-end" : ""}`}>
          <div className="grid gap-1.5 text-sm">
            {showTotal ? (
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-ink-2">Total</span>
              <span className="tabular text-lg font-semibold text-ink">{formatUsdc(totalUsdc)} USD</span>
            </div>
            ) : null}
            {rate && showTotal ? (
              <div className="flex items-baseline justify-between gap-4 text-ink-2">
                <span>In ringgit</span>
                <span className="tabular">{formatMyr(toMyr(totalUsdc, rate))} <span className="text-ink-3">at {formatRate(rate)}</span></span>
              </div>
            ) : null}
            {balance !== undefined && balance !== totalUsdc && balance > 0n ? (
              <div className="flex items-baseline justify-between gap-4 font-medium text-ink">
                <span>Balance due</span>
                <span className="tabular">{formatUsdc(balance)} USD</span>
              </div>
            ) : null}
            {note ? <p className={`${showTotal ? "mt-2" : ""} max-w-[40ch] text-xs text-ink-3`}>{note}</p> : null}
          </div>
          {aside}
        </div>
        ) : null}
      </article>
  );
  if (tone === "flat") return <div className={`min-w-0 ${className}`}>{article}{footer ? <div className="px-2 pt-3">{footer}</div> : null}</div>;
  return (
    <Inset className={`p-3 sm:p-4 ${className}`}>
      {article}
      {footer ? <div className="px-2 pt-3">{footer}</div> : null}
    </Inset>
  );
}
