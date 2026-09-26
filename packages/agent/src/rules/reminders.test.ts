import { describe, expect, it } from "vitest";
import { DEFAULT_RULEBOOK, type Rulebook } from "../rulebook";
import { nextReminder, type ReminderInput } from "./reminders";

const base = (over: Partial<ReminderInput>): ReminderInput => ({
  invoiceId: "inv_1",
  dueDate: "2026-09-27",
  timezone: "Asia/Tokyo",
  status: "sent",
  sent: [],
  now: new Date("2026-09-20T00:00:00Z"),
  rulebook: DEFAULT_RULEBOOK,
  ...over,
});

describe("nextReminder: first reminder (C1)", () => {
  it("is 3 days before due at 9:00 buyer local time", () => {
    const plan = nextReminder(base({}));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-24T00:00:00.000Z"); // 09:00 JST
    expect(plan).toMatchObject({ allowed: true, ruleId: "C1", tone: "friendly" });
  });

  it("honours DST in the buyer's zone (Sydney switches to UTC+11 on 4 Oct 2026)", () => {
    const before = nextReminder(base({ timezone: "Australia/Sydney", dueDate: "2026-10-06" }));
    expect(before.sendAt?.toISOString()).toBe("2026-10-02T23:00:00.000Z"); // 3 Oct 09:00 AEST
    const after = nextReminder(base({ timezone: "Australia/Sydney", dueDate: "2026-10-10" }));
    expect(after.sendAt?.toISOString()).toBe("2026-10-06T22:00:00.000Z"); // 7 Oct 09:00 AEDT
  });

  it("uses the rulebook's lead time", () => {
    const rulebook: Rulebook = { ...DEFAULT_RULEBOOK, collections: { ...DEFAULT_RULEBOOK.collections, firstReminderDaysBeforeDue: 5 } };
    expect(nextReminder(base({ rulebook })).sendAt?.toISOString()).toBe("2026-09-22T00:00:00.000Z");
  });

  it("moves a time in quiet hours to the next 9:00 local", () => {
    // Austin (UTC-5 in September). Now is 28 Sep 20:00 local, first reminder moment already passed.
    const plan = nextReminder(base({ timezone: "America/Chicago", dueDate: "2026-10-01", now: new Date("2026-09-29T01:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-29T14:00:00.000Z");
  });

  it("sends now if now is inside buyer hours and nothing blocks it", () => {
    const now = new Date("2026-09-25T03:30:00Z"); // 12:30 JST
    expect(nextReminder(base({ now })).sendAt?.toISOString()).toBe(now.toISOString());
  });
});

describe("nextReminder: pacing (C2)", () => {
  it("waits 48h after the last message to this buyer", () => {
    const plan = nextReminder(base({ sent: [{ invoiceId: "inv_1", at: "2026-09-24T00:00:00Z" }], now: new Date("2026-09-24T20:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(plan).toMatchObject({ ruleId: "C2", tone: "friendly" });
  });

  it("counts messages about the buyer's other invoices toward the cap", () => {
    const plan = nextReminder(base({ sent: [{ invoiceId: "inv_other", at: "2026-09-24T02:00:00Z" }], now: new Date("2026-09-24T03:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-26T02:00:00.000Z");
  });

  it("snaps a 48h-later time that falls in quiet hours to next morning", () => {
    // last at 19:00 JST is outside hours anyway; +48h = 19:00 JST → next day 09:00 JST
    const plan = nextReminder(base({ sent: [{ invoiceId: "inv_1", at: "2026-09-24T10:00:00Z" }], now: new Date("2026-09-24T11:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("allows more than one message per 48h when the rulebook says so", () => {
    const rulebook: Rulebook = { ...DEFAULT_RULEBOOK, collections: { ...DEFAULT_RULEBOOK.collections, maxMessagesPer48h: 2 } };
    const sent = [
      { invoiceId: "inv_1", at: "2026-09-24T00:00:00Z" },
      { invoiceId: "inv_1", at: "2026-09-24T05:00:00Z" },
    ];
    const plan = nextReminder(base({ rulebook, sent, now: new Date("2026-09-24T06:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-09-26T00:00:00.000Z"); // oldest in window + 48h
  });

  it("goes firm on the first overdue reminder and final on the last before escalation", () => {
    const first = nextReminder(base({ sent: [{ invoiceId: "inv_1", at: "2026-09-26T00:00:00Z" }], now: new Date("2026-09-27T16:00:00Z") }));
    expect(first).toMatchObject({ tone: "firm", ruleId: "C2" });
    expect(first.sendAt?.toISOString()).toBe("2026-09-28T00:00:00.000Z");

    const second = nextReminder(base({ sent: [{ invoiceId: "inv_1", at: "2026-09-28T00:00:00Z" }], now: new Date("2026-09-28T01:00:00Z") }));
    expect(second).toMatchObject({ tone: "final", ruleId: "C2" });
    expect(second.sendAt?.toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});

describe("nextReminder: stops", () => {
  it("stops and escalates after N overdue reminders (C4)", () => {
    const sent = [
      { invoiceId: "inv_1", at: "2026-09-28T00:00:00Z" },
      { invoiceId: "inv_1", at: "2026-09-30T00:00:00Z" },
    ];
    const plan = nextReminder(base({ sent, now: new Date("2026-10-01T00:00:00Z") }));
    expect(plan).toMatchObject({ allowed: false, sendAt: null, ruleId: "C4", escalate: true });
  });

  it("does not count pre-due reminders as overdue ones", () => {
    const sent = [
      { invoiceId: "inv_1", at: "2026-09-24T00:00:00Z" },
      { invoiceId: "inv_1", at: "2026-09-26T00:00:00Z" },
    ];
    expect(nextReminder(base({ sent, now: new Date("2026-09-27T00:00:00Z") })).allowed).toBe(true);
  });

  it("stops once paid (C6)", () => {
    for (const status of ["paid", "settled"] as const) {
      expect(nextReminder(base({ status }))).toMatchObject({ allowed: false, sendAt: null, ruleId: "C6", escalate: false });
    }
  });

  it("never reminds a disputed invoice (C4)", () => {
    expect(nextReminder(base({ status: "disputed" }))).toMatchObject({ allowed: false, sendAt: null, ruleId: "C4" });
  });

  it("does not remind a draft", () => {
    expect(nextReminder(base({ status: "draft" }))).toMatchObject({ allowed: false, sendAt: null });
  });

  it("holds off until the day after a promised payment date (C5)", () => {
    const plan = nextReminder(base({ promisedDate: "2026-10-01", now: new Date("2026-09-28T03:00:00Z") }));
    expect(plan.sendAt?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(plan.ruleId).toBe("C5");
  });

  it("rejects a malformed due date instead of guessing", () => {
    expect(() => nextReminder(base({ dueDate: "27/09/2026" }))).toThrow();
  });
});
