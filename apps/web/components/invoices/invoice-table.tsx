import Link from "next/link";
import { MoneyCell } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
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
      <table className="hidden w-full text-base sm:table">
        <thead className="bg-paper-2 text-sm text-ink-2">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium sm:px-6">Invoice</th>
            <th scope="col" className="px-4 py-2 text-left font-medium">Buyer</th>
            <th scope="col" className="px-4 py-2 text-left font-medium">Due</th>
            <th scope="col" className="px-4 py-2 text-left font-medium">Status</th>
            <th scope="col" className="px-4 py-2 text-right font-medium sm:px-6">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {invoices.map((inv) => {
            const urgent = URGENT.has(inv.status);
            return (
              <tr key={inv.id} className="group relative transition-colors duration-(--dur-fast) hover:bg-paper-2/60">
                <td className="px-4 py-3 sm:px-6">
                  <Link href={`/invoices/${inv.id}`} className="whitespace-nowrap tabular font-medium text-ink after:absolute after:inset-0 after:content-['']">
                    {inv.number}
                  </Link>
                </td>
                <td className="max-w-[26ch] truncate px-4 py-3 text-ink">{buyerName(inv.buyerId)}</td>
                <td className={`whitespace-nowrap px-4 py-3 tabular ${urgent ? "font-medium text-overdue-fg" : "text-ink-2"}`}>
                  <span>{formatDate(inv.dueDate)}</span>
                  {inv.status === "overdue" ? <span className="block text-xs">{dueLabel(inv.dueDate)}</span> : null}
                </td>
                <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3 text-right sm:px-6"><MoneyCell usdc={inv.amountUsdc} rate={rate} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-line sm:hidden">
        {invoices.map((inv) => {
          const urgent = URGENT.has(inv.status);
          return (
            <li key={inv.id} className="relative px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-paper-2/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/invoices/${inv.id}`} className="block truncate text-base font-medium text-ink after:absolute after:inset-0 after:content-['']">
                    {buyerName(inv.buyerId)}
                  </Link>
                  <p className="mt-0.5 text-sm tabular text-ink-2">
                    {inv.number}
                    <span className={urgent ? "text-overdue-fg font-medium" : ""}> · {inv.status === "overdue" ? dueLabel(inv.dueDate) : `Due ${formatDate(inv.dueDate)}`}</span>
                  </p>
                </div>
                <MoneyCell usdc={inv.amountUsdc} rate={rate} />
              </div>
              <div className="mt-2"><StatusPill status={inv.status} /></div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
