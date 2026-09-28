import * as schema from "@kutip/db/src/schema";
import { buyerInput, setup } from "@kutip/db/src/testing/fixtures";
import type { Store } from "@kutip/db";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test } from "vitest";
import { createPaymentTracker, type TrackerRpc } from "./payments";
import { fromRpc, type RpcTransaction } from "./verify";

const fixture = (name: string): RpcTransaction => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SPIKE_C = fixture("spike-c-usdc");
const SPIKE_C_REF = "F8JhQa4T" as const; // prefix; the full key is read from the fixture below
const refOf = (tx: RpcTransaction, prefix: string) => tx.transaction.message.accountKeys.find((k) => k.startsWith(prefix))!;
const T = (ms: number) => new Date(Date.UTC(2026, 8, 27, 2, 0, 0, ms));

let store: Store;
let exporterId: string;
let invoiceId: string;
let reference: string;
let logs: string[];
let paid: string[];

const noRpc: TrackerRpc = {
  getSignatureStatuses: async () => [],
  getSignaturesForAddress: async () => [],
  getTransaction: async () => null,
};

async function invoiceFor(tx: RpcTransaction, refPrefix: string, amount: bigint) {
  const ctx = await setup();
  ({ store, exporterId } = ctx);
  const buyer = await store.createBuyer({ ...buyerInput(exporterId, "Spike B"), vault: "4knsrLskrCc1KBmQ5baYEBkaXmK73izrA7TNgvqiYDte", usdcAta: "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS" });
  reference = refOf(tx, refPrefix);
  const inv = await store.createInvoice({
    exporterId, buyerId: buyer.id, issuedAt: "2026-09-27", dueDate: "2026-10-04", referencePubkey: reference, status: "sent",
    lineItems: [{ description: "Sample", quantity: 1, unitPriceUsdc: amount }],
  });
  await ctx.db.update(schema.invoices).set({ memoCode: "k_test01" }).where(eq(schema.invoices.id, inv.id));
  invoiceId = inv.id;
}

function tracker(rpc: TrackerRpc = noRpc) {
  logs = [];
  paid = [];
  const t = createPaymentTracker({ store, rpc, usdcMint: USDC, log: (m) => logs.push(m), onPaid: async (p) => void paid.push(p.invoiceId) });
  t.setReferences([{ invoiceId, referencePubkey: reference }]);
  return t;
}

describe("live stream: processed tx + slot status", () => {
  beforeEach(() => invoiceFor(SPIKE_C, SPIKE_C_REF, 100_000n));

  test("processed → Seen, confirmed → Paid, finalized → Settled, with exact timings", async () => {
    const t = tracker();
    await t.onTransaction(fromRpc(SPIKE_C), T(0));
    let d = (await store.getInvoice(exporterId, invoiceId))!;
    expect(d.invoice).toMatchObject({ status: "seen", seenAt: T(0).toISOString() });
    expect(d.payments[0]).toMatchObject({ commitment: "processed", verified: true, amount: 100_000n, slot: SPIKE_C.slot, via: "solana_pay" });

    await t.onSlot(SPIKE_C.slot, "confirmed", T(193));
    d = (await store.getInvoice(exporterId, invoiceId))!;
    expect(d.invoice).toMatchObject({ status: "paid", receivedUsdc: 100_000n, paidAt: T(193).toISOString() });
    expect(paid).toEqual([invoiceId]);

    await t.onSlot(SPIKE_C.slot, "finalized", T(8_700));
    d = (await store.getInvoice(exporterId, invoiceId))!;
    expect(d.invoice).toMatchObject({ status: "settled", settledAt: T(8_700).toISOString() });
    expect(d.payments[0]).toMatchObject({ commitment: "finalized", observedAt: T(0).toISOString(), confirmedAt: T(193).toISOString(), finalizedAt: T(8_700).toISOString() });
    expect(t.pending()).toEqual([]);
    expect(logs.join("\n")).toMatch(/Seen .*\n.*Paid .*\+193 ms[\s\S]*Settled .*\+8700 ms/);
    expect(paid).toEqual([invoiceId]); // once
  });

  test("slot updates for other slots and txs without a watched reference are ignored", async () => {
    const t = tracker();
    t.setReferences([]);
    await t.onTransaction(fromRpc(SPIKE_C), T(0));
    await t.onSlot(SPIKE_C.slot + 1, "confirmed", T(1));
    expect((await store.getInvoice(exporterId, invoiceId))!.payments).toEqual([]);
  });

  test("a dead slot drops the tx from tracking; the payment stays unconfirmed", async () => {
    const t = tracker();
    await t.onTransaction(fromRpc(SPIKE_C), T(0));
    await t.onSlot(SPIKE_C.slot, "dead", T(50));
    expect(t.pending()).toEqual([]);
    expect((await store.getInvoice(exporterId, invoiceId))!.invoice.status).toBe("seen");
  });

  test("reconcile advances stale txs from getSignatureStatuses (missed slot updates)", async () => {
    const rpc: TrackerRpc = { ...noRpc, getSignatureStatuses: async (sigs) => sigs.map(() => ({ slot: SPIKE_C.slot, confirmationStatus: "finalized" as const, err: null })) };
    const t = tracker(rpc);
    await t.onTransaction(fromRpc(SPIKE_C), T(0));
    await t.reconcile(T(5_000)); // too fresh: left to the stream
    expect((await store.getInvoice(exporterId, invoiceId))!.invoice.status).toBe("seen");
    await t.reconcile(T(30_000));
    expect((await store.getInvoice(exporterId, invoiceId))!.invoice).toMatchObject({ status: "settled", paidAt: T(30_000).toISOString() });
    expect(t.pending()).toEqual([]);
  });
});

