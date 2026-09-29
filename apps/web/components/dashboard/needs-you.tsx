import Link from "next/link";
import { ActionRow } from "@/components/agent/action-row";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyCell } from "@/components/ui/money";
import { RowItem, RowList } from "@/components/ui/row-list";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/states";
import { dueLabel } from "@/lib/ui/format";
import type { AgentAction, BnmRate, Buyer, Invoice } from "@/lib/ui/types";

const NEEDS_YOU = new Set<AgentAction["status"]>(["proposed", "escalated"]);
const URGENT = new Set<Invoice["status"]>(["overdue", "disputed"]);

/**
 * "Agent needs you": approvals and escalations first (with their Approve /
 * Reject controls), then overdue and disputed invoices. Everything else the
 * agent handles on its own and reports under Agent activity.
 */
export function NeedsYou({
  actions,
  attention,
  buyers,
  invoices,
  rate,
}: {
  actions: AgentAction[];
  attention: Invoice[];
  buyers: Buyer[];
  invoices: Invoice[];
  rate: BnmRate;
}) {
  const pending = actions.filter((a) => NEEDS_YOU.has(a.status)).slice(0, 3);
  const urgent = attention.filter((i) => URGENT.has(i.status)).slice(0, 4);
  const total = actions.filter((a) => NEEDS_YOU.has(a.status)).length + attention.filter((i) => URGENT.has(i.status)).length;
  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.name ?? "Unknown buyer";
  const numberOf = (id?: string) => invoices.find((i) => i.id === id)?.number;

  return (
    <Card padded={false} className="overflow-hidden">
      <CardHeader
        className="px-5 pt-5 sm:px-6 sm:pt-6"
        title="Agent needs you"
        caption={total === 0 ? "Nothing waiting on you" : `${total} ${total === 1 ? "item" : "items"} waiting on you`}
        aside={<Link href="/agent" className="font-medium text-accent underline-offset-4 hover:underline">See all</Link>}
      />
      {total === 0 ? (
        <EmptyState compact title="All handled" body="Approvals, escalations, overdue and disputed invoices show up here." />
      ) : (
        <div className="mt-3 divide-y divide-line">
          {pending.map((a) => (
            <ActionRow key={a.id} action={a} buyers={buyers} invoiceNumber={numberOf(a.invoiceId)} compact />
          ))}
          {urgent.length ? (
            <RowList stacked label="Invoices that need you">
              {urgent.map((inv) => (
                <RowItem
                  key={inv.id}
                  stacked
                  href={`/invoices/${inv.id}`}
                  lead={<Avatar name={buyerName(inv.buyerId)} size="sm" shape="square" />}
                  amount={<MoneyCell usdc={inv.amountUsdc} rate={rate} />}
                  status={<StatusPill status={inv.status} />}
                >
                  <span className="line-clamp-2 text-base font-medium leading-snug text-ink" title={buyerName(inv.buyerId)}>{buyerName(inv.buyerId)}</span>
                  <span className="flex flex-wrap gap-x-1.5 text-sm tabular text-ink-2">
                    <span className="whitespace-nowrap">{inv.number}</span>
                    {inv.status === "overdue" ? <span className="whitespace-nowrap font-medium text-overdue-fg">{dueLabel(inv.dueDate)}</span> : null}
                  </span>
                </RowItem>
              ))}
            </RowList>
          ) : null}
        </div>
      )}
    </Card>
  );
}
