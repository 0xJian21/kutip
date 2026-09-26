import { describe, expect, it } from "vitest";
import { BOT_INVOICE_ID, BUYERS, DEMO_INVOICE_ID, INVOICES, PAYMENTS, fakeKey } from "./fixtures";
import { mockData } from "./index";

describe("fixtures", () => {
  it("every invoice belongs to a known buyer and has a positive integer amount", () => {
    for (const inv of INVOICES) {
      expect(BUYERS.some((b) => b.id === inv.buyerId)).toBe(true);
      expect(inv.amountUsdc > 0n).toBe(true);
      expect(typeof inv.amountUsdc).toBe("bigint");
    }
  });
  it("settled invoices have a finalized payment for the full amount", () => {
    for (const inv of INVOICES.filter((i) => i.status === "settled")) {
      const p = PAYMENTS.find((x) => x.invoiceId === inv.id);
      expect(p?.commitment).toBe("finalized");
      expect(p?.amount).toBe(inv.amountUsdc);
      expect(inv.receivedUsdc).toBe(inv.amountUsdc);
    }
  });
  it("covers every status and the two demo invoices", () => {
    const statuses = new Set(INVOICES.map((i) => i.status));
    for (const s of ["draft", "sent", "seen", "paid", "settled", "partially_paid", "overdue", "disputed"]) {
      if (s === "paid") continue; // transient; produced by the simulation
      expect(statuses.has(s as never)).toBe(true);
    }
    expect(INVOICES.find((i) => i.id === DEMO_INVOICE_ID)?.amountUsdc).toBe(50_000_000n);
    expect(INVOICES.find((i) => i.id === BOT_INVOICE_ID)?.amountUsdc).toBe(25_000_000n);
  });
  it("invoice numbers and memo codes are unique and opaque", () => {
    expect(new Set(INVOICES.map((i) => i.number)).size).toBe(INVOICES.length);
    expect(new Set(INVOICES.map((i) => i.memoCode)).size).toBe(INVOICES.length);
    for (const inv of INVOICES) expect(inv.memoCode).toMatch(/^k_[a-z0-9]{6}$/);
  });
  it("fakeKey is deterministic and base58-shaped", () => {
    expect(fakeKey("x")).toBe(fakeKey("x"));
    expect(fakeKey("x")).toHaveLength(44);
    expect(fakeKey("x", 88)).toMatch(/^[1-9A-HJ-NP-Za-km-z]{88}$/);
  });
});

describe("mockData", () => {
  it("dashboard sums are bigint and consistent", async () => {
    const d = await mockData.getDashboard();
    expect(typeof d.receivedThisMonthUsdc).toBe("bigint");
    expect(d.overdueUsdc <= d.outstandingUsdc).toBe(true);
    expect(d.overdueCount).toBe(3);
    expect(d.attention.every((i) => ["overdue", "disputed", "partially_paid", "seen"].includes(i.status))).toBe(true);
  });
  it("filters invoices", async () => {
    const overdue = await mockData.listInvoices({ status: "overdue" });
    expect(overdue.map((i) => i.status)).toEqual(["overdue", "overdue", "overdue"]);
    const harbourline = await mockData.listInvoices({ buyerId: "b_harbourline" });
    expect(harbourline.every((i) => i.buyerId === "b_harbourline")).toBe(true);
    expect((await mockData.listInvoices({ query: "kobayashi" })).length).toBe(4);
  });
  it("pay page exposes nothing about other buyers", async () => {
    const p = await mockData.getPayInvoice(DEMO_INVOICE_ID);
    expect(p).not.toBeNull();
    expect(JSON.stringify(p, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/b_|memo|k_/);
    expect(p?.solanaPayUrl.startsWith("solana:https%3A%2F%2F")).toBe(true);
  });
  it("error scenario rejects with a plain-English message", async () => {
    await expect(mockData.listInvoices(undefined, { scenario: "error" })).rejects.toThrow(/Couldn't reach Kutip/);
  });
});