describe("backfill after a (re)connect", () => {
  beforeEach(() => invoiceFor(SPIKE_C, SPIKE_C_REF, 100_000n));

  test("payments made while disconnected are recorded at their current commitment", async () => {
    const sig = SPIKE_C.transaction.signatures[0]!;
    const rpc: TrackerRpc = {
      ...noRpc,
      getSignaturesForAddress: async (addr) => (addr === reference ? [{ signature: sig, slot: SPIKE_C.slot, err: null, confirmationStatus: "finalized" }] : []),
      getTransaction: async (s) => (s === sig ? SPIKE_C : null),
    };
    const t = tracker(rpc);
    await t.backfill(T(0));
    const d = (await store.getInvoice(exporterId, invoiceId))!;
    expect(d.invoice.status).toBe("settled");
    expect(d.payments[0]).toMatchObject({ signature: sig, commitment: "finalized", verified: true });
    expect(paid).toEqual([invoiceId]);
  });

  test("uses the block time for Seen/Paid/Settled, not the catch-up time", async () => {
    const sig = SPIKE_C.transaction.signatures[0]!;
    const blockTime = Date.UTC(2026, 8, 26, 10, 0, 0) / 1000;
    const rpc: TrackerRpc = {
      ...noRpc,
      getSignaturesForAddress: async (addr) => (addr === reference ? [{ signature: sig, slot: SPIKE_C.slot, err: null, confirmationStatus: "finalized", blockTime }] : []),
      getTransaction: async (s) => (s === sig ? SPIKE_C : null),
    };
    await tracker(rpc).backfill(T(0));
    const d = (await store.getInvoice(exporterId, invoiceId))!;
    expect(d.invoice.paidAt).toBe(new Date(blockTime * 1000).toISOString());
  });

  test("a repeated catch-up skips signatures it already recorded as final", async () => {
    const sig = SPIKE_C.transaction.signatures[0]!;
    let fetched = 0;
    const rpc: TrackerRpc = {
      ...noRpc,
      getSignaturesForAddress: async (addr) => (addr === reference ? [{ signature: sig, slot: SPIKE_C.slot, err: null, confirmationStatus: "finalized" }] : []),
      getTransaction: async (s) => (fetched++, s === sig ? SPIKE_C : null),
    };
    const t = tracker(rpc);
    await t.backfill(T(0));
    await t.backfill(T(1000));
    expect(fetched).toBe(1);
    expect(paid).toEqual([invoiceId]);
  });
});

describe("backfill isolation", () => {
  beforeEach(() => invoiceFor(SPIKE_C, SPIKE_C_REF, 100_000n));

  test("one signature that can't be recorded (or fetched) doesn't stop the rest of the catch-up", async () => {
    const sig = SPIKE_C.transaction.signatures[0]!;
    const broken = "BrokenSig1111111111111111111111111111111111111111111111111111111";
    const rpc: TrackerRpc = {
      ...noRpc,
      // the broken one comes first, as it would for a newer tx on the same reference
      getSignaturesForAddress: async (addr) => (addr === reference ? [{ signature: broken, slot: 1, err: null, confirmationStatus: "finalized" }, { signature: sig, slot: SPIKE_C.slot, err: null, confirmationStatus: "finalized" }] : []),
      getTransaction: async (s) => {
        if (s === broken) throw new Error("rpc hiccup");
        return s === sig ? SPIKE_C : null;
      },
    };
    const t = tracker(rpc);
    await t.backfill(T(0));
    expect((await store.getInvoice(exporterId, invoiceId))!.invoice.status).toBe("settled");
    expect(logs.some((l) => l.includes("BrokenSi") && l.includes("rpc hiccup"))).toBe(true);
  });
});

describe("swap payment", () => {
  const SWAP = fixture("spike-a-swap-phantom");
  beforeEach(async () => {
    // Jupiter's trackingAccount (appended to the swap ix) carries the reference.
    await invoiceFor(SWAP, "rmLAT", 500_000n);
  });

  test("the stored quote lands on the payment for the execution receipt", async () => {
    await store.recordQuote(reference, { inputMint: "SOL", quotedInput: 4_120_000n, quotedOut: 500_000n });
    const t = tracker();
    await t.onTransaction(fromRpc(SWAP), T(0));
    const p = (await store.getInvoice(exporterId, invoiceId))!.payments[0];
    expect(p).toMatchObject({ inputMint: "SOL", inputAmount: 4_128_768n, quotedInput: 4_120_000n, quotedOut: 500_000n, verified: true });
  });
});
