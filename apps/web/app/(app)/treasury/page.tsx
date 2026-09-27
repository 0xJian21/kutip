import type { Metadata } from "next";
import Link from "next/link";
import { Address } from "@/components/ui/address";
import { MoneyCell, MoneyFigure } from "@/components/ui/money";
import { Facts, PageHeader, Panel } from "@/components/ui/panel";
import { ownerData } from "@/lib/server/data";
import { scenarioFrom } from "@/lib/ui/scenario";
import { formatDateTime, relativeTime, shortAddress } from "@/lib/ui/format";
import { bpsDiff, formatBps, formatRate, formatUsdc } from "@/lib/ui/money";

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

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
        <div className="grid content-start gap-6">
          <Panel title="Main treasury" aside={<Address value={t.mainVault} />}>
            <MoneyFigure usdc={t.mainBalanceUsdc} rate={t.rate} size="xl" label="Balance" />
            <p className="mt-3 text-sm text-ink-2">
              {inBuyerAccounts > 0n ? `Plus ${formatUsdc(inBuyerAccounts)} USD waiting in buyer accounts for tonight's sweep.` : "Nothing waiting in buyer accounts."}
              <span className="text-ink-3"> Owner: your passkey. Agent: sweep only.</span>
            </p>
          </Panel>

          <Panel title="Buyer receiving accounts" aside="One per buyer, so buyers can't see each other" padded={false}>
            <table className="w-full text-base">
              <thead className="bg-paper-2 text-sm text-ink-2">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left font-medium sm:px-6">Buyer</th>
                  <th scope="col" className="hidden px-4 py-2 text-left font-medium sm:table-cell">Account</th>
                  <th scope="col" className="px-4 py-2 text-left font-medium">Last sweep</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium sm:px-6">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {t.buyerAccounts.map(({ buyer, balanceUsdc, lastSweepAt }) => (
                  <tr key={buyer.id}>
                    <td className="px-4 py-3 sm:px-6">
                      <p className="text-ink">{buyer.name}</p>
                      <p className="text-sm text-ink-3 sm:hidden">{shortAddress(buyer.vault)}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell"><Address value={buyer.vault} /></td>
                    <td className="px-4 py-3 text-ink-2" title={lastSweepAt ? formatDateTime(lastSweepAt) : undefined}>{lastSweepAt ? relativeTime(lastSweepAt) : "Never"}</td>
                    <td className="px-4 py-3 text-right sm:px-6">
                      {balanceUsdc > 0n ? <MoneyCell usdc={balanceUsdc} rate={t.rate} /> : <span className="tabular text-ink-3">0.00</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Sweeps">
            <Facts
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
              Sweeps run at a random time and batch several buyers, so amounts on chain don&apos;t map to single invoices. <Link href="/rulebook" className="text-accent underline-offset-4 hover:underline">Change in the rulebook</Link>.
            </p>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Cash out to ringgit" aside={alert ? <span className="font-medium text-paid-fg">Good time</span> : undefined}>
            <Facts
              items={[
                { label: "USD to MYR today", value: <span className="font-semibold">{formatRate(t.cashOut.currentRate)}</span> },
                { label: "30-day average", value: formatRate(t.cashOut.thirtyDayAvg), muted: true },
                { label: "Difference", value: <span className={rateDiff >= 0n ? "text-paid-fg" : "text-overdue-fg"}>{formatBps(rateDiff)}</span> },
                { label: "You asked to be told at", value: `+${formatBps(t.cashOut.alertMarginBps).slice(1)}`, muted: true },
              ]}
            />
            <div className="mt-4 rounded-md bg-paper p-4">
              <p className="text-base font-medium text-ink">How cash-out works</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-base text-ink-2">
                <li>You send USDC from the treasury to your own account at a licensed Malaysian exchange.</li>
                <li>The exchange converts to ringgit and pays your bank account, usually the same day.</li>
                <li>Kutip never touches ringgit and never holds your money.</li>
              </ol>
              <p className="mt-3 text-sm text-ink-2">Your whitelisted addresses</p>
              <ul className="mt-1 divide-y divide-line">
                {t.cashOut.whitelisted.map((w) => (
                  <li key={w.address} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-base text-ink">{w.label}</span>
                    <Address value={w.address} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">Sending to any other address needs a new proposal signed with your passkey.</p>
            </div>
          </Panel>

          <Panel title="Who can do what">
            <Facts
              items={[
                { label: "You (passkey)", value: "Everything" },
                { label: "Kutip agent", value: "Sweep into treasury, up to the daily limit" },
                { label: "Kutip fee payer", value: "Pays network fees only", muted: true },
                { label: "Treasury account", value: <Address value={exporter.treasuryMultisig} />, muted: true },
              ]}
            />
            <p className="mt-3 text-xs text-ink-3">Funds are in a Squads multisig you control. Kutip holds a limited agent key and a small fee-payer float, nothing else.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
