import type { FunnelStage, SeriesPoint } from "@/components/ui/charts";
import { formatMyrCompact } from "@/components/ui/money";
import { toMyr, type BnmRate } from "@/lib/ui/money";
import type { Invoice } from "@/lib/ui/types";

/*
  Pure helpers that turn the invoice list into chart inputs. Money stays bigint
  until the last step, where a chart only needs ratios and a display string.
  Months are Malaysian calendar months (UTC+8).
*/

const MYT = "Asia/Kuala_Lumpur";
const OPEN = new Set<Invoice["status"]>(["sent", "seen", "overdue", "partially_paid", "disputed"]);
const SEEN_OR_LATER = new Set<Invoice["status"]>(["seen", "partially_paid", "paid", "settled"]);
const PAID_OR_LATER = new Set<Invoice["status"]>(["paid", "settled"]);

/** "2026-09" for an ISO date or datetime, in MYT. */
export function monthKey(iso: string, now?: Date): string {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00+08:00`) : new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: MYT }).formatToParts(now ?? d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

function lastMonths(n: number, now: Date): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const base = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: MYT }).formatToParts(now);
  let y = Number(base.find((p) => p.type === "year")!.value);
  let m = Number(base.find((p) => p.type === "month")!.value);
  for (let i = 0; i < n; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: MYT }).format(new Date(Date.UTC(y, m - 1, 15)));
    out.unshift({ key, label });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** Sent → Seen → Paid → Settled, by amount, across every non-draft invoice. */
export function collectionsFunnel(invoices: Invoice[], rate: BnmRate): FunnelStage[] {
  const live = invoices.filter((i) => i.status !== "draft");
  const sum = (pred: (i: Invoice) => boolean) => live.filter(pred).reduce((s, i) => s + i.amountUsdc, 0n);
  const count = (pred: (i: Invoice) => boolean) => live.filter(pred).length;
  const stage = (key: string, label: string, pred: (i: Invoice) => boolean, hint: string, short?: string): FunnelStage => {
    const usdc = sum(pred);
    const n = count(pred);
    return { key, label, short, value: Number(usdc / 1_000_000n), display: formatMyrCompact(toMyr(usdc, rate)), hint: `${n} ${n === 1 ? "invoice" : "invoices"}${hint}` };
  };
  return [
    stage("sent", "Sent", () => true, ""),
    stage("seen", "Payment seen", (i) => SEEN_OR_LATER.has(i.status), "", "Seen"),
    stage("paid", "Paid", (i) => PAID_OR_LATER.has(i.status), ""),
    stage("settled", "Settled", (i) => i.status === "settled", " in treasury"),
  ];
}

/** Which funnel stage to draw solid: the furthest stage with money in it. */
export function funnelEmphasis(stages: FunnelStage[]): string {
  const withMoney = stages.filter((s) => s.value > 0);
  return withMoney.length ? withMoney[withMoney.length - 1]!.key : stages[0]!.key;
}

/** Per issue month: paid amount vs still-open amount. Six months, or the last three when any of the six is empty. */
export function invoicedByMonth(invoices: Invoice[], rate: BnmRate, now = new Date()): SeriesPoint[] {
  const six = lastMonths(6, now).map(({ key, label }) => {
    const inMonth = invoices.filter((i) => i.status !== "draft" && monthKey(i.issuedAt) === key);
    const received = inMonth.reduce((s, i) => s + (PAID_OR_LATER.has(i.status) ? i.amountUsdc : i.receivedUsdc), 0n);
    const outstanding = inMonth.filter((i) => OPEN.has(i.status)).reduce((s, i) => s + i.amountUsdc - i.receivedUsdc, 0n);
    return {
      key,
      label,
      received: Number(received / 1_000_000n),
      outstanding: Number(outstanding / 1_000_000n),
      receivedText: formatMyrCompact(toMyr(received, rate)),
      outstandingText: formatMyrCompact(toMyr(outstanding, rate)),
    };
  });
  return six.some((p) => p.received + p.outstanding === 0) ? six.slice(-3) : six;
}

/** Amount paid in a given month (by paidAt), for the month-on-month delta. */
export function paidInMonth(invoices: Invoice[], key: string): bigint {
  return invoices.filter((i) => i.paidAt && monthKey(i.paidAt) === key).reduce((s, i) => s + i.amountUsdc, 0n);
}

/**
 * Signed change in basis points, or null when there is nothing worth comparing:
 * no previous figure, or one under a tenth of the current (a "+365%" tells the reader nothing).
 */
export function deltaBps(current: bigint, previous: bigint): bigint | null {
  if (previous <= 0n || previous * 10n < current) return null;
  const bps = ((current - previous) * 10_000n) / previous;
  // Beyond a doubling either way the percentage stops meaning anything; the figures speak for themselves.
  return bps > 10_000n || bps < -10_000n ? null : bps;
}

export function previousMonthKey(now = new Date()): string {
  return lastMonths(2, now)[0]!.key;
}

/** "vs Aug" */
export function previousMonthLabel(now = new Date()): string {
  return `vs ${lastMonths(2, now)[0]!.label}`;
}

/** Paid invoices, newest first. */
export function recentPayments(invoices: Invoice[], limit = 5): Invoice[] {
  return invoices
    .filter((i) => i.paidAt)
    .sort((a, b) => (a.paidAt! < b.paidAt! ? 1 : -1))
    .slice(0, limit);
}
