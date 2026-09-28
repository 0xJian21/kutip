import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Address } from "@/components/ui/address";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader, HeroCard, Inset } from "@/components/ui/card";
import { Meter } from "@/components/ui/charts";
import { Amount, MoneyCell } from "@/components/ui/money";
import { Facts, PageHeader } from "@/components/ui/panel";
import { Chip } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import { formatDateTime, relativeTime, shortAddress, solscanAccount } from "@/lib/ui/format";
import { bpsDiff, formatBps, formatRate, formatUsdc, toMyr } from "@/lib/ui/money";

export const metadata: Metadata = { title: "Treasury" };

export default async function TreasuryPage({ searchParams }: PageProps<"/treasury">) {
  const data = await ownerData();
  const scenario = scenarioFrom(await searchParams);
  const [t, exporter] = await Promise.all([data.getTreasury({ scenario }), data.getExporter()]);
  const rateDiff = bpsDiff(t.cashOut.currentRate.myrPerUsd, t.cashOut.thirtyDayAvg.myrPerUsd);
  const alert = rateDiff >= t.cashOut.alertMarginBps;
  const inBuyerAccounts = t.buyerAccounts.reduce((s, a) => s + a.balanceUsdc, 0n);

  return (
    <>
      <PageHeader title="Treasury" lede="Your money sits in your own Squads account. Kutip's agent can only sweep buyer accounts into it, within the daily limit you set." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <HeroCard>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-on-hero-2">In your treasury</p>
              <a href={solscanAccount(t.mainVault)} target="_blank" rel="noopener noreferrer" className="rounded-full">
                <Chip tone="hero">Verified on Solana <ArrowUpRight size={12} aria-hidden="true" /></Chip>
              </a>
            </div>
            <Amount sen={toMyr(t.mainBalanceUsdc, t.rate)} size="2xl" tone="hero" className="mt-2" />
            <p className="mt-1.5 text-sm tabular text-on-hero-2">{formatUsdc(t.mainBalanceUsdc)} USDC · BNM rate {formatRate(t.rate)} · {shortAddress(t.mainVault)}</p>
            <Meter
              tone="hero"
              className="mt-6 max-w-md"
              label="Waiting in buyer accounts, against the agent's daily cap"
              value={Number(inBuyerAccounts / 1_000_000n)}
              max={Number(t.agentDailyLimitUsdc / 1_000_000n)}
              valueText={`USD ${formatUsdc(inBuyerAccounts)}`}
              maxText={`${formatUsdc(t.agentDailyLimitUsdc, 0)} a day`}
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="hero" disabled title="Manual sweep arrives with the treasury update">Sweep now</Button>
              <a href="#cash-out" className={buttonClass("heroOutline")}>Cash out to ringgit</a>
            </div>
          </HeroCard>

          <Card padded={false} className="overflow-hidden">
            <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6" title="Buyer receiving accounts" caption="One per buyer, so buyers can't see each other. Swept into the treasury daily." />
            <Table className="mt-4">
              <THead>
                <tr>
                  <TH>Buyer</TH>
                  <TH className="hidden sm:table-cell">Account</TH>
                  <TH className="hidden sm:table-cell">Last sweep</TH>
                  <TH align="right">Waiting</TH>
                </tr>
              </THead>
              <TBody>
                {t.buyerAccounts.map(({ buyer, balanceUsdc, lastSweepAt }) => (
                  <TR key={buyer.id}>
                    <TD className="w-full max-w-0">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={buyer.name} size="sm" shape="square" />
                        <span className="min-w-0">
                          <span className="block truncate text-ink">{buyer.name}</span>
                          <span className="block text-xs tabular text-ink-3 sm:hidden">{shortAddress(buyer.vault)} · swept {lastSweepAt ? relativeTime(lastSweepAt) : "never"}</span>
                        </span>
                      </span>
                    </TD>
                    <TD className="hidden whitespace-nowrap sm:table-cell"><Address value={buyer.vault} /></TD>
                    <TD className="hidden whitespace-nowrap text-ink-2 sm:table-cell" title={lastSweepAt ? formatDateTime(lastSweepAt) : undefined}>{lastSweepAt ? relativeTime(lastSweepAt) : "Never"}</TD>
                    <TD align="right">
                      {balanceUsdc > 0n ? <MoneyCell usdc={balanceUsdc} rate={t.rate} /> : <span className="tabular text-ink-3">0.00</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Sweeps" caption="Random time each day, several buyers in one transaction" />
            <Facts
              className="mt-4"
              items={[
                ...(t.lastSweep
                  ? [
                      { label: "Last sweep", value: `${formatDateTime(t.lastSweep.executedAt ?? t.lastSweep.scheduledFor)} MYT` },
                      { label: "Moved", value: `${formatUsdc(t.lastSweep.amountUsdc)} USDC from ${t.lastSweep.buyerIds.length} accounts` },
                      { label: "Transaction", value: t.lastSweep.signature ? <Address value={t.lastSweep.signature} kind="tx" label="View on Solscan" /> : "—", muted: true },
                    ]
                  : []),
                { label: "Next sweep", value: t.nextSweep ? `Today, around ${formatDateTime(t.nextSweep.scheduledFor).split(", ")[1]} MYT` : "Not scheduled", muted: true },
                { label: "Agent limit", value: `USD ${formatUsdc(t.agentDailyLimitUsdc, 0)} per account per day`, muted: true },
              ]}
            />
            <p className="mt-3 text-sm text-ink-3">
              Amounts on chain don&apos;t map to single invoices. <Link href="/rulebook" className="text-accent underline-offset-4 hover:underline">Change in the rulebook</Link>.
            </p>
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:gap-6">
          <Card id="cash-out">
            <CardHeader title="Cash out to ringgit" aside={alert ? <Chip tone="accent">Good time</Chip> : undefined} />
            <div className="mt-4 flex items-baseline justify-between gap-4">
              <span className="text-sm text-ink-2">USD to MYR today</span>
              <span className="money text-money-md text-ink">{formatRate(t.cashOut.currentRate)}</span>
            </div>
            <Facts
              className="mt-3"
              items={[
                { label: "30-day average", value: formatRate(t.cashOut.thirtyDayAvg), muted: true },
                { label: "Difference", value: <span className={rateDiff >= 0n ? "text-paid-fg" : "text-overdue-fg"}>{formatBps(rateDiff)}</span> },
                { label: "You asked to be told at", value: `+${formatBps(t.cashOut.alertMarginBps).slice(1)}`, muted: true },
              ]}
            />
            <Button variant="secondary" className="mt-5 w-full" disabled title="Cash-out proposals arrive with the treasury update">Cash out</Button>
            <Inset className="mt-5 p-4">
              <p className="text-base font-medium text-ink">How cash-out works</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
                <li>You send USDC from the treasury to your own account at a licensed Malaysian exchange.</li>
                <li>The exchange converts to ringgit and pays your bank account, usually the same day.</li>
                <li>Kutip never touches ringgit and never holds your money.</li>
              </ol>
              <p className="mt-3 text-sm font-medium text-ink">Your whitelisted addresses</p>
              <ul className="mt-1 divide-y divide-line">
                {t.cashOut.whitelisted.map((w) => (
                  <li key={w.address} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-ink">{w.label}</span>
                    <Address value={w.address} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">Sending to any other address needs a new proposal signed with your passkey.</p>
            </Inset>
          </Card>

          <Card>
            <CardHeader title="Who can do what" />
            <Facts
              className="mt-4"
              items={[
                { label: "You (passkey)", value: "Everything" },
                { label: "Kutip agent", value: "Sweep into treasury, up to the daily limit" },
                { label: "Kutip fee payer", value: "Pays network fees only", muted: true },
                { label: "Treasury account", value: <Address value={exporter.treasuryMultisig} />, muted: true },
              ]}
            />
            <p className="mt-3 text-xs text-ink-3">Funds are in a Squads multisig you control. Kutip holds a limited agent key and a small fee-payer float, nothing else.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
