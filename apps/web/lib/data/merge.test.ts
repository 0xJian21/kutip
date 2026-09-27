import { describe, expect, it } from "vitest";
import { mergeInvoiceEvent, parseInvoiceEvent, parsePaymentEvent } from "./merge";
import type { Invoice } from "../ui/types";

const invoiceEvent = { id: "inv_1", status: "paid", amountUsdc: "1000000", receivedUsdc: "1000000", seenAt: "2026-09-30T02:00:00.000Z", paidAt: "2026-09-30T02:00:01.000Z", settledAt: null };
const paymentEvent = {
  id: "pay_1", invoiceId: "inv_1", signature: "sig", payer: "buyer", amount: "1000000", inputMint: "SOL", inputAmount: "5000000", quotedInput: "4990000", quotedOut: "1000000",
  commitment: "confirmed", slot: 42, verified: true, issues: [], via: "solana_pay", observedAt: "2026-09-30T02:00:00.000Z", confirmedAt: "2026-09-30T02:00:01.000Z", finalizedAt: null,
};

describe("Broadcast payloads", () => {
  it("parses invoice events: bigints from strings, null → undefined", () => {
    expect(parseInvoiceEvent(invoiceEvent)).toEqual({ id: "inv_1", status: "paid", amountUsdc: 1_000_000n, receivedUsdc: 1_000_000n, seenAt: "2026-09-30T02:00:00.000Z", paidAt: "2026-09-30T02:00:01.000Z", settledAt: undefined });
  });

  it("parses payment events", () => {
    const p = parsePaymentEvent(paymentEvent);
    expect(p).toMatchObject({ signature: "sig", amount: 1_000_000n, inputMint: "SOL", inputAmount: 5_000_000n, quotedInput: 4_990_000n, quotedOut: 1_000_000n, commitment: "confirmed", slot: 42, feePaidByKutip: true, mint: "USDC" });
    expect(p.finalizedAt).toBeUndefined();
  });

  it("parses a USDC payment without swap fields", () => {
    const p = parsePaymentEvent({ ...paymentEvent, inputMint: null, inputAmount: null, quotedInput: null, quotedOut: null });
    expect(p.inputMint).toBeUndefined();
    expect(p.inputAmount).toBeUndefined();
  });

  it("merges an invoice event into an invoice without touching other fields", () => {
    const inv = { id: "inv_1", number: "INV-1", status: "sent", receivedUsdc: 0n, amountUsdc: 1_000_000n } as Invoice;
    const next = mergeInvoiceEvent(inv, parseInvoiceEvent(invoiceEvent));
    expect(next).toMatchObject({ number: "INV-1", status: "paid", receivedUsdc: 1_000_000n, paidAt: "2026-09-30T02:00:01.000Z" });
  });

  it("never moves the status backwards when events arrive out of order", () => {
    const inv = { id: "inv_1", status: "settled", receivedUsdc: 1_000_000n, amountUsdc: 1_000_000n } as Invoice;
    expect(mergeInvoiceEvent(inv, parseInvoiceEvent({ ...invoiceEvent, status: "seen" })).status).toBe("settled");
  });
});
