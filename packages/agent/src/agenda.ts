/**
 * The owner's calendar (IMPROVEMENTS A3): due dates, promised dates, the next planned reminder per invoice,
 * scheduled sweeps and rate alerts, on the Malaysian (UTC+8) calendar. The command bar's "this week"
 * answers from the same function. Dates and amounts are computed here, never by a model.
 */
import type { Rulebook } from "./rulebook";
import type { InvoiceStatus } from "./rules/decision";
import { nextReminder } from "./rules/reminders";
import { addDays, formatIsoDate, parseIsoDate } from "./rules/time";

export type AgendaKind = "due" | "promised" | "reminder" | "sweep" | "rate_alert";

export type AgendaEvent = {
  date: string; // YYYY-MM-DD, Malaysian calendar
  kind: AgendaKind;
  label: string;
  at?: string; // ISO time when the event has one
  invoiceId?: string;
  invoiceNumber?: string;
  buyerName?: string;
  amountUsdc?: bigint; // outstanding on that invoice
};

export type AgendaInvoice = {
  id: string;
  number: string;
  buyerId: string;
  amountUsdc: bigint;
  receivedUsdc: bigint;
  dueDate: string;
  status: InvoiceStatus;
  promisedDate?: string;
};

const OPEN: InvoiceStatus[] = ["sent", "seen", "overdue", "partially_paid", "disputed"];
const ORDER: Record<AgendaKind, number> = { rate_alert: 0, sweep: 1, reminder: 2, due: 3, promised: 4 };

/** YYYY-MM-DD in Malaysia for an instant. */
export function mytDate(at: Date): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** Today and the six days after it, in Malaysia. */
export function weekRange(now: Date): { from: string; to: string } {
  const from = mytDate(now);
  return { from, to: formatIsoDate(addDays(parseIsoDate(from), 6)) };
}

export function buildAgenda(input: {
  from: string;
  to: string;
  now: Date;
  rulebook: Rulebook;
  buyers: Array<{ id: string; name: string; timezone: string }>;
  invoices: AgendaInvoice[];
  /** Every outbound message, per buyer, as nextReminder expects it. */
  sent: Array<{ buyerId: string; invoiceId: string; at: string }>;
  sweeps: Array<{ scheduledFor: string }>;
  alerts: Array<{ createdAt: string; decision: string }>;
}): AgendaEvent[] {
  const inRange = (d: string) => d >= input.from && d <= input.to;
  const buyer = new Map(input.buyers.map((b) => [b.id, b]));
  const events: AgendaEvent[] = [];

  for (const inv of input.invoices) {
    if (!OPEN.includes(inv.status)) continue;
    const b = buyer.get(inv.buyerId);
    const base = { invoiceId: inv.id, invoiceNumber: inv.number, buyerName: b?.name, amountUsdc: inv.amountUsdc - inv.receivedUsdc };
    if (inRange(inv.dueDate)) events.push({ ...base, date: inv.dueDate, kind: "due", label: `${inv.number} due` });
    if (inv.promisedDate && inRange(inv.promisedDate)) events.push({ ...base, date: inv.promisedDate, kind: "promised", label: `${b?.name ?? "Buyer"} promised to pay ${inv.number}` });
    if (!b) continue;
    const plan = nextReminder({
      invoiceId: inv.id, dueDate: inv.dueDate, timezone: b.timezone, status: inv.status, now: input.now, rulebook: input.rulebook, promisedDate: inv.promisedDate,
      sent: input.sent.filter((m) => m.buyerId === inv.buyerId).map(({ invoiceId, at }) => ({ invoiceId, at })),
    });
    if (plan.allowed && plan.sendAt) {
      const date = mytDate(plan.sendAt);
      if (inRange(date)) events.push({ ...base, date, kind: "reminder", at: plan.sendAt.toISOString(), label: `${plan.tone ?? "Next"} reminder for ${inv.number}`.replace(/^./, (c) => c.toUpperCase()) });
    }
  }
  for (const s of input.sweeps) {
    const date = mytDate(new Date(s.scheduledFor));
    if (inRange(date)) events.push({ date, kind: "sweep", at: s.scheduledFor, label: "Sweep buyer accounts into the treasury" });
  }
  for (const a of input.alerts) {
    const date = mytDate(new Date(a.createdAt));
    if (inRange(date)) events.push({ date, kind: "rate_alert", at: a.createdAt, label: a.decision });
  }
  return events.sort((x, y) => x.date.localeCompare(y.date) || ORDER[x.kind] - ORDER[y.kind] || (x.at ?? "").localeCompare(y.at ?? ""));
}
