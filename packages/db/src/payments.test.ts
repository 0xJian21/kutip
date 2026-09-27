import { beforeEach, describe, expect, test } from "vitest";
import type { Store } from "./store";
import { ref, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

const T = (s: string) => new Date(`2026-09-27T01:58:${s}Z`);
const SIG = "5".repeat(88);

let store: Store;
let exporterId: string;
let a: Buyer;
let invoiceId: string;

beforeEach(async () => {
  ({ store, exporterId, a } = await setup());
  const inv = await store.createInvoice({
    exporterId, buyerId: a.id, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: ref(), status: "sent",
    lineItems: [{ description: "Sample tray", quantity: 1, unitPriceUsdc: 50_000_000n }],
  });
  invoiceId = inv.id;
});

const event = (over: Partial<Parameters<Store["recordPayment"]>[0]> = {}) => ({
  invoiceId, signature: SIG, payer: "Payer1111", amount: 50_000_000n, commitment: "processed" as const,
  slot: 378_512_990, verified: false, issues: [], via: "solana_pay" as const, at: T("31"), ...over,
});

describe("recordPayment", () => {
  test("processed → invoice seen", async () => {
    const { payment, invoice } = await store.recordPayment(event());
    expect(payment).toMatchObject({ signature: SIG, commitment: "processed", observedAt: T("31").toISOString(), mint: "USDC", feePaidByKutip: true });
    expect(payment.confirmedAt).toBeUndefined();
    expect(invoice).toMatchObject({ status: "seen", seenAt: T("31").toISOString(), receivedUsdc: 0n });
    expect(invoice.paidAt).toBeUndefined();
  });

  test("processed → confirmed → finalized walks seen → paid → settled on one payment row", async () => {
    await store.recordPayment(event());
    const paid = await store.recordPayment(event({ commitment: "confirmed", verified: true, at: T("32") }));
    expect(paid.invoice).toMatchObject({ status: "paid", receivedUsdc: 50_000_000n, paidAt: T("32").toISOString() });
    expect(paid.payment).toMatchObject({ commitment: "confirmed", verified: true, observedAt: T("31").toISOString(), confirmedAt: T("32").toISOString() });

    const settled = await store.recordPayment(event({ commitment: "finalized", verified: true, at: T("44") }));
    expect(settled.invoice).toMatchObject({ status: "settled", seenAt: T("31").toISOString(), paidAt: T("32").toISOString(), settledAt: T("44").toISOString() });
    expect(settled.payment.finalizedAt).toBe(T("44").toISOString());

    const detail = await store.getInvoice(exporterId, invoiceId);
    expect(detail?.payments).toHaveLength(1);
  });

  test("is idempotent by signature and never moves commitment backwards", async () => {
    await store.recordPayment(event({ commitment: "finalized", verified: true, at: T("44") }));
    const replay = await store.recordPayment(event({ commitment: "processed", verified: false, at: T("50") }));
    expect(replay.payment).toMatchObject({ commitment: "finalized", verified: true, finalizedAt: T("44").toISOString() });
    expect(replay.invoice.status).toBe("settled");
    const again = await store.recordPayment(event({ commitment: "finalized", verified: true, at: T("59") }));
    expect(again.payment.finalizedAt).toBe(T("44").toISOString());
    expect(again.invoice.settledAt).toBe(T("44").toISOString());
    expect((await store.getInvoice(exporterId, invoiceId))?.payments).toHaveLength(1);
  });

  test("a first sighting at confirmed also fills seen and observed times", async () => {
    const { payment, invoice } = await store.recordPayment(event({ commitment: "confirmed", verified: true, at: T("32") }));
    expect(payment.observedAt).toBe(T("32").toISOString());
    expect(invoice).toMatchObject({ status: "paid", seenAt: T("32").toISOString(), paidAt: T("32").toISOString() });
  });

  test("an unverified payment never counts as received", async () => {
    const { invoice } = await store.recordPayment(event({ commitment: "finalized", verified: false, issues: ["Wrong mint"] }));
    expect(invoice).toMatchObject({ status: "seen", receivedUsdc: 0n });
    expect(invoice.paidAt).toBeUndefined();
  });

  test("partial payments: partially_paid, then paid, settled only when every counted payment is final", async () => {
    const part = await store.recordPayment(event({ amount: 20_000_000n, commitment: "finalized", verified: true, issues: ["Amount is less than the invoice total"], at: T("32") }));
    expect(part.invoice).toMatchObject({ status: "partially_paid", receivedUsdc: 20_000_000n, paidAt: T("32").toISOString() });
    const rest = await store.recordPayment(event({ signature: "6".repeat(88), amount: 30_000_000n, commitment: "confirmed", verified: true, at: T("40") }));
    expect(rest.invoice).toMatchObject({ status: "paid", receivedUsdc: 50_000_000n, paidAt: T("32").toISOString() });
    const fin = await store.recordPayment(event({ signature: "6".repeat(88), amount: 30_000_000n, commitment: "finalized", verified: true, at: T("52") }));
    expect(fin.invoice).toMatchObject({ status: "settled", settledAt: T("52").toISOString() });
  });

  test("an overdue invoice moves to paid", async () => {
    await store.setInvoiceStatus(exporterId, invoiceId, "overdue");
    const { invoice } = await store.recordPayment(event({ commitment: "confirmed", verified: true }));
    expect(invoice.status).toBe("paid");
  });

  test("stores swap details for the execution receipt", async () => {
    const { payment } = await store.recordPayment(event({ inputMint: "SOL", inputAmount: 283_100_000n, quotedInput: 282_900_000n, quotedOut: 50_000_000n }));
    expect(payment).toMatchObject({ inputMint: "SOL", inputAmount: 283_100_000n, quotedInput: 282_900_000n, quotedOut: 50_000_000n });
  });

  test("rejects a signature already recorded against a different invoice", async () => {
    const other = await store.createInvoice({
      exporterId, buyerId: a.id, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: ref(), status: "sent",
      lineItems: [{ description: "x", quantity: 1, unitPriceUsdc: 1n }],
    });
    await store.recordPayment(event());
    await expect(store.recordPayment(event({ invoiceId: other.id }))).rejects.toThrow(/different invoice/);
  });

  test("x402 sticks whichever reports first: the facilitator or the listener", async () => {
    await store.recordPayment(event({ commitment: "confirmed", verified: true, via: "x402", slot: 0 }));
    const { payment } = await store.recordPayment(event({ commitment: "finalized", verified: true, via: "solana_pay", slot: 378_512_990 }));
    expect(payment).toMatchObject({ via: "x402", slot: 378_512_990, commitment: "finalized" });

    const sig = "7".repeat(88);
    await store.recordPayment(event({ signature: sig, commitment: "processed", via: "solana_pay" }));
    const late = await store.recordPayment(event({ signature: sig, commitment: "confirmed", verified: true, via: "x402", slot: 0 }));
    expect(late.payment).toMatchObject({ via: "x402", slot: 378_512_990 });
  });

  test("rejects an unknown invoice", async () => {
    await expect(store.recordPayment(event({ invoiceId: "inv_nope" }))).rejects.toThrow(/invoice/);
  });
});

describe("worker lookups", () => {
  test("getPaymentTarget resolves a reference key to what verification needs", async () => {
    const inv = (await store.getInvoice(exporterId, invoiceId))!.invoice;
    const target = await store.getPaymentTarget(inv.referencePubkey);
    expect(target).toEqual({
      invoiceId, exporterId, buyerId: a.id, status: "sent", amountUsdc: 50_000_000n, receivedUsdc: 0n,
      memoCode: inv.memoCode, vault: a.vault, vaultUsdcAta: a.usdcAta,
    });
    expect(await store.getPaymentTarget("unknown")).toBeNull();
  });

  test("listWatchedAccounts returns open invoice references and every buyer vault ATA", async () => {
    const draft = await store.createInvoice({ exporterId, buyerId: a.id, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: ref(), lineItems: [{ description: "d", quantity: 1, unitPriceUsdc: 1n }] });
    const open = (await store.getInvoice(exporterId, invoiceId))!.invoice;
    const w = await store.listWatchedAccounts();
    expect(w.references).toEqual([{ invoiceId, referencePubkey: open.referencePubkey }]);
    expect(w.references.map((r) => r.invoiceId)).not.toContain(draft.id);
    expect(w.vaultAtas).toContain(a.usdcAta);
  });
});
