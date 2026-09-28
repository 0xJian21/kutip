import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, MoreHorizontal, Upload } from "lucide-react";
import { Avatar, KutipMark } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader, HeroCard, Inset } from "@/components/ui/card";
import { DotMatrix, Funnel, Meter, StackedColumns } from "@/components/ui/charts";
import { CommandBar } from "@/components/ui/command-bar";
import { Checkbox, DateInput, Field, Input, PrefixedInput, Select, Textarea } from "@/components/ui/field";
import { Amount, MoneyCell, MoneyFigure } from "@/components/ui/money";
import { Facts } from "@/components/ui/panel";
import { Delta, Stat } from "@/components/ui/stat";
import { AgentStatusPill, Chip, StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DesignTabs } from "@/components/design/design-tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { INVOICE_STATUS_HINT, type InvoiceStatus } from "@/lib/ui/status";
import { formatUsdc, toMyr, type BnmRate } from "@/lib/ui/money";

export const metadata: Metadata = { title: "Design" };

const rate: BnmRate = { myrPerUsd: 42150n, date: "2026-09-28" };

const swatches: { name: string; token: string; note: string }[] = [
  { name: "Paper", token: "bg-paper", note: "The canvas" },
  { name: "Paper 2", token: "bg-paper-2", note: "Quiet fills, tracks, table headers" },
  { name: "Surface", token: "bg-surface", note: "Cards" },
  { name: "Well", token: "bg-well", note: "Inset inside a card" },
  { name: "Line", token: "bg-line", note: "Hairlines" },
  { name: "Ink 3", token: "bg-ink-3", note: "Captions, decimals" },
  { name: "Ink 2", token: "bg-ink-2", note: "Secondary text" },
  { name: "Ink", token: "bg-ink", note: "Text, the black button" },
  { name: "Accent", token: "bg-accent", note: "Violet. Press, focus, live" },
  { name: "Accent soft", token: "bg-accent-soft", note: "Selected, highlighted" },
];

const statuses: InvoiceStatus[] = ["draft", "sent", "seen", "paid", "settled", "partially_paid", "overdue", "disputed"];

const rows: { number: string; buyer: string; due: string; status: InvoiceStatus; usdc: bigint }[] = [
  { number: "INV-2026-0142", buyer: "Harbourline Interiors Pty Ltd", due: "3 Oct 2026", status: "overdue", usdc: 11_437_500_000n },
  { number: "INV-2026-0147", buyer: "Meridian Hospitality Group", due: "12 Oct 2026", status: "seen", usdc: 8_250_000_000n },
  { number: "INV-2026-0139", buyer: "Al Rashid Furnishing", due: "28 Sep 2026", status: "settled", usdc: 22_800_000_000n },
  { number: "INV-2026-0151", buyer: "Kobayashi Living Co.", due: "30 Oct 2026", status: "sent", usdc: 5_960_000_000n },
];

const funnel = [
  { key: "sent", label: "Sent", value: 214_000, display: "RM 214k", hint: "12 invoices" },
  { key: "seen", label: "Payment seen", value: 168_000, display: "RM 168k", hint: "9 invoices" },
  { key: "paid", label: "Paid", value: 161_000, display: "RM 161k", hint: "8 invoices" },
  { key: "settled", label: "Settled", value: 148_000, display: "RM 148k", hint: "7 in treasury" },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ key: d, label: d, value: [1, 3, 2, 6, 4, 0, 1][i]!, display: `${[1, 3, 2, 6, 4, 0, 1][i]} payments` }));

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m, i) => ({
  key: m,
  label: m,
  received: [92, 121, 88, 140, 132, 148][i]!,
  outstanding: [12, 8, 30, 10, 26, 66][i]!,
  receivedText: `RM ${[92, 121, 88, 140, 132, 148][i]}k`,
  outstandingText: `RM ${[12, 8, 30, 10, 26, 66][i]}k`,
}));

