import { describe, expect, test } from "vitest";
import { APP_URL, buyerInput, ref, RULEBOOK, setup } from "./testing/fixtures";

const items = [
  { description: "Teak dining table", quantity: 5, unitPriceUsdc: 1_189_500_000n },
  { description: "Teak bench", quantity: 15, unitPriceUsdc: 366_000_000n },
];

describe("createInvoice", () => {
  test("stores line items and computes the total in integer base units", async () => {
    const { store, exporterId, a } = await setup();
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-08-26", dueDate: "2026-09-22", referencePubkey: ref() });
    expect(inv.amountUsdc).toBe(11_437_500_000n);
    expect(inv.receivedUsdc).toBe(0n);
    expect(inv.status).toBe("draft");
    expect(inv.lineItems).toEqual(items);
    expect(inv.dueDate).toBe("2026-09-22");
    expect(inv.payUrl).toBe(`${APP_URL}/pay/${inv.id}`);
    expect(inv.x402Url).toBe(`${APP_URL}/api/x402/invoice/${inv.id}`);
  });

  test("keeps bigint precision beyond 2^53", async () => {
    const { store, exporterId, a } = await setup();
    const big = 9_007_199_254_740_993n;
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: [{ description: "x", quantity: 2, unitPriceUsdc: big }], issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref() });
    const detail = await store.getInvoice(exporterId, inv.id);
    expect(detail?.invoice.amountUsdc).toBe(big * 2n);
    expect(detail?.invoice.lineItems[0]?.unitPriceUsdc).toBe(big);
  });

  test("gives an unguessable id, an opaque k_ memo and the next invoice number", async () => {
    const { store, exporterId, a } = await setup();
    const base = { exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01" };
    const first = await store.createInvoice({ ...base, referencePubkey: ref() });
    const second = await store.createInvoice({ ...base, referencePubkey: ref() });
    expect(first.id).toMatch(/^inv_[1-9A-HJ-NP-Za-km-z]{20}$/);
    expect(first.memoCode).toMatch(/^k_[a-z0-9]{8}$/);
    expect(first.memoCode).not.toBe(second.memoCode);
    expect(first.number).toBe("INV-2026-0001");
    expect(second.number).toBe("INV-2026-0002");
  });

  test("sent invoices get sentAt", async () => {
    const { store, exporterId, a } = await setup();
    const at = new Date("2026-09-01T02:05:00Z");
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent", at });
    expect(inv.status).toBe("sent");
    expect(inv.sentAt).toBe(at.toISOString());
  });

  test("rejects a buyer that belongs to another exporter", async () => {
    const { store, exporterId } = await setup();
    const other = await store.createExporter({ name: "Other", treasuryMultisig: "m", treasuryVault: "v", treasuryUsdcAta: "a", rulebook: RULEBOOK });
    const foreign = await store.createBuyer(buyerInput(other.id, "Foreign"));
    await expect(
      store.createInvoice({ exporterId, buyerId: foreign.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref() }),
    ).rejects.toThrow(/buyer/i);
  });

  test("rejects empty, fractional-quantity or negative line items", async () => {
    const { store, exporterId, a } = await setup();
    const base = { exporterId, buyerId: a.id, issuedAt: "2026-09-01", dueDate: "2026-10-01" };
    await expect(store.createInvoice({ ...base, lineItems: [], referencePubkey: ref() })).rejects.toThrow();
    await expect(store.createInvoice({ ...base, lineItems: [{ description: "x", quantity: 1.5, unitPriceUsdc: 1n }], referencePubkey: ref() })).rejects.toThrow();
    await expect(store.createInvoice({ ...base, lineItems: [{ description: "x", quantity: 1, unitPriceUsdc: -1n }], referencePubkey: ref() })).rejects.toThrow();
  });
});

describe("getInvoice", () => {
  test("returns invoice, buyer, rate and empty activity for a fresh invoice", async () => {
    const { store, exporterId, a } = await setup();
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-08-26", dueDate: "2026-09-22", referencePubkey: ref() });
    const d = await store.getInvoice(exporterId, inv.id);
    expect(d).toEqual({ invoice: inv, buyer: a, payments: [], messages: [], actions: [], rate: { myrPerUsd: 42150n, date: "2026-09-26" } });
  });

  test("returns null for an unknown id or another exporter's invoice", async () => {
    const { store, exporterId, a } = await setup();
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-08-26", dueDate: "2026-09-22", referencePubkey: ref() });
    expect(await store.getInvoice(exporterId, "inv_nope")).toBeNull();
    expect(await store.getInvoice("exp_other", inv.id)).toBeNull();
  });
});

describe("getExporter", () => {
  test("returns the exporter with its rulebook and owner/admin names", async () => {
    const { store, exporterId } = await setup();
    await store.createUser({ exporterId, name: "Farid Zulkifli", role: "owner" });
    await store.createUser({ exporterId, name: "Tan Mei Ling", role: "admin" });
    const e = await store.getExporter(exporterId);
    expect(e).toMatchObject({ id: exporterId, name: "Teratai Woodworks Sdn. Bhd.", ownerName: "Farid Zulkifli", adminName: "Tan Mei Ling", rulebook: RULEBOOK });
  });
});

describe("setInvoiceStatus", () => {
  test("allows draft→sent, sent→overdue, open→disputed and refuses anything else", async () => {
    const { store, exporterId, a } = await setup();
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: items, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref() });
    await expect(store.setInvoiceStatus(exporterId, inv.id, "overdue")).rejects.toThrow(/cannot move/);
    const sent = await store.setInvoiceStatus(exporterId, inv.id, "sent", new Date("2026-09-01T02:05:00Z"));
    expect(sent).toMatchObject({ status: "sent", sentAt: "2026-09-01T02:05:00.000Z" });
    expect((await store.setInvoiceStatus(exporterId, inv.id, "overdue")).status).toBe("overdue");
    expect((await store.setInvoiceStatus(exporterId, inv.id, "disputed")).status).toBe("disputed");
    await expect(store.setInvoiceStatus(exporterId, inv.id, "sent")).rejects.toThrow(/cannot move/);
    await expect(store.setInvoiceStatus("exp_other", inv.id, "disputed")).rejects.toThrow(/cannot move/);
  });
});
