import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyCell } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { formatDateTime, relativeTime } from "@/lib/ui/format";
import type { BnmRate, Buyer, Invoice } from "@/lib/ui/types";

export function RecentPayments({ payments, buyers, rate }: { payments: Invoice[]; buyers: Buyer[]; rate: BnmRate }) {
  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.name ?? "Unknown buyer";
  return (
    <Card padded={false} className="overflow-hidden">
      <CardHeader
        className="px-5 pt-5 sm:px-6 sm:pt-6"
        title="Recent payments"
        caption="Landed as USDC, in your buyers' own accounts"
        aside={<Link href="/invoices?status=settled" className="font-medium text-accent underline-offset-4 hover:underline">All paid</Link>}
      />
      {payments.length === 0 ? (
        <EmptyState compact title="No payments yet" body="The first one shows here the second it lands." />
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {payments.map((inv) => (
            <li key={inv.id}>
              <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors duration-(--dur-fast) hover:bg-paper-2/50 sm:px-6">
                <Avatar name={buyerName(inv.buyerId)} size="sm" shape="square" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink" title={buyerName(inv.buyerId)}>{buyerName(inv.buyerId)}</span>
                  <span className="block truncate text-sm tabular text-ink-2" title={inv.paidAt ? `${formatDateTime(inv.paidAt)} MYT` : undefined}>
                    {inv.number} · {inv.paidAt ? relativeTime(inv.paidAt) : ""}
                  </span>
                </span>
                <span className="hidden sm:inline-flex"><StatusPill status={inv.status} /></span>
                <MoneyCell usdc={inv.amountUsdc} rate={rate} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
