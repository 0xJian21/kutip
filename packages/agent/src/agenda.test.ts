import { describe, expect, it } from "vitest";
import { buildAgenda, mytDate, weekRange } from "./agenda";
import { DEFAULT_RULEBOOK } from "./rulebook";

const NOW = new Date("2026-09-28T02:00:00Z"); // Monday 28 Sep, 10:00 MYT
const buyers = [
  { id: "b_h", name: "Harbourline", timezone: "Australia/Sydney" },
  { id: "b_m", name: "Meridian", timezone: "America/Chicago" },
];
const inv = (o: Partial<Parameters<typeof buildAgenda>[0]["invoices"][number]> & { id: string }) => ({
  number: `INV-${o.id}`, buyerId: "b_h", amountUsdc: 100_000_000n, receivedUsdc: 0n, dueDate: "2026-10-01", status: "sent" as const, ...o,
});

describe("agenda (A3, and the command bar's 'this week')", () => {
  it("weekRange is today plus six days on the Malaysian calendar", () => {
    expect(mytDate(new Date("2026-09-27T17:00:00Z"))).toBe("2026-09-28"); // 01:00 MYT next day
    expect(weekRange(NOW)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("lists due dates, promised dates, next reminders, sweeps and rate alerts inside the range, sorted", () => {
    const events = buildAgenda({
      ...weekRange(NOW),
      now: NOW,
      rulebook: DEFAULT_RULEBOOK,
      buyers,
      invoices: [
        inv({ id: "a", dueDate: "2026-10-01", amountUsdc: 300_000_000n, receivedUsdc: 100_000_000n, status: "partially_paid" }),
        inv({ id: "b", buyerId: "b_m", dueDate: "2026-09-20", status: "overdue", promisedDate: "2026-10-02" }),
        inv({ id: "c", dueDate: "2026-10-20" }), // outside the week
        inv({ id: "d", dueDate: "2026-09-30", status: "paid" }), // paid: nothing
      ],
      sent: [],
      sweeps: [{ scheduledFor: "2026-09-29T06:30:00Z" }],
      alerts: [{ createdAt: "2026-09-28T04:05:00Z", decision: "Ringgit is 0.6% above its 30-day average" }],
    });
    expect(events.filter((e) => e.kind !== "reminder").map((e) => [e.date, e.kind, e.invoiceNumber ?? null])).toEqual([
      ["2026-09-28", "rate_alert", null],
      ["2026-09-29", "sweep", null],
      ["2026-10-01", "due", "INV-a"],
      ["2026-10-02", "promised", "INV-b"],
    ]);
    const due = events.find((e) => e.kind === "due")!;
    expect(due.amountUsdc).toBe(200_000_000n); // outstanding, computed in code
    expect(due.buyerName).toBe("Harbourline");
  });

  it("shows the next scheduled reminder when the rulebook plans one in range", () => {
    const events = buildAgenda({
      from: "2026-09-28", to: "2026-10-04", now: NOW, rulebook: DEFAULT_RULEBOOK, buyers,
      invoices: [inv({ id: "r", dueDate: "2026-10-01" })],
      sent: [], sweeps: [], alerts: [],
    });
    expect(events.map((e) => e.kind)).toEqual(["reminder", "due"]);
    expect(events[0]!.label).toMatch(/reminder/i);
  });
});
