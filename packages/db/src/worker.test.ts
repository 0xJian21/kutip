import { beforeEach, describe, expect, test } from "vitest";
import type { Store } from "./store";
import { ref, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

let store: Store;
let exporterId: string;
let a: Buyer;
let b: Buyer;

const items = [{ description: "Chair", quantity: 1, unitPriceUsdc: 50_000_000n }];

beforeEach(async () => {
  ({ store, exporterId, a, b } = await setup());
});

describe("quotes", () => {
  test("recordQuote stores the Jupiter quote per reference; latestQuote returns the newest for that input token", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: ref(), status: "sent" });
    expect(await store.latestQuote(inv.referencePubkey, "SOL")).toBeNull();
    await store.recordQuote(inv.referencePubkey, { inputMint: "SOL", quotedInput: 282_900_000n, quotedOut: 50_000_000n, at: new Date("2026-09-27T01:00:00Z") });
    await store.recordQuote(inv.referencePubkey, { inputMint: "SOL", quotedInput: 283_000_000n, quotedOut: 50_000_000n, at: new Date("2026-09-27T01:00:05Z") });
    await store.recordQuote(inv.referencePubkey, { inputMint: "USDT", quotedInput: 50_010_000n, quotedOut: 50_000_000n, at: new Date("2026-09-27T01:00:09Z") });
    expect(await store.latestQuote(inv.referencePubkey, "SOL")).toEqual({ inputMint: "SOL", quotedInput: 283_000_000n, quotedOut: 50_000_000n });
    expect(await store.latestQuote(inv.referencePubkey, "USDT")).toEqual({ inputMint: "USDT", quotedInput: 50_010_000n, quotedOut: 50_000_000n });
  });

  test("recordQuote rejects an unknown reference", async () => {
    await expect(store.recordQuote("nope", { inputMint: "SOL", quotedInput: 1n, quotedOut: 1n })).rejects.toThrow();
  });
});

describe("collections scheduling", () => {
  test("listOpenInvoices returns open invoices with the buyer's timezone and promised date", async () => {
    const sent = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    const other = await store.createInvoice({ exporterId, buyerId: b.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-09-20", referencePubkey: ref(), status: "sent" });
    await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref() }); // draft
    await store.setPromisedDate(exporterId, sent.id, "2026-10-03");

    expect(await store.listOpenInvoices(exporterId)).toEqual([
      { invoiceId: other.id, buyerId: b.id, dueDate: "2026-09-20", status: "sent", timezone: "Australia/Sydney" },
      { invoiceId: sent.id, buyerId: a.id, dueDate: "2026-10-01", status: "sent", timezone: "Australia/Sydney", promisedDate: "2026-10-03" },
    ]);
    await store.setPromisedDate(exporterId, sent.id, null);
    expect((await store.listOpenInvoices(exporterId)).find((i) => i.invoiceId === sent.id)?.promisedDate).toBeUndefined();
  });

  test("setPromisedDate is scoped to the exporter", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    await expect(store.setPromisedDate("exp_other", inv.id, "2026-10-03")).rejects.toThrow();
  });

  test("listExporterIds lists every exporter", async () => {
    expect(await store.listExporterIds()).toEqual([exporterId]);
  });
});

describe("balance accounts", () => {
  test("listWatchedAccounts maps every treasury and vault USDC ATA to its exporter and buyer", async () => {
    const e = (await store.getExporter(exporterId))!;
    const w = await store.listWatchedAccounts();
    expect(w.balances).toEqual(
      expect.arrayContaining([
        { exporterId, usdcAta: e.treasuryUsdcAta },
        { exporterId, buyerId: a.id, usdcAta: a.usdcAta },
        { exporterId, buyerId: b.id, usdcAta: b.usdcAta },
      ]),
    );
    expect(w.balances).toHaveLength(3);
  });
});
