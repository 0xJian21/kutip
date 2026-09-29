import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mytDate, weekRange, type AgendaEvent } from "@kutip/agent";
import { AgendaBadge } from "@/components/agent/preview-card";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { agenda } from "@/app/api/agent/_lib/deps";
import { MOCK } from "@/lib/server/auth";
import { ownerData } from "@/lib/server/data";
import { formatDate, formatTime } from "@/lib/ui/format";
import { formatUsdc } from "@/lib/ui/money";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Plain date arithmetic on YYYY-MM-DD strings (UTC midnight, no time zone surprises). */
const toDay = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (isoDate: string, days: number) => iso(new Date(toDay(isoDate).getTime() + days * 86_400_000));
const mondayOf = (isoDate: string) => plus(isoDate, -((toDay(isoDate).getUTCDay() + 6) % 7));

function monthGrid(month: string): { from: string; to: string; days: string[] } {
  const first = `${month}-01`;
  const next = iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)));
  const from = mondayOf(first);
  const to = plus(mondayOf(plus(next, -1)), 6);
  const days: string[] = [];
  for (let d = from; d <= to; d = plus(d, 1)) days.push(d);
  return { from, to, days };
}

const monthLabel = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(toDay(`${month}-01`));
const shiftMonth = (month: string, by: number) => iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by, 1))).slice(0, 7);

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const data = await ownerData("/calendar");
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "week";
  const today = mytDate(new Date());
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);

  const header = (
    <PageHeader
      title="Calendar"
      lede="Due dates, promised payments, the agent's planned reminders, sweeps and rate alerts. Times are Malaysian."
      actions={
        <Tabs
          label="Calendar view"
          variant="segmented"
          size="sm"
          value={view}
          items={[
            { value: "week", label: "Next 7 days", href: "/calendar" },
            { value: "month", label: "Month", href: `/calendar?view=month&month=${month}` },
          ]}
        />
      }
    />
  );
  if (MOCK) return <>{header}<EmptyState title="The calendar needs the real database" body="Turn off NEXT_PUBLIC_KUTIP_MOCK." /></>;

  if (view === "week") {
    const range = weekRange(new Date());
    const events = await agenda(data.exporterId, range);
    const days = Array.from({ length: 7 }, (_, i) => plus(range.from, i));
    return (
      <>
        {header}
        <Card padded={false}>
          <ol className="divide-y divide-line">
            {days.map((d) => (
              <li key={d} className="grid gap-2 px-5 py-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:px-6">
                <p className={`text-sm font-medium ${d === today ? "text-accent" : "text-ink-2"}`}>{d === today ? "Today" : formatDate(d)}</p>
                <DayEvents events={events.filter((e) => e.date === d)} empty="Nothing planned" />
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

  const grid = monthGrid(month);
  const events = await agenda(data.exporterId, { from: grid.from, to: grid.to });
  return (
    <>
      {header}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{monthLabel(month)}</h2>
          <div className="flex gap-1">
            <Link href={`/calendar?view=month&month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"><ChevronLeft size={16} aria-hidden="true" /></Link>
            <Link href={`/calendar?view=month&month=${shiftMonth(month, 1)}`} aria-label="Next month" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"><ChevronRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        {/* Desktop: a month grid. Phones: the same days as a list, skipping empty ones. */}
        <div className="hidden border-t border-line md:block">
          <div className="grid grid-cols-7 border-b border-line bg-paper-2/60">
            {WEEKDAYS.map((w) => <p key={w} className="px-2 py-1.5 text-xs font-medium text-ink-3">{w}</p>)}
          </div>
          <ol className="grid grid-cols-7">
            {grid.days.map((d) => {
              const dayEvents = events.filter((e) => e.date === d);
              const inMonth = d.startsWith(month);
              return (
                <li key={d} className={`min-h-[112px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-paper-2/40"}`}>
                  <p className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular ${d === today ? "bg-accent font-semibold text-paper" : inMonth ? "text-ink-2" : "text-ink-3"}`}>{Number(d.slice(8))}</p>
                  <ul className="grid gap-1">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <li key={`${e.kind}-${e.invoiceId ?? i}`} className="flex min-w-0 items-center gap-1" title={e.label}>
                        <AgendaBadge kind={e.kind} />
                        <span className="truncate text-xs text-ink-2">{e.invoiceNumber?.replace(/^INV-\d{4}-/, "#") ?? ""}</span>
                      </li>
                    ))}
                    {dayEvents.length > 3 ? <li className="text-xs text-ink-3">+{dayEvents.length - 3} more</li> : null}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
        <ol className="divide-y divide-line border-t border-line md:hidden">
          {grid.days.filter((d) => d.startsWith(month) && events.some((e) => e.date === d)).map((d) => (
            <li key={d} className="grid gap-2 px-5 py-4">
              <p className={`text-sm font-medium ${d === today ? "text-accent" : "text-ink-2"}`}>{formatDate(d)}</p>
              <DayEvents events={events.filter((e) => e.date === d)} empty="" />
            </li>
          ))}
          {events.every((e) => !e.date.startsWith(month)) ? <li><EmptyState compact title="Nothing this month" /></li> : null}
        </ol>
      </Card>
    </>
  );
}

/** Invoice numbers never break across lines ("INV-2026-" / "0145" is a wrong number at a glance). */
function keepNumbers(label: string) {
  return label.split(/(INV-\d{4}-\d+)/).map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}

function DayEvents({ events, empty }: { events: AgendaEvent[]; empty: string }) {
  if (events.length === 0) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="grid gap-1.5">
      {events.map((e, i) => (
        // The kind badge is the row's status: last, flush right, vertically centred, so the text column always starts at one edge.
        <li key={`${e.kind}-${e.invoiceId ?? i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5">
          <span className="min-w-0 text-base leading-snug text-ink">
            {e.invoiceId ? <Link href={`/invoices/${e.invoiceId}`} className="hover:underline">{keepNumbers(e.label)}</Link> : keepNumbers(e.label)}
            {e.buyerName && e.kind !== "promised" ? <span className="text-ink-2"> · {e.buyerName}</span> : null}
          </span>
          {(e.at && e.kind !== "rate_alert") || e.amountUsdc !== undefined ? (
            <span className="col-start-1 flex flex-wrap gap-x-3 text-sm tabular text-ink-3">
              {e.at && e.kind !== "rate_alert" ? <span>{formatTime(e.at, "Asia/Kuala_Lumpur", false)} MYT</span> : null}
              {e.amountUsdc !== undefined ? <span className="text-ink-2">{formatUsdc(e.amountUsdc)} USD</span> : null}
            </span>
          ) : null}
          <span className="col-start-2 row-span-2 row-start-1 flex justify-end"><AgendaBadge kind={e.kind} /></span>
        </li>
      ))}
    </ul>
  );
}
