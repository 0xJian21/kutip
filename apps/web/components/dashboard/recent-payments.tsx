import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyCell } from "@/components/ui/money";
import { RowItem, RowList } from "@/components/ui/row-list";
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
        <RowList className="mt-3" label="Recent payments">
          {payments.map((inv) => (
            <RowItem
              key={inv.id}
              href={`/invoices/${inv.id}`}
              lead={<Avatar name={buyerName(inv.buyerId)} size="sm" shape="square" />}
              amount={<MoneyCell usdc={inv.amountUsdc} rate={rate} />}
              status={<StatusPill status={inv.status} />}
            >
              <span className="line-clamp-2 text-base font-medium leading-snug text-ink" title={buyerName(inv.buyerId)}>{buyerName(inv.buyerId)}</span>
              <span className="block text-sm tabular text-ink-2" title={inv.paidAt ? `${formatDateTime(inv.paidAt)} MYT` : undefined}>
                <span className="whitespace-nowrap">{inv.number}</span> · <span className="whitespace-nowrap">{inv.paidAt ? relativeTime(inv.paidAt) : ""}</span>
              </span>
            </RowItem>
          ))}
        </RowList>
      )}
    </Card>
  );
}
