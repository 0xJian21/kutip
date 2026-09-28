import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { MoneyCell } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { dueLabel, formatDate } from "@/lib/ui/format";
import type { BnmRate, Buyer, Invoice } from "@/lib/ui/types";
import type { ReactNode } from "react";

const URGENT = new Set(["overdue", "disputed"]);

/**
 * Invoice rows. A table from 640px up; stacked rows below.
 * Overdue colours the due date, never the row.
 */
export function InvoiceTable({
  invoices,
  buyers,
  rate,
  empty,
}: {
  invoices: Invoice[];
  buyers: Buyer[];
  rate: BnmRate;
  empty?: ReactNode;
}) {
  if (invoices.length === 0) {
    return <>{empty ?? <EmptyState title="No invoices here" body="Nothing matches this view." compact />}</>;
  }
  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.name ?? "Unknown buyer";

  return (
    <>
      <Table className="hidden sm:table">
        <THead>
          <tr>
            <TH>Invoice</TH>
            <TH>Buyer</TH>
            <TH>Due</TH>
            <TH>Status</TH>
            <TH align="right">Amount</TH>
          </tr>
        </THead>
        <TBody>
          {invoices.map((inv) => {
            const urgent = URGENT.has(inv.status);
            return (
              <TR key={inv.id} interactive>
                <TD className="whitespace-nowrap">
                  <Link href={`/invoices/${inv.id}`} className="tabular font-medium text-ink after:absolute after:inset-0 after:content-['']">
                    {inv.number}
                  </Link>
                </TD>
                <TD className="w-full max-w-0">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={buyerName(inv.buyerId)} size="sm" shape="square" />
                    <span className="min-w-0 truncate text-ink">{buyerName(inv.buyerId)}</span>
                  </span>
                </TD>
                <TD className={`whitespace-nowrap tabular ${urgent ? "font-medium text-overdue-fg" : "text-ink-2"}`}>
                  <span>{formatDate(inv.dueDate)}</span>
                  {inv.status === "overdue" ? <span className="block text-xs">{dueLabel(inv.dueDate)}</span> : null}
                </TD>
                <TD><StatusPill status={inv.status} /></TD>
                <TD align="right"><MoneyCell usdc={inv.amountUsdc} rate={rate} /></TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <ul className="divide-y divide-line sm:hidden">
        {invoices.map((inv) => {
          const urgent = URGENT.has(inv.status);
          return (
            <li key={inv.id} className="relative flex items-center gap-3 px-5 py-3 transition-colors duration-(--dur-fast) hover:bg-paper-2/50">
              <Avatar name={buyerName(inv.buyerId)} size="sm" shape="square" />
              <div className="min-w-0 flex-1">
                <Link href={`/invoices/${inv.id}`} className="block truncate text-base font-medium text-ink after:absolute after:inset-0 after:content-['']">
                  {buyerName(inv.buyerId)}
                </Link>
                <p className="truncate text-sm tabular text-ink-2">
                  {inv.number}
                  <span className={urgent ? "font-medium text-overdue-fg" : ""}> · {inv.status === "overdue" ? dueLabel(inv.dueDate) : `Due ${formatDate(inv.dueDate)}`}</span>
                </p>
                <div className="mt-1.5"><StatusPill status={inv.status} /></div>
              </div>
              <MoneyCell usdc={inv.amountUsdc} rate={rate} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
