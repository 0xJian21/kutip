import { beforeEach, describe, expect, test } from "vitest";
import * as s from "./schema";
import type { Store } from "./store";
import type { Db } from "./client";
import { buyerInput, ref, RULEBOOK, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

let db: Db;
let store: Store;
let exporterId: string;
let a: Buyer;
let b: Buyer;

const item = (usd: bigint) => [{ description: "Chair", quantity: 1, unitPriceUsdc: usd * 1_000_000n }];

beforeEach(async () => {
  ({ db, store, exporterId, a, b } = await setup());
});

async function invoiceFor(buyer: Buyer, usd: bigint, over: { dueDate?: string; status?: "draft" | "sent"; number?: string } = {}) {
  return store.createInvoice({ exporterId, buyerId: buyer.id, lineItems: item(usd), issuedAt: "2026-09-01", dueDate: over.dueDate ?? "2026-10-01", referencePubkey: ref(), status: over.status ?? "sent", number: over.number });
}

describe("exporter isolation", () => {
  test("owner queries never return another exporter's rows", async () => {
    const mine = await invoiceFor(a, 100n);
    const other = await store.createExporter({ name: "Other Co", treasuryMultisig: "m2", treasuryVault: "v2", treasuryUsdcAta: "a2", rulebook: RULEBOOK });
    const theirBuyer = await store.createBuyer(buyerInput(other.id, "Theirs"));
    const theirs = await store.createInvoice({ exporterId: other.id, buyerId: theirBuyer.id, lineItems: item(7n), issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    await store.recordAgentAction({ exporterId: other.id, buyerId: theirBuyer.id, invoiceId: theirs.id, kind: "reminder", inputSummary: "i", decision: "d", reason: "r", confidence: 1, ruleId: "C1", status: "executed" });

    expect((await store.listInvoices(exporterId)).map((i) => i.id)).toEqual([mine.id]);
    expect((await store.listBuyers(exporterId)).map((x) => x.id)).toEqual([a.id, b.id]);
    expect(await store.listAgentActions(exporterId)).toEqual([]);
    expect((await store.getDashboard(exporterId)).outstandingUsdc).toBe(100_000_000n);
    expect((await store.getTreasury(exporterId)).buyerAccounts.map((x) => x.buyer.id)).toEqual([a.id, b.id]);
  });
});

describe("listInvoices", () => {
  test("filters by status group, buyer and query; overdue and disputed first, then due date", async () => {
    const i1 = await invoiceFor(a, 1n, { dueDate: "2026-10-09" });
    const i2 = await invoiceFor(b, 2n, { dueDate: "2026-10-02" });
    const i3 = await invoiceFor(a, 3n, { dueDate: "2026-10-05" });
    const draft = await invoiceFor(b, 4n, { status: "draft" });
    await store.setInvoiceStatus(exporterId, i3.id, "overdue");
    await store.setInvoiceStatus(exporterId, i1.id, "disputed");

    expect((await store.listInvoices(exporterId)).map((i) => i.id)).toEqual([i3.id, i1.id, i2.id, draft.id]);
    expect((await store.listInvoices(exporterId, { status: "open" })).map((i) => i.id)).toEqual([i3.id, i1.id, i2.id]);
    expect((await store.listInvoices(exporterId, { status: "needs_attention" })).map((i) => i.id)).toEqual([i3.id, i1.id]);
    expect((await store.listInvoices(exporterId, { status: "draft" })).map((i) => i.id)).toEqual([draft.id]);
    expect((await store.listInvoices(exporterId, { buyerId: b.id })).map((i) => i.id)).toEqual([i2.id, draft.id]);
    expect((await store.listInvoices(exporterId, { query: "meridian" })).map((i) => i.id)).toEqual([i2.id, draft.id]);
    expect((await store.listInvoices(exporterId, { query: i2.number.slice(-4) })).map((i) => i.id)).toEqual([i2.id]);
  });

  test("treats LIKE wildcards in the query literally", async () => {
    await invoiceFor(a, 1n);
    expect(await store.listInvoices(exporterId, { query: "%" })).toEqual([]);
  });
});

describe("getDashboard", () => {
  test("sums outstanding, overdue and this month's receipts; lists attention items and recent activity", async () => {
    const paid = await invoiceFor(a, 50n);
    const overdue = await invoiceFor(b, 30n, { dueDate: "2026-09-20" });
    await invoiceFor(a, 20n);
    await store.setInvoiceStatus(exporterId, overdue.id, "overdue");
    await store.recordPayment({ invoiceId: paid.id, signature: "s1", payer: "p", amount: 50_000_000n, commitment: "finalized", slot: 1, verified: true, issues: [], via: "x402", at: new Date("2026-09-10T00:00:00Z") });
    await store.updateBalances(exporterId, { treasuryUsdc: 1_000_000n, vaults: { [a.id]: 2_000_000n } });
    const act = await store.recordAgentAction({ exporterId, kind: "cash_out_alert", inputSummary: "i", decision: "d", reason: "r", confidence: 1, ruleId: "T5", status: "executed" });

    const d = await store.getDashboard(exporterId, { now: new Date("2026-09-27T04:00:00Z") });
    expect(d).toMatchObject({
      rate: { myrPerUsd: 42150n, date: "2026-09-26" },
      receivedThisMonthUsdc: 50_000_000n,
      outstandingUsdc: 50_000_000n,
      overdueUsdc: 30_000_000n,
      overdueCount: 1,
      treasuryBalanceUsdc: 3_000_000n,
    });
    expect(d.attention.map((i) => i.id)).toEqual([overdue.id]);
    expect(d.activity).toEqual([act]);
    const october = await store.getDashboard(exporterId, { now: new Date("2026-10-02T04:00:00Z") });
    expect(october.receivedThisMonthUsdc).toBe(0n);
  });
});

describe("agent actions", () => {
  test("recordAgentAction stores the log entry; listAgentActions is newest first", async () => {
    const inv = await invoiceFor(a, 5n);
    const older = await store.recordAgentAction({ exporterId, buyerId: a.id, invoiceId: inv.id, kind: "reminder", inputSummary: "INV due in 3 days", decision: "Sent the pre-due reminder", reason: "First reminder 3 days before due", confidence: 0.98, ruleId: "C1", status: "executed", at: new Date("2026-09-24T00:00:00Z") });
    const newer = await store.recordAgentAction({ exporterId, kind: "sweep", inputSummary: "Nightly sweep", decision: "Moved 1 USDC", reason: "Daily sweep", confidence: 1, ruleId: "T2", status: "executed", txSignature: "sig", at: new Date("2026-09-25T00:00:00Z") });
    expect(older).toMatchObject({ buyerId: a.id, invoiceId: inv.id, confidence: 0.98, createdAt: "2026-09-24T00:00:00.000Z" });
    expect(newer.buyerId).toBeUndefined();
    expect(await store.listAgentActions(exporterId)).toEqual([newer, older]);
    expect((await store.getInvoice(exporterId, inv.id))?.actions).toEqual([older]);
  });

  test("decideAction approves or rejects only proposed actions of this exporter", async () => {
    const p = await store.recordAgentAction({ exporterId, kind: "sweep_proposal", inputSummary: "i", decision: "d", reason: "r", confidence: 0.8, ruleId: "T4", status: "proposed" });
    const done = await store.recordAgentAction({ exporterId, kind: "reminder", inputSummary: "i", decision: "d", reason: "r", confidence: 1, ruleId: "C1", status: "executed" });
    expect(await store.decideAction("exp_other", p.id, "approved")).toBeNull();
    expect(await store.decideAction(exporterId, done.id, "rejected")).toBeNull();
    expect(await store.decideAction(exporterId, p.id, "approved")).toMatchObject({ id: p.id, status: "approved" });
    expect(await store.decideAction(exporterId, p.id, "rejected")).toBeNull();
  });

  test("setActionStatus lets the worker mark an approved proposal executed with its signature", async () => {
    const p = await store.recordAgentAction({ exporterId, kind: "sweep_proposal", inputSummary: "i", decision: "d", reason: "r", confidence: 0.8, ruleId: "T4", status: "approved" });
    expect(await store.setActionStatus(exporterId, p.id, "executed", "txsig")).toMatchObject({ status: "executed", txSignature: "txsig" });
  });

  test("rejects a buyer from another exporter", async () => {
    const other = await store.createExporter({ name: "O", treasuryMultisig: "m", treasuryVault: "v", treasuryUsdcAta: "a", rulebook: RULEBOOK });
    const foreign = await store.createBuyer(buyerInput(other.id, "F"));
    await expect(store.recordAgentAction({ exporterId, buyerId: foreign.id, kind: "reminder", inputSummary: "i", decision: "d", reason: "r", confidence: 1, ruleId: "C1", status: "executed" })).rejects.toThrow(/buyer/);
  });
});

describe("rulebook", () => {
  test("round-trips bigint fields through jsonb", async () => {
    const next = { ...RULEBOOK, treasury: { ...RULEBOOK.treasury, agentDailyLimitUsdc: 9_007_199_254_740_993n, cashOutAlertMarginBps: 75n } };
    expect(await store.updateRulebook(exporterId, next)).toEqual(next);
    expect(await store.getRulebook(exporterId)).toEqual(next);
  });
});

describe("treasury", () => {
  test("balances, last/next sweep, per-buyer last sweep and cash-out settings", async () => {
    await store.updateBalances(exporterId, { treasuryUsdc: 61_420_000_000n, vaults: { [b.id]: 2_000_000_000n } });
    const s1 = await store.recordSweep({ exporterId, buyerIds: [a.id], amountUsdc: 9_850_000_000n, scheduledFor: new Date("2026-09-02T17:03:00Z"), signature: "sw1", executedAt: new Date("2026-09-02T17:03:11Z") });
    const s2 = await store.recordSweep({ exporterId, buyerIds: [a.id, b.id], amountUsdc: 1n, scheduledFor: new Date("2026-09-26T11:17:00Z"), signature: "sw2", executedAt: new Date("2026-09-26T11:17:42Z") });
    const next = await store.recordSweep({ exporterId, buyerIds: [b.id], scheduledFor: new Date("2026-09-27T13:26:00Z") });
    expect(next).toMatchObject({ status: "scheduled", amountUsdc: 0n });

    const t = await store.getTreasury(exporterId);
    expect(t.mainBalanceUsdc).toBe(61_420_000_000n);
    expect(t.buyerAccounts).toEqual([
      { buyer: a, balanceUsdc: 0n, lastSweepAt: "2026-09-26T11:17:42.000Z" },
      { buyer: b, balanceUsdc: 2_000_000_000n, lastSweepAt: "2026-09-26T11:17:42.000Z" },
    ]);
    expect(t.lastSweep).toEqual(s2);
    expect(t.nextSweep).toEqual(next);
    expect(t.agentDailyLimitUsdc).toBe(RULEBOOK.treasury.agentDailyLimitUsdc);
    expect(t.cashOut).toEqual({ currentRate: { myrPerUsd: 42150n, date: "2026-09-26" }, thirtyDayAvg: { myrPerUsd: 41930n, date: "2026-09-26" }, alertMarginBps: 50n, whitelisted: [] });
    expect(s1.status).toBe("executed");
  });

  test("recordSweep with an existing id records the execution", async () => {
    const planned = await store.recordSweep({ exporterId, buyerIds: [a.id], scheduledFor: new Date("2026-09-27T13:26:00Z") });
    const done = await store.recordSweep({ id: planned.id, exporterId, buyerIds: [a.id], amountUsdc: 5n, scheduledFor: new Date("2026-09-27T13:26:00Z"), signature: "sw", executedAt: new Date("2026-09-27T13:26:09Z") });
    expect(done).toMatchObject({ id: planned.id, status: "executed", amountUsdc: 5n, signature: "sw" });
    expect((await store.getTreasury(exporterId)).nextSweep).toBeUndefined();
  });

  test("no BNM rate recorded yet → a clear error", async () => {
    await db.delete(s.fxRates);
    await expect(store.getTreasury(exporterId)).rejects.toThrow(/rate/);
  });
});

describe("other writes", () => {
  test("recordScreening stores the result", async () => {
    const inv = await invoiceFor(a, 1n);
    const sc = await store.recordScreening({ wallet: "W1", invoiceId: inv.id, result: "flag", reasons: ["sanctions list"] });
    expect(sc).toMatchObject({ wallet: "W1", invoiceId: inv.id, result: "flag", reasons: ["sanctions list"] });
    expect(await store.latestScreening("W1")).toMatchObject({ result: "flag" });
    expect(await store.latestScreening("nobody")).toBeNull();
  });

  test("recordMessage appears on the invoice, oldest first", async () => {
    const inv = await invoiceFor(a, 1n);
    const m2 = await store.recordMessage({ invoiceId: inv.id, direction: "in", from: "Claire", subject: "Re", body: "will pay", classification: { intent: "will_pay_on_date", confidence: 0.9 }, at: new Date("2026-09-25T00:00:00Z") });
    const m1 = await store.recordMessage({ invoiceId: inv.id, direction: "out", from: "Kutip", subject: "Reminder", body: "due", at: new Date("2026-09-24T00:00:00Z") });
    expect((await store.getInvoice(exporterId, inv.id))?.messages).toEqual([m1, m2]);
    expect(m1.classification).toBeUndefined();
  });

  test("updateBuyerAccounts / updateTreasuryAccounts store provisioned addresses", async () => {
    const nb = await store.updateBuyerAccounts(exporterId, a.id, { multisig: "M", vault: "V", usdcAta: "A", spendingLimitPda: "S" });
    expect(nb).toMatchObject({ multisig: "M", vault: "V", usdcAta: "A" });
    await store.updateTreasuryAccounts(exporterId, { treasuryMultisig: "TM", treasuryVault: "TV", treasuryUsdcAta: "TA" });
    expect(await store.getExporter(exporterId)).toMatchObject({ treasuryMultisig: "TM", treasuryVault: "TV", treasuryUsdcAta: "TA" });
  });
});

describe("findUser (sign-in)", () => {
  test("matches by Privy user id first, then by wallet, and links the Privy id", async () => {
    const { id } = await store.createUser({ exporterId, name: "Owner", role: "owner", walletPubkey: "OwnerWallet111" });
    expect(await store.findUser({ privyUserId: "did:privy:x", wallets: ["Nope"] })).toBeNull();
    expect(await store.findUser({ privyUserId: "did:privy:x", wallets: ["Nope", "OwnerWallet111"] })).toEqual({ userId: id, exporterId, role: "owner" });
    await store.linkPrivyUser(id, "did:privy:x");
    expect(await store.findUser({ privyUserId: "did:privy:x", wallets: [] })).toEqual({ userId: id, exporterId, role: "owner" });
  });
});
