import { fakeAnthropic } from "@kutip/agent/src/testing/fake-anthropic";
import { setup } from "@kutip/db/src/testing/fixtures";
import type { Buyer, Store } from "@kutip/db";
import { beforeEach, describe, expect, test } from "vitest";
import { createCollections } from "./collections";
import type { Mailer } from "@kutip/agent";

let store: Store;
let exporterId: string;
let a: Buyer;
let b: Buyer;
let mail: Array<{ to: string; subject: string; body: string }>;
let logs: string[];

// Buyers are in Australia/Sydney (UTC+10 in late September).
const NOW = new Date("2026-09-27T01:00:00Z"); // 11:00 in Sydney on the 27th
const mailer: Mailer = { send: async (to, email) => (mail.push({ to, ...email }), "recorded") };

beforeEach(async () => {
  ({ store, exporterId, a, b } = await setup());
  mail = [];
  logs = [];
});

const invoice = (buyer: Buyer, dueDate: string, usd = 50n) =>
  store.createInvoice({ exporterId, buyerId: buyer.id, issuedAt: "2026-09-01", dueDate, referencePubkey: `ref-${Math.random()}`.padEnd(32, "x"), status: "sent", lineItems: [{ description: "Chair", quantity: 1, unitPriceUsdc: usd * 1_000_000n }] });

function collections(reply: unknown = { subject: "Invoice reminder", body: "Hi, a gentle reminder about your invoice." }) {
  const { client, requests } = fakeAnthropic(() => ({ output: reply }));
  return { c: createCollections({ store, anthropic: client, mailer, log: (m) => logs.push(m) }), requests };
}

describe("markOverdue", () => {
  test("sent invoices past their due date in the buyer's timezone become overdue", async () => {
    const past = await invoice(a, "2026-09-20");
    const today = await invoice(a, "2026-09-27");
    const yesterdayInSydney = await invoice(b, "2026-09-26"); // due date ended at 14:00Z on the 26th
    await collections().c.markOverdue(NOW);
    const status = async (id: string) => (await store.getInvoice(exporterId, id))!.invoice.status;
    expect(await status(past.id)).toBe("overdue");
    expect(await status(today.id)).toBe("sent");
    expect(await status(yesterdayInSydney.id)).toBe("overdue");
  });
});

