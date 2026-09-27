import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "./client";
import type { Store } from "./store";
import { ref, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

// testing/pglite.ts stubs realtime.send(payload, event, topic, private) into realtime.sent,
// so these tests see exactly what Supabase Realtime would broadcast.
type Sent = { topic: string; event: string; payload: Record<string, unknown>; private: boolean };

let db: Db;
let store: Store;
let exporterId: string;
let a: Buyer;

async function sent(): Promise<Sent[]> {
  const r = (await db.execute(sql`select topic, event, payload, private from realtime.sent order by id`)) as unknown as { rows: Sent[] };
  return r.rows;
}
async function clear() {
  await db.execute(sql`delete from realtime.sent`);
}

beforeEach(async () => {
  ({ db, store, exporterId, a } = await setup());
  await clear();
});

async function newInvoice() {
  return store.createInvoice({
    exporterId, buyerId: a.id, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: ref(), status: "sent",
    lineItems: [{ description: "Sample tray", quantity: 1, unitPriceUsdc: 50_000_000n }],
  });
}

describe("Realtime broadcast triggers", () => {
  test("an invoice change goes to invoice:<id> with only status fields, and pokes owner:<exporterId>", async () => {
    const inv = await newInvoice();
    await clear();
    await store.recordPayment({ invoiceId: inv.id, signature: "S".repeat(88), payer: "Payer1", amount: 50_000_000n, commitment: "confirmed", slot: 7, verified: true, issues: [], via: "solana_pay", at: new Date("2026-09-27T01:58:32.123Z") });

    const msgs = await sent();
    const invoiceMsg = msgs.find((m) => m.event === "invoice");
    expect(invoiceMsg).toEqual({
      topic: `invoice:${inv.id}`,
      event: "invoice",
      private: false,
      payload: {
        id: inv.id, status: "paid", amountUsdc: "50000000", receivedUsdc: "50000000",
        seenAt: "2026-09-27T01:58:32.123Z", paidAt: "2026-09-27T01:58:32.123Z", settledAt: null,
      },
    });
    const paymentMsg = msgs.find((m) => m.event === "payment");
    expect(paymentMsg).toMatchObject({ topic: `invoice:${inv.id}`, private: false });
    expect(paymentMsg!.payload).toEqual({
      id: expect.stringMatching(/^pay_/), invoiceId: inv.id, signature: "S".repeat(88), payer: "Payer1", amount: "50000000",
      inputMint: null, inputAmount: null, quotedInput: null, quotedOut: null, commitment: "confirmed", slot: 7,
      verified: true, issues: [], via: "solana_pay",
      observedAt: "2026-09-27T01:58:32.123Z", confirmedAt: "2026-09-27T01:58:32.123Z", finalizedAt: null,
    });
    expect(msgs.filter((m) => m.topic === `owner:${exporterId}`).map((m) => m.payload)).toEqual(
      // Public, guessable topic: no ids (an invoice id is a pay-link credential), just "something changed".
      expect.arrayContaining([{ table: "invoices" }, { table: "payments" }]),
    );
  });

  test("invoice payloads never carry line items, buyer, memo or reference", async () => {
    const inv = await newInvoice();
    const all = JSON.stringify(await sent());
    expect(all).not.toContain("Sample tray");
    expect(all).not.toContain(inv.memoCode);
    expect(all).not.toContain(inv.referencePubkey);
    expect(all).not.toContain(a.id);
  });

  test("agent actions poke only the owner topic, without their text", async () => {
    const inv = await newInvoice();
    await clear();
    const act = await store.recordAgentAction({ exporterId, buyerId: a.id, invoiceId: inv.id, kind: "reminder", inputSummary: "secret summary", decision: "Sent a reminder", reason: "C1", confidence: 1, ruleId: "C1", status: "executed" });
    expect(await sent()).toEqual([
      { topic: `owner:${exporterId}`, event: "changed", private: false, payload: { table: "agent_actions" } },
    ]);
  });

  test("cached balance updates poke the owner topic; unrelated buyer edits do not", async () => {
    await store.updateBalances(exporterId, { treasuryUsdc: 5n, vaults: { [a.id]: 7n } });
    expect((await sent()).map((m) => [m.topic, m.payload])).toEqual([
      [`owner:${exporterId}`, { table: "exporters" }],
      [`owner:${exporterId}`, { table: "buyers" }],
    ]);
    await clear();
    await store.updateBalances(exporterId, { treasuryUsdc: 5n, vaults: { [a.id]: 7n } }); // unchanged values
    expect(await sent()).toEqual([]);
  });
});
