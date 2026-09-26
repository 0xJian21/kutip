import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StatusPill, AgentStatusPill } from "@/components/ui/status-pill";
import { MoneyCell, MoneyFigure } from "@/components/ui/money";
import { INVOICE_STATUS_HINT, INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/ui/status";
import type { BnmRate } from "@/lib/ui/money";

export const metadata: Metadata = { title: "Design" };

const rate: BnmRate = { myrPerUsd: 42150n, date: "2026-09-26" };

const swatches: { name: string; token: string; note: string }[] = [
  { name: "Paper", token: "bg-paper", note: "Page background" },
  { name: "Paper 2", token: "bg-paper-2", note: "Sidebar, table header, quiet fills" },
  { name: "Surface", token: "bg-surface", note: "Rows and panels that sit on paper" },
  { name: "Line", token: "bg-line", note: "Hairlines" },
  { name: "Line strong", token: "bg-line-strong", note: "Input borders" },
  { name: "Ink 3", token: "bg-ink-3", note: "Muted text" },
  { name: "Ink 2", token: "bg-ink-2", note: "Secondary text" },
  { name: "Ink", token: "bg-ink", note: "Text" },
  { name: "Accent", token: "bg-accent", note: "The RM50 teal. Actions, links, focus" },
  { name: "Accent soft", token: "bg-accent-soft", note: "Selected, highlighted" },
];

const statuses: InvoiceStatus[] = ["draft", "sent", "seen", "paid", "settled", "partially_paid", "overdue", "disputed"];

const rows: { number: string; buyer: string; due: string; status: InvoiceStatus; usdc: bigint }[] = [
  { number: "INV-2026-0142", buyer: "Harbourline Interiors", due: "3 Oct 2026", status: "overdue", usdc: 11_437_500_000n },
  { number: "INV-2026-0147", buyer: "Meridian Hospitality Group", due: "12 Oct 2026", status: "seen", usdc: 8_250_000_000n },
  { number: "INV-2026-0139", buyer: "Al Rashid Furnishing", due: "28 Sep 2026", status: "settled", usdc: 22_800_000_000n },
  { number: "INV-2026-0151", buyer: "Kobayashi Living Co.", due: "30 Oct 2026", status: "sent", usdc: 5_960_000_000n },
];

function Section({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line py-10 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
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
          <p className="text-sm text-ink-2">Kutip design direction</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Calm ledger</h1>
          <p className="mt-3 max-w-[60ch] text-md text-ink-2">
            Cream ledger paper, teal stamp ink, and numbers that behave. A finance admin in Muar should feel they are
            reading a bank statement they already trust. The blockchain is the audit trail in the footnote, never the
            headline.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Money figure" note="Ringgit first, large, in the serif. USD second, small. The BNM rate is a footnote.">
        <div className="rounded-md border border-line bg-surface p-6">
          <MoneyFigure usdc={48_211_400_000n} rate={rate} size="xl" label="Received this month" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-surface p-5">
            <MoneyFigure usdc={11_437_500_000n} rate={rate} size="lg" label="Outstanding" />
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <MoneyFigure usdc={50_000_000n} rate={rate} size="lg" label="Invoice INV-2026-0152" />
          </div>
        </div>
      </Section>

      <Section title="Status" note="The only place colour speaks. Every pill has a label; colour is never the sole signal.">
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
      </Section>

      <Section title="Invoice rows" note="Amounts right-aligned, tabular. Overdue rows carry the due date in colour, not the whole row.">
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-base">
            <thead className="bg-paper-2 text-sm text-ink-2">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Invoice</th>
                <th className="px-4 py-2 text-left font-medium">Buyer</th>
                <th className="px-4 py-2 text-left font-medium">Due</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.number} className="hover:bg-paper-2/60">
                  <td className="px-4 py-3 tabular font-medium text-ink">{r.number}</td>
                  <td className="px-4 py-3 text-ink">{r.buyer}</td>
                  <td className={`px-4 py-3 tabular ${r.status === "overdue" ? "font-medium text-overdue-fg" : "text-ink-2"}`}>{r.due}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-right"><MoneyCell usdc={r.usdc} rate={rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Live status bar" note="The one orchestrated moment: Sent → Seen → Paid → Settled. Fills as the payment lands.">
        <ol className="grid grid-cols-4 gap-2">
          {(["sent", "seen", "paid", "settled"] as const).map((s, i) => {
            const done = i < 3;
            return (
              <li key={s} className="min-w-0">
                <div className={`h-1.5 rounded-full ${done ? "bg-accent" : "bg-line"}`} />
                <div className={`mt-2 truncate text-sm ${done ? "font-medium text-ink" : "text-ink-3"}`}>{INVOICE_STATUS_LABEL[s]}</div>
                <div className="tabular text-xs text-ink-3">{["14:02:11", "14:02:12", "14:02:13", "—"][i]}</div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Type" note="Plus Jakarta Sans for everything you read. Source Serif 4 only when money is stated.">
        <div className="space-y-4">
          <p className="text-2xl font-semibold tracking-tight text-ink">Page title, 28/32 semibold</p>
          <p className="text-xl font-semibold text-ink">Section title, 22/28 semibold</p>
          <p className="text-lg font-medium text-ink">Panel title, 18/26 medium</p>
          <p className="max-w-[65ch] text-md text-ink">
            Prose, 16/24. Harbourline Interiors has not paid invoice INV-2026-0142, which was due three days ago. The agent
            sent a second reminder this morning at 9:00 Sydney time and will escalate to you after one more.
          </p>
          <p className="text-base text-ink">UI text, 14/20. Used in tables, forms and navigation.</p>
          <p className="text-sm text-ink-2">Meta, 13/18. Timestamps, hints, secondary labels.</p>
          <p className="tabular text-base text-ink-2">Tabular figures: 1,234,567.89 · 0.000001 · 14:02:13 · 7Xk4…q9Zc</p>
          <p className="money text-money-lg text-ink">RM 1,234,567.89</p>
        </div>
      </Section>

      <Section title="Controls" note="One button shape everywhere. Accent only on the primary action.">
        <div className="flex flex-wrap items-center gap-3">
          <button className="h-9 rounded-sm bg-accent px-4 text-base font-medium text-on-accent transition-colors duration-(--dur-fast) hover:bg-accent-hover">
            Create invoice
          </button>
          <button className="h-9 rounded-sm border border-line-strong bg-surface px-4 text-base font-medium text-ink transition-colors duration-(--dur-fast) hover:bg-paper-2">
            Approve
          </button>
          <button className="h-9 rounded-sm px-3 text-base font-medium text-ink-2 transition-colors duration-(--dur-fast) hover:bg-paper-2 hover:text-ink">
            Reject
          </button>
          <a href="#" className="text-base font-medium text-accent underline-offset-4 hover:underline">
            View on Solscan
          </a>
        </div>
        <div className="mt-5 grid max-w-md gap-4">
          <label className="grid gap-1.5 text-sm text-ink-2">
            Amount (USD)
            <input
              defaultValue="11,437.50"
              className="h-9 rounded-sm border border-line-strong bg-surface px-3 text-base tabular text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <label className="grid gap-1.5 text-sm text-ink-2">
            Buyer
            <input
              placeholder="Start typing a buyer name"
              className="h-9 rounded-sm border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
        </div>
      </Section>

      <Section title="Colour" note="Warm neutrals tinted toward ledger paper. One accent. Semantic colour lives only in status.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map((s) => (
            <li key={s.name}>
              <div className={`h-14 rounded-sm border border-line ${s.token}`} />
              <div className="mt-1.5 text-sm font-medium text-ink">{s.name}</div>
              <div className="text-xs text-ink-3">{s.note}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Spacing, radius, elevation" note="4px grid. Radii 4 / 8 / 12. Flat by default; one shadow for things that float.">
        <div className="flex flex-wrap items-end gap-6">
          {[4, 8, 12, 16, 24, 32, 48].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-accent-soft" style={{ width: n, height: n }} />
              <span className="text-xs tabular text-ink-3">{n}</span>
            </div>
          ))}
          <div className="ml-4 flex items-end gap-3">
            <div className="h-12 w-12 rounded-sm border border-line bg-surface" />
            <div className="h-12 w-12 rounded-md border border-line bg-surface" />
            <div className="h-12 w-12 rounded-lg border border-line bg-surface" />
            <div className="h-12 w-12 rounded-md bg-surface shadow-float" />
          </div>
        </div>
      </Section>
    </main>
  );
}