describe("reminders", () => {
  test("sends a due reminder: Haiku writes it, the message and action are recorded, the buyer is emailed", async () => {
    const inv = await invoice(a, "2026-09-29"); // C1: 3 days before due, from 09:00 Sydney on the 26th
    const { c, requests } = collections();
    await c.runReminders(NOW);

    expect(requests).toHaveLength(1);
    const d = (await store.getInvoice(exporterId, inv.id))!;
    expect(d.messages).toHaveLength(1);
    expect(d.messages[0]).toMatchObject({ direction: "out", subject: "Invoice reminder", from: "Teratai Woodworks Sdn. Bhd." });
    expect(d.messages[0]!.body).toContain(`Pay here: ${inv.payUrl}`);
    expect(d.actions[0]).toMatchObject({ kind: "reminder", status: "executed", ruleId: "C1", buyerId: a.id, confidence: 1 });
    expect(d.actions[0]!.decision).toBe(`Sent a friendly reminder for ${inv.number}`);
    expect(mail).toEqual([{ to: a.email, subject: "Invoice reminder", body: d.messages[0]!.body }]);
  });

  test("at most one message per buyer per 48 hours, across invoices and runs", async () => {
    await invoice(a, "2026-09-28");
    await invoice(a, "2026-09-29");
    const { c } = collections();
    await c.runReminders(NOW);
    await c.runReminders(new Date(NOW.getTime() + 3_600_000));
    expect(mail).toHaveLength(1);
  });

  test("not yet due for a first reminder → nothing", async () => {
    await invoice(a, "2026-10-20");
    const { c, requests } = collections();
    await c.runReminders(NOW);
    expect(requests).toHaveLength(0);
    expect(mail).toEqual([]);
  });

  test("a promised date pauses reminders until the day after (C5)", async () => {
    const inv = await invoice(a, "2026-09-20");
    await store.setPromisedDate(exporterId, inv.id, "2026-09-28");
    const { c } = collections();
    await c.runReminders(NOW);
    expect(mail).toEqual([]);
  });

  test("a disputed invoice escalates to the owner once (C4)", async () => {
    const inv = await invoice(a, "2026-09-20");
    await store.setInvoiceStatus(exporterId, inv.id, "disputed");
    const { c } = collections();
    await c.runReminders(NOW);
    await c.runReminders(new Date(NOW.getTime() + 86_400_000));
    const actions = (await store.getInvoice(exporterId, inv.id))!.actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "escalate", status: "escalated", ruleId: "C4" });
    expect(mail).toEqual([]);
  });

  test("a draft that fails the writer's checks is not sent, and other buyers still get theirs", async () => {
    await invoice(a, "2026-09-29");
    await invoice(b, "2026-09-29");
    let n = 0;
    const { client } = fakeAnthropic(() =>
      ++n === 1 ? { output: { subject: "Pay now", body: "Please pay USD 999.00 today." } } : { output: { subject: "Reminder", body: "Hi, a reminder." } },
    );
    await createCollections({ store, anthropic: client, mailer, log: (m) => logs.push(m) }).runReminders(NOW);
    expect(mail).toHaveLength(1);
    expect(logs.join("\n")).toMatch(/reminder failed .*amount that is not in the facts/);
  });

  test("without an Anthropic key, reminders are skipped (logged), never thrown", async () => {
    await invoice(a, "2026-09-29");
    await createCollections({ store, mailer, log: (m) => logs.push(m) }).runReminders(NOW);
    expect(mail).toEqual([]);
    expect(logs.join("\n")).toContain("ANTHROPIC_API_KEY");
  });
});

describe("dry run (COLLECTIONS=dry)", () => {
  test("logs what it would do and writes nothing, calls no LLM", async () => {
    const past = await invoice(a, "2026-09-20");
    await invoice(b, "2026-09-29");
    const { client, requests } = fakeAnthropic(() => ({ output: {} }));
    const c = createCollections({ store, anthropic: client, mailer, log: (m) => logs.push(m), dryRun: true });
    await c.markOverdue(NOW);
    await c.runReminders(NOW);
    expect((await store.getInvoice(exporterId, past.id))!.invoice.status).toBe("sent");
    expect(await store.listAgentActions(exporterId)).toEqual([]);
    expect(requests).toEqual([]);
    expect(mail).toEqual([]);
    expect(logs.filter((l) => l.startsWith("[dry]"))).toEqual([
      `[dry] Overdue ${past.id} (due 2026-09-20)`,
      expect.stringMatching(/^\[dry\] Reminder inv_\w+ (friendly|firm) \(C\d\)$/),
      expect.stringMatching(/^\[dry\] Reminder inv_\w+ friendly \(C1\)$/),
    ]);
  });
});

describe("onPaid", () => {
  test("cancels reminders (C6) and emails a receipt to the buyer", async () => {
    const inv = await invoice(a, "2026-09-29");
    await store.recordPayment({ invoiceId: inv.id, signature: "S".repeat(88), payer: "p", amount: 50_000_000n, commitment: "confirmed", slot: 1, verified: true, issues: [], via: "solana_pay", at: NOW });
    const { c } = collections({ subject: "Payment received", body: "Thank you, we received USD 50.00." });
    await c.onPaid({ invoiceId: inv.id, exporterId, buyerId: a.id });

    const d = (await store.getInvoice(exporterId, inv.id))!;
    expect(d.actions.map((x) => [x.kind, x.ruleId, x.status])).toEqual([["cancel_reminders", "C6", "executed"]]);
    expect(d.messages[0]).toMatchObject({ direction: "out", subject: "Payment received" });
    expect(mail).toEqual([{ to: a.email, subject: "Payment received", body: "Thank you, we received USD 50.00." }]);
  });
});
