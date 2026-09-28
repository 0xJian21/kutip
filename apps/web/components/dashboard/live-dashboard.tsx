"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Funnel, StackedColumns } from "@/components/ui/charts";
import { CommandBar } from "@/components/ui/command-bar";
import { Stat } from "@/components/ui/stat";
import { fetchDashboard } from "@/lib/data/actions";
import { debounce, useBroadcast } from "@/lib/data/live";
import { mockData } from "@/lib/mock";
import { MOCK } from "@/lib/ui/data";
import type { Buyer, DashboardSummary, Exporter, Invoice } from "@/lib/ui/types";
import { collectionsFunnel, deltaBps, funnelEmphasis, invoicedByMonth, monthKey, paidInMonth, previousMonthKey, recentPayments } from "./summaries";
import { NeedsYou } from "./needs-you";
import { RecentPayments } from "./recent-payments";
import { TreasuryHero } from "./treasury-hero";

/**
 * Dashboard body. Server-rendered from the initial summary, then re-fetched
 * whenever the data layer reports a change (a payment landing, an approval).
 */
export function LiveDashboard({
  initial,
  buyers,
  invoices,
  exporter,
  exporterId,
}: {
  exporterId: string;
  initial: DashboardSummary;
  buyers: Buyer[];
  invoices: Invoice[];
  exporter: Exporter;
}) {
  const [summary, setSummary] = useState(initial);

  const refresh = useMemo(() => debounce(() => void (MOCK ? mockData.getDashboard() : fetchDashboard()).then(setSummary).catch(() => {})), []);
  useEffect(() => (MOCK ? mockData.subscribeChanges(refresh) : undefined), [refresh]);
  useBroadcast(MOCK ? null : `owner:${exporterId}`, refresh);

  const now = new Date();
  const funnel = collectionsFunnel(invoices, summary.rate);
  const byMonth = invoicedByMonth(invoices, summary.rate, now);
  const receivedDelta = deltaBps(paidInMonth(invoices, monthKey(now.toISOString())), paidInMonth(invoices, previousMonthKey(now)));
  const recent = recentPayments(invoices);

  return (
    <div className="grid gap-5 lg:gap-6">
      <Card padded={false}>
        {/* One card, four stats. Hairlines between them: stacked on phones, 2×2 on tablets, a row on wide screens. */}
        <div className="grid divide-y divide-line [&>*]:border-line sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(odd)]:border-r sm:max-xl:[&>*:nth-child(-n+2)]:border-b xl:grid-cols-4 xl:[&>*:not(:last-child)]:border-r">
          <Stat className="px-5 py-5 sm:px-6" label="Received this month" usdc={summary.receivedThisMonthUsdc} rate={summary.rate} delta={receivedDelta ?? undefined} deltaLabel="vs last month" />
          <Stat className="px-5 py-5 sm:px-6" label="Outstanding" usdc={summary.outstandingUsdc} rate={summary.rate} />
          <Stat
            className="px-5 py-5 sm:px-6"
            label="Overdue"
            usdc={summary.overdueUsdc}
            rate={summary.rate}
            footer={
              summary.overdueCount > 0 ? (
                <Link href="/invoices?status=overdue" className="font-medium text-overdue-fg underline-offset-4 hover:underline">
                  {summary.overdueCount} {summary.overdueCount === 1 ? "invoice" : "invoices"} overdue
                </Link>
              ) : (
                <span className="text-ink-3">Nothing overdue</span>
              )
            }
          />
          <Stat className="px-5 py-5 sm:px-6" label="In treasury" usdc={summary.treasuryBalanceUsdc} rate={summary.rate} footer={<Link href="/treasury" className="font-medium text-accent underline-offset-4 hover:underline">Open treasury</Link>} />
        </div>
      </Card>

      <CommandBar suggestions={["What’s due this week?", "Who hasn’t paid?", "Sweep now", "Cash out RM 10k"]} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <Card>
            <CardHeader title="Collections" caption="Every invoice sent, by where its money is now" />
            <Funnel stages={funnel} emphasis={funnelEmphasis(funnel)} className="mt-5" height={150} />
          </Card>
          <Card>
            <CardHeader title="Invoiced by month" caption="Received against still open, last six months" />
            <StackedColumns points={byMonth} className="mt-4" height={130} />
          </Card>
          <RecentPayments payments={recent} buyers={buyers} rate={summary.rate} />
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <TreasuryHero
            balanceUsdc={summary.treasuryBalanceUsdc}
            rate={summary.rate}
            vault={exporter.treasuryVault}
            waitingUsdc={summary.waitingInBuyerAccountsUsdc}
            dailyLimitUsdc={exporter.rulebook.treasury.agentDailyLimitUsdc}
            demoFunds={exporter.demoFunds}
          />
          <NeedsYou actions={summary.activity} attention={summary.attention} buyers={buyers} invoices={invoices} rate={summary.rate} />
        </div>
      </div>
    </div>
  );
}
