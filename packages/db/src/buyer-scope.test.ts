/**
 * SPEC §5 L4: buyer-facing reads (pay page, agent context) take one invoice or
 * buyer id and must never return anything belonging to another buyer.
 */
import { beforeEach, describe, expect, test } from "vitest";
import type { Store } from "./store";
import { APP_URL, ref, setup } from "./testing/fixtures";
import type { Buyer, Invoice } from "./types";

let store: Store;
let exporterId: string;
let a: Buyer;
let b: Buyer;
let invA: Invoice;
let invB: Invoice;

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

beforeEach(async () => {
  ({ store, exporterId, a, b } = await setup());
  invA = await store.createInvoice({ exporterId, buyerId: a.id, issuedAt: "2026-09-08", dueDate: "2026-10-08", referencePubkey: ref(), status: "sent",
    lineItems: [{ description: "Teak console table", quantity: 25, unitPriceUsdc: 330_000_000n }] });
  invB = await store.createInvoice({ exporterId, buyerId: b.id, issuedAt: "2026-09-05", dueDate: "2026-10-05", referencePubkey: ref(), status: "sent",
    lineItems: [{ description: "Secret bar stool", quantity: 32, unitPriceUsdc: 140_777_000n }] });
  await store.recordMessage({ invoiceId: invB.id, direction: "in", from: b.email, subject: "Re: stools", body: "B's private reply" });
  await store.recordAgentAction({ exporterId, buyerId: b.id, invoiceId: invB.id, kind: "classify_reply", inputSummary: "B reply", decision: "B decision", reason: "B reason", confidence: 0.9, ruleId: "C3", status: "escalated" });
  await store.recordAgentAction({ exporterId, kind: "sweep", inputSummary: "Nightly sweep of both vaults", decision: "Moved funds", reason: "Daily", confidence: 1, ruleId: "T2", status: "executed" });
  await store.recordMessage({ invoiceId: invA.id, direction: "out", from: "Kutip", subject: "Reminder", body: "A's reminder" });
});

/** Anything that identifies buyer B or B's invoice. */
const bSecrets = () => [b.id, b.name, b.email, b.contactName, b.vault, b.usdcAta, b.multisig, invB.id, invB.number, invB.memoCode, invB.referencePubkey, "Secret bar stool", "4504864000", "B's private reply", "B decision"];

describe("getPayInvoice", () => {
  test("returns only the public fields of that one invoice", async () => {
    const pay = await store.getPayInvoice(invA.id);
    expect(pay).toEqual({
      invoiceId: invA.id,
      exporterName: "Teratai Woodworks Sdn. Bhd.",
      exporterAddress: "",
      buyerName: a.name,
      buyerAddress: "",
      invoiceNumber: invA.number,
      // The invoice document (IMPROVEMENTS P1): the buyer sees its own line items on the pay page.
      lineItems: [{ description: "Teak console table", quantity: 25, unitPriceUsdc: 330_000_000n }],
      amountUsdc: 8_250_000_000n,
      issuedAt: "2026-09-08",
      dueDate: "2026-10-08",
      status: "sent",
      solanaPayUrl: `solana:${encodeURIComponent(`${APP_URL}/api/pay/${invA.id}`)}`,
      acceptedTokens: ["USDC", "SOL"],
    });
    const out = json(pay);
    for (const secret of bSecrets()) expect(out).not.toContain(secret);
    // no internals of A either: memo, reference key, vault, buyer contact
    for (const internal of [invA.memoCode, invA.referencePubkey, a.email, a.vault]) expect(out).not.toContain(internal);
  });

  test("includes the latest payment once paid", async () => {
    await store.recordPayment({ invoiceId: invA.id, signature: "SIG_A", payer: "P", amount: 8_250_000_000n, inputMint: "SOL", inputAmount: 5n, quotedInput: 4n, commitment: "confirmed", slot: 1, verified: true, issues: [], via: "solana_pay", at: new Date("2026-09-27T01:58:32Z") });
    const pay = await store.getPayInvoice(invA.id);
    expect(pay).toMatchObject({ status: "paid", paidAt: "2026-09-27T01:58:32.000Z", payment: { signature: "SIG_A", amount: 8_250_000_000n, inputMint: "SOL", inputAmount: 5n } });
    expect(Object.keys(pay!.payment!).sort()).toEqual(["amount", "inputAmount", "inputMint", "signature"]);
  });

  test("returns null for drafts and unknown ids", async () => {
    const draft = await store.createInvoice({ exporterId, buyerId: a.id, issuedAt: "2026-09-08", dueDate: "2026-10-08", referencePubkey: ref(), lineItems: [{ description: "d", quantity: 1, unitPriceUsdc: 1n }] });
    expect(await store.getPayInvoice(draft.id)).toBeNull();
    expect(await store.getPayInvoice("inv_nope")).toBeNull();
  });
});

describe("getBuyerContext", () => {
  test("holds buyer A's invoices, messages and actions and nothing of buyer B", async () => {
    const ctx = await store.getBuyerContext(exporterId, a.id);
    expect(ctx?.buyer).toEqual(a);
    expect(ctx?.exporterName).toBe("Teratai Woodworks Sdn. Bhd.");
    expect(ctx?.invoices.map((i) => i.id)).toEqual([invA.id]);
    expect(ctx?.messages.map((m) => m.body)).toEqual(["A's reminder"]);
    expect(ctx?.actions).toEqual([]); // the multi-buyer sweep has no buyer_id and is excluded
    const out = json(ctx);
    for (const secret of bSecrets()) expect(out).not.toContain(secret);
    expect(out).not.toContain("Nightly sweep");
  });

  test("requires the buyer to belong to the exporter", async () => {
    expect(await store.getBuyerContext("exp_other", a.id)).toBeNull();
  });
});