function Section({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-line py-10 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {note ? <p className="mt-1 max-w-[28ch] text-sm text-ink-2">{note}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6">
      <header className="flex items-start justify-between gap-4 pb-10">
        <div>
          <div className="flex items-center gap-2">
            <KutipMark size={28} />
            <p className="text-sm text-ink-2">Kutip design direction, Session 8</p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Daylight ledger</h1>
          <p className="mt-3 max-w-[60ch] text-md text-ink-2">
            A light finance dashboard a Muar finance admin trusts, with one violet card that says the money is on chain.
            Grey canvas, white cards, bold numerals, ringgit first. Hatched where money is still owed, solid where it has landed.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Treasury hero" note="The only gradient and the only dark surface in the product. Balance, two actions, one proof chip.">
        <HeroCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-on-hero-2">In your treasury</p>
              <Amount sen={toMyr(126_431_200_000n, rate)} size="2xl" tone="hero" className="mt-2" />
              <p className="mt-1.5 text-base tabular text-on-hero-2">{formatUsdc(126_431_200_000n)} USDC · BNM rate 4.2150</p>
            </div>
            <Chip tone="hero">
              Verified on Solana <ArrowUpRight size={12} aria-hidden="true" />
            </Chip>
          </div>
          <Meter tone="hero" className="mt-6 max-w-md" label="Swept today of the agent's daily cap" value={1500} max={5000} valueText="USD 1,500" maxText="5,000" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="hero">Sweep now</Button>
            <Button variant="heroOutline">Cash out to ringgit</Button>
          </div>
        </HeroCard>
      </Section>

      <Section title="KPI row" note="Four stats, deltas against last month. Ringgit large and bold, decimals muted, USD beneath.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Stat label="Received this month" usdc={82_751_500_000n} rate={rate} delta={790n} deltaLabel="vs last month" />
          </Card>
          <Card>
            <Stat label="Outstanding" usdc={159_912_500_000n} rate={rate} delta={-320n} deltaGood={false} deltaLabel="vs last month" />
          </Card>
          <Card>
            <Stat
              label="Overdue"
              usdc={34_287_500_000n}
              rate={rate}
              delta={1210n}
              deltaGood={false}
              footer={<Link href="#" className="font-medium text-overdue-fg underline-offset-4 hover:underline">3 invoices overdue</Link>}
            />
          </Card>
          <Card>
            <Stat label="In treasury" usdc={126_431_200_000n} rate={rate} delta={0n} footer={<span className="text-ink-3">Swept last night, 02:14</span>} />
          </Card>
        </div>
      </Section>

      <Section title="Money" note="One family for everything. Bold for money, decimals in Ink 3, RM at half size. Tabular only in columns.">
        <Card>
          <div className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <MoneyFigure usdc={82_751_500_000n} rate={rate} size="2xl" label="Received this month" />
            <div className="grid gap-4 sm:border-l sm:border-line sm:pl-6">
              <MoneyFigure usdc={11_437_500_000n} rate={rate} size="md" label="Outstanding" footnote={false} />
              <MoneyFigure usdc={50_000_000n} rate={rate} size="sm" label="Invoice INV-2026-0152" footnote={false} />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Charts" note="One hue. Solid where money has landed, hatched where it is still owed. Every mark has a label and a hover pill.">
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Collections this month" caption="Sent → Seen → Paid → Settled" aside={<IconButton size="sm" aria-label="More"><MoreHorizontal size={16} /></IconButton>} />
            <Funnel stages={funnel} emphasis="paid" className="mt-5" />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Payments this week" caption="Per day, buyers' local time" />
              <div className="mt-2 flex items-end gap-6">
                <div className="money mb-6 text-money-xl text-ink">17</div>
                <DotMatrix columns={days} className="flex-1" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Received vs outstanding" caption="Last six months, RM thousands" />
              <StackedColumns points={months} className="mt-5" />
            </Card>
          </div>
        </div>
      </Section>

      <Section title="Agent command bar" note="Plain words in, a preview card out. Wired in Session 8c; the shell is here so the dashboard has its place.">
        <CommandBar suggestions={["What’s due this week?", "Remind Najd about INV-0141", "Sweep now", "Cash out RM 10k"]} />
      </Section>

      <Section title="Status" note="The only place colour speaks. A dot and a word; the word does the work.">
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {statuses.map((s) => (
            <li key={s} className="flex items-center gap-3">
              <StatusPill status={s} />
              <span className="text-sm text-ink-2">{INVOICE_STATUS_HINT[s]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          <AgentStatusPill status="proposed" />
          <AgentStatusPill status="approved" />
          <AgentStatusPill status="executed" />
          <AgentStatusPill status="escalated" />
          <AgentStatusPill status="rejected" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip>Rule T2</Chip>
          <Chip>91% confidence</Chip>
          <Chip tone="accent">Verified on Solana <ArrowUpRight size={12} aria-hidden="true" /></Chip>
          <Delta bps={790n} />
          <Delta bps={-320n} />
          <Delta bps={1210n} good={false} />
        </div>
      </Section>

      <Section title="Stepper" note="The invoice life as steps. The current node pulses while a payment is being checked.">
        <Card>
          <Stepper
            steps={[
              { key: "sent", label: "Sent", caption: "24 Sep, 09:00" },
              { key: "seen", label: "Payment seen", caption: "28 Sep, 14:02:11" },
              { key: "paid", label: "Paid", caption: "14:02:12" },
              { key: "settled", label: "Settled", caption: "—" },
            ]}
            done={3}
            live
          />
        </Card>
        <Card className="mt-4">
          <Stepper size="sm" steps={[{ key: "a", label: "Account" }, { key: "b", label: "Company" }, { key: "c", label: "Treasury" }, { key: "d", label: "Agent permissions" }]} done={1} />
        </Card>
      </Section>

      <Section title="Table" note="Buyer logos, tabular figures, amounts on the right. Overdue colours the due date, not the row.">
        <Card padded={false} className="overflow-x-auto">
          <Table className="min-w-[560px]">
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
              {rows.map((r) => (
                <TR key={r.number} interactive>
                  <TD className="whitespace-nowrap tabular font-medium text-ink">{r.number}</TD>
                  <TD className="w-full max-w-0">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.buyer} size="sm" shape="square" />
                      <span className="min-w-0 truncate text-ink">{r.buyer}</span>
                    </span>
                  </TD>
                  <TD className={`whitespace-nowrap tabular ${r.status === "overdue" ? "font-medium text-overdue-fg" : "text-ink-2"}`}>{r.due}</TD>
                  <TD><StatusPill status={r.status} /></TD>
                  <TD align="right"><MoneyCell usdc={r.usdc} rate={rate} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </Section>

      <Section title="Tabs and navigation" note="Pills for top-level and filters (active is ink). A segmented track for view switches.">
        <DesignTabs />
      </Section>

      <Section title="Buttons" note="Violet for the one thing to press. Black for the strong alternative. Outline and ghost for the rest.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Send invoice</Button>
          <Button variant="secondary">Approve</Button>
          <Button variant="outline">Save draft</Button>
          <Button variant="ghost">Reject</Button>
          <IconButton aria-label="More"><MoreHorizontal size={16} /></IconButton>
          <a href="#" className="inline-flex items-center gap-1 text-base font-medium text-accent underline-offset-4 hover:underline">
            View on Solscan <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="lg">Confirm and pay</Button>
          <Button size="sm" variant="outline">Import from PDF</Button>
          <Button size="sm" variant="secondary">Cash out</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Forms" note="40px controls, 12px radius, violet focus ring. Labels above, hints and errors beneath.">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required>
              <Input defaultValue="Teratai Woodworks Sdn. Bhd." />
            </Field>
            <Field label="Buyer" required>
              <Select defaultValue="b1">
                <option value="b1">Harbourline Interiors Pty Ltd</option>
                <option value="b2">Meridian Hospitality Group</option>
              </Select>
            </Field>
            <Field label="Due date" hint="Reminders start 3 days before">
              <DateInput defaultValue="2026-10-17" />
            </Field>
            <Field label="Amount" error="Enter an amount above 0">
              <PrefixedInput prefix="USD" defaultValue="0.00" aria-invalid />
            </Field>
            <Field label="Company logo" className="sm:col-span-2">
              <div className="flex items-center gap-4 rounded-md border border-dashed border-line-strong bg-well p-4">
                <Avatar name="Teratai Woodworks" size="lg" shape="square" />
                <div className="min-w-0 flex-1">
                  <p className="text-base text-ink">Drop a PNG or SVG, or</p>
                  <p className="text-sm text-ink-3">Shown on invoices, the pay page and receipts.</p>
                </div>
                <Button variant="outline" size="sm"><Upload size={14} aria-hidden="true" /> Choose file</Button>
              </div>
            </Field>
            <Field label="Note to buyer" className="sm:col-span-2">
              <Textarea defaultValue="Thank you. Please pay before the due date; scan the QR or open the link in your wallet." />
            </Field>
            <Checkbox label="Escalate to me on any dispute" defaultChecked />
          </div>
        </Card>
      </Section>

      <Section title="Avatars and logos" note="Initials tinted from the name, so a buyer always looks the same. Squares for companies, circles for people.">
        <div className="flex flex-wrap items-end gap-4">
          {["Harbourline Interiors Pty Ltd", "Meridian Hospitality Group", "Al Rashid Furnishing", "Najd Contract Interiors", "Kobayashi Living Co."].map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <Avatar name={n} size="lg" shape="square" />
              <span className="max-w-24 truncate text-xs text-ink-3">{n}</span>
            </div>
          ))}
          <Avatar name="Farid Zulkifli" size="md" />
          <Avatar name="Claire Whitmore" size="sm" />
          <KutipMark size={40} />
        </div>
      </Section>

      <Section title="Receipt" note="A card with facts. Labels left, values right, tabular. A well for the chain proof.">
        <Card className="max-w-md">
          <CardHeader title="Payment received" aside={<StatusPill status="settled" />} />
          <Amount sen={toMyr(50_000_000n, rate)} size="lg" className="mt-4" />
          <Facts
            className="mt-4"
            items={[
              { label: "Buyer paid in SOL", value: "0.2831 SOL" },
              { label: "You received, exactly", value: "50.000000 USDC" },
              { label: "Network fee", value: <span>paid by Kutip <span className="text-ink-3">· buyer paid 0 SOL</span></span>, muted: true },
            ]}
          />
          <Inset className="mt-4 flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="tabular text-ink-2">Final 14:02:24 MYT · slot 450,899,683</span>
            <a href="#" className="inline-flex items-center gap-1 font-medium text-accent underline-offset-4 hover:underline">
              Solscan <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          </Inset>
        </Card>
      </Section>

      <Section title="Type" note="Plus Jakarta Sans throughout. Scale ratio 1.2, weights 400 / 500 / 600 / 700.">
        <div className="space-y-4">
          <p className="text-3xl font-semibold tracking-tight text-ink">Page title, 36/40 semibold</p>
          <p className="text-xl font-semibold tracking-tight text-ink">Section title, 22/28 semibold</p>
          <p className="text-lg font-semibold tracking-tight text-ink">Card title, 18/26 semibold</p>
          <p className="max-w-[65ch] text-md text-ink">
            Prose, 16/24. Harbourline Interiors has not paid invoice INV-2026-0142, which was due three days ago. The agent
            sent a second reminder this morning at 9:00 Sydney time and will escalate to you after one more.
          </p>
          <p className="text-base text-ink">UI text, 14/20. Tables, forms, navigation.</p>
          <p className="text-sm text-ink-2">Meta, 13/18. Timestamps, hints, secondary labels.</p>
          <p className="tabular text-base text-ink-2">Tabular figures: 1,234,567.89 · 0.000001 · 14:02:13 · 7Xk4…q9Zc</p>
          <Amount sen={123_456_789n} size="xl" />
        </div>
      </Section>

      <Section title="Colour" note="Cool neutrals tinted toward violet. One accent. Status colour only on pills and passed due dates.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map((s) => (
            <li key={s.name}>
              <div className={`h-14 rounded-md ring-1 ring-inset ring-line ${s.token}`} />
              <div className="mt-1.5 text-sm font-medium text-ink">{s.name}</div>
              <div className="text-xs text-ink-3">{s.note}</div>
            </li>
          ))}
          <li className="col-span-2 sm:col-span-5">
            <div className="hero-surface h-14 rounded-md" />
            <div className="mt-1.5 text-sm font-medium text-ink">Hero</div>
            <div className="text-xs text-ink-3">Violet to indigo, 135°. Treasury card only.</div>
          </li>
        </ul>
      </Section>

      <Section title="Radius, elevation, spacing" note="Cards 20, hero 24, inputs 12, chips 8. One card shadow, one float, one hero glow.">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex items-end gap-3">
            <div className="h-14 w-14 rounded-sm bg-surface shadow-card" />
            <div className="h-14 w-14 rounded-md bg-surface shadow-card" />
            <div className="h-14 w-14 rounded-xl bg-surface shadow-card" />
            <div className="h-14 w-14 rounded-2xl bg-surface shadow-float" />
            <div className="hero-surface h-14 w-14 rounded-2xl" />
          </div>
          <div className="flex items-end gap-3">
            {[4, 8, 12, 16, 24, 32, 48].map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div className="rounded-xs bg-accent-soft-2" style={{ width: n, height: n }} />
                <span className="text-xs tabular text-ink-3">{n}</span>
              </div>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-sm text-ink-2">
            Row link <ChevronRight size={14} aria-hidden="true" />
          </span>
        </div>
      </Section>
    </main>
  );
}
