"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActionRow } from "@/components/agent/action-row";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { MoneyFigure } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { data } from "@/lib/ui/data";
import type { Buyer, DashboardSummary, Invoice } from "@/lib/ui/types";

/**
 * Dashboard body. Server-rendered from the initial summary, then re-fetched
 * whenever the data layer reports a change (a payment landing, an approval).
 */
export function LiveDashboard({
  initial,
  buyers,
  invoices,
}: {
  initial: DashboardSummary;
  buyers: Buyer[];
  invoices: Invoice[];
}) {
  const [summary, setSummary] = useState(initial);

  useEffect(() => {
    let alive = true;
    const refresh = () => data.getDashboard().then((s) => alive && setSummary(s)).catch(() => {});
    const unsubscribe = data.subscribeChanges(refresh);
    refresh();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const numberOf = (id?: string) => invoices.find((i) => i.id === id)?.number;

  return (
    <div className="grid gap-6 lg:gap-8">
      <section aria-label="This month" className="grid gap-6 rounded-md border border-line bg-surface p-5 sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-8 sm:p-6">
        <MoneyFigure usdc={summary.receivedThisMonthUsdc} rate={summary.rate} size="xl" label="Received this month" />
        <div className="grid gap-5 sm:col-span-2 sm:grid-cols-3 sm:border-l sm:border-line sm:pl-8">
          <MoneyFigure usdc={summary.outstandingUsdc} rate={summary.rate} size="md" label="Outstanding" footnote={false} />
          <div>
            <MoneyFigure usdc={summary.overdueUsdc} rate={summary.rate} size="md" label="Overdue" footnote={false} />
            {summary.overdueCount > 0 ? (
              <Link href="/invoices?status=overdue" className="mt-1 inline-block text-sm font-medium text-overdue-fg underline-offset-4 hover:underline">
                {summary.overdueCount} {summary.overdueCount === 1 ? "invoice" : "invoices"} overdue
              </Link>
            ) : null}
          </div>
          <MoneyFigure usdc={summary.treasuryBalanceUsdc} rate={summary.rate} size="md" label="In treasury" footnote={false} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
        <Panel
          title="Needs attention"
          aside={<Link href="/invoices?status=needs_attention" className="text-accent underline-offset-4 hover:underline">All invoices</Link>}
          padded={false}
        >
          <InvoiceTable
            invoices={summary.attention}
            buyers={buyers}
            rate={summary.rate}
            empty={
              <EmptyState
                compact
                title="Nothing needs you right now"
                body="Overdue, disputed and partly paid invoices show up here."
                action={<ButtonLink variant="secondary" href="/invoices/new">Create an invoice</ButtonLink>}
              />
            }
          />
        </Panel>

        <Panel
          title="Agent activity"
          aside={<Link href="/agent" className="text-accent underline-offset-4 hover:underline">Everything</Link>}
          padded={false}
        >
          {summary.activity.length === 0 ? (
            <EmptyState compact title="The agent hasn't done anything yet" body="Reminders, replies and sweeps will be listed here with a reason for each." />
          ) : (
            <div className="divide-y divide-line">
              {summary.activity.slice(0, 5).map((a) => (
                <ActionRow key={a.id} action={a} buyers={buyers} invoiceNumber={numberOf(a.invoiceId)} compact />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
