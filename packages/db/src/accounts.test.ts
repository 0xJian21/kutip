/**
 * Session 8b: company profile + logo, demo flag, cash-out whitelist, agent
 * permissions approval, proposal_index on agent actions, dashboard/pay-page extras.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "./client";
import * as s from "./schema";
import type { Store } from "./store";
import { buyerInput, ref, RULEBOOK, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

let db: Db;
let store: Store;
let exporterId: string;
let a: Buyer;

beforeEach(async () => {
  ({ db, store, exporterId, a } = await setup());
});

const item = [{ description: "Teak table", quantity: 2, unitPriceUsdc: 1_450_000_000n }];

describe("company profile", () => {
  test("createExporter defaults the profile fields and getExporter returns them", async () => {
    const e = await store.getExporter(exporterId);
    expect(e).toMatchObject({ address: "", contactEmail: "", demoFunds: false });
    expect(e?.logoUrl).toBeUndefined();
    expect(e?.permissionsApprovedAt).toBeUndefined();
  });

  test("createExporter takes address, contact email, logo and the demo flag", async () => {
    const e = await store.createExporter({
      name: "Demo Co",
      address: "12 Jalan Kayu, 84000 Muar, Johor",
      contactEmail: "farid@demo.example",
      logoUrl: "https://cdn.example/logo.png",
      demoFunds: true,
      treasuryMultisig: "m",
      treasuryVault: "v",
      treasuryUsdcAta: "a",
      rulebook: RULEBOOK,
    });
    expect(e).toMatchObject({ address: "12 Jalan Kayu, 84000 Muar, Johor", contactEmail: "farid@demo.example", logoUrl: "https://cdn.example/logo.png", demoFunds: true });
  });

  test("updateExporterProfile changes only the given fields", async () => {
    const before = await store.getExporter(exporterId);
    const after = await store.updateExporterProfile(exporterId, { registrationNo: "202001034567", address: "Muar", contactEmail: "ap@teratai.example", logoUrl: "https://cdn.example/t.png" });
    expect(after).toMatchObject({ name: before!.name, registrationNo: "202001034567", address: "Muar", contactEmail: "ap@teratai.example", logoUrl: "https://cdn.example/t.png" });
    expect((await store.updateExporterProfile(exporterId, { logoUrl: null })).logoUrl).toBeUndefined();
  });

  test("updateExporterProfile refuses an unknown exporter", async () => {
    await expect(store.updateExporterProfile("exp_nope", { name: "x" })).rejects.toThrow(/exporter not found/);
  });
});

describe("buyer address", () => {
  test("createBuyer stores the billing address and getInvoice exposes it", async () => {
    const b = await store.createBuyer({ ...buyerInput(exporterId, "Kobayashi"), address: "1-2-3 Umeda, Osaka" });
    expect(b.address).toBe("1-2-3 Umeda, Osaka");
    expect(a.address).toBe("");
  });
});

describe("cash-out whitelist and permissions approval", () => {
  test("setCashOutWhitelist replaces the list", async () => {
    await store.setCashOutWhitelist(exporterId, [{ label: "HATA USDC (Solana)", address: "HataDeposit111111111111111111111111111111111" }]);
    expect((await store.getTreasury(exporterId)).cashOut.whitelisted).toEqual([{ label: "HATA USDC (Solana)", address: "HataDeposit111111111111111111111111111111111" }]);
  });

  test("recordPermissionsApproval stamps the exporter", async () => {
    const at = new Date("2026-09-28T10:00:00Z");
    await store.recordPermissionsApproval(exporterId, { wallet: "Owner111", signature: "sig111", at });
    expect((await store.getExporter(exporterId))?.permissionsApprovedAt).toBe(at.toISOString());
  });
});

describe("rulebook replies", () => {
  test("a rulebook stored before the replies section existed reads back with the defaults", async () => {
    const { replies: _drop, ...legacy } = (await db.select().from(s.exporters).where(eq(s.exporters.id, exporterId)))[0]!.rulebook;
    await db.update(s.exporters).set({ rulebook: legacy as s.RulebookJson }).where(eq(s.exporters.id, exporterId));
    expect((await store.getRulebook(exporterId)).replies).toEqual({ remindersAndReceipts: "automatic", buyerReplies: "draft" });
  });

  test("updateRulebook round-trips the replies section", async () => {
    const rb = await store.getRulebook(exporterId);
    const next = await store.updateRulebook(exporterId, { ...rb, replies: { remindersAndReceipts: "draft", buyerReplies: "routine" } });
    expect(next.replies).toEqual({ remindersAndReceipts: "draft", buyerReplies: "routine" });
    expect((await store.getExporter(exporterId))?.rulebook.replies.buyerReplies).toBe("routine");
  });
});

describe("agent actions with a Squads proposal", () => {
  const proposal = (proposalIndex: bigint) =>
    store.recordAgentAction({ exporterId, kind: "cash_out_alert", inputSummary: "cash out", decision: "d", reason: "r", confidence: 1, ruleId: "T4", status: "proposed", proposalIndex });

  test("recordAgentAction keeps the proposal index and listAgentActions returns it", async () => {
    const act = await proposal(7n);
    expect(act.proposalIndex).toBe(7);
    expect((await store.listAgentActions(exporterId))[0]?.proposalIndex).toBe(7);
    const plain = await store.recordAgentAction({ exporterId, kind: "reminder", inputSummary: "i", decision: "d", reason: "r", confidence: 1, ruleId: "C1", status: "executed" });
    expect(plain.proposalIndex).toBeUndefined();
  });

  test("settleProposal marks a proposed action executed only for its own proposal index", async () => {
    const act = await proposal(3n);
    expect(await store.settleProposal(exporterId, { actionId: act.id, proposalIndex: 4n, status: "executed", txSignature: "sig" })).toBeNull();
    const done = await store.settleProposal(exporterId, { actionId: act.id, proposalIndex: 3n, status: "executed", txSignature: "sig" });
    expect(done).toMatchObject({ status: "executed", txSignature: "sig" });
    // A second settlement can no longer touch it: the audit trail is final.
    expect(await store.settleProposal(exporterId, { actionId: act.id, proposalIndex: 3n, status: "rejected", txSignature: "sig2" })).toBeNull();
  });

  test("settleProposal ignores another exporter's action", async () => {
    const act = await proposal(1n);
    expect(await store.settleProposal("exp_other", { actionId: act.id, proposalIndex: 1n, status: "rejected" })).toBeNull();
  });

  test("findProposalAction finds the open action behind a proposal index", async () => {
    const act = await proposal(9n);
    expect((await store.findProposalAction(exporterId, 9n))?.id).toBe(act.id);
    expect(await store.findProposalAction(exporterId, 10n)).toBeNull();
  });
});

describe("dashboard and pay page extras", () => {
  test("getDashboard reports what waits in buyer accounts and the next sweep", async () => {
    await store.updateBalances(exporterId, { treasuryUsdc: 10_000_000n, vaults: { [a.id]: 2_500_000n } });
    const before = await store.getDashboard(exporterId);
    expect(before.waitingInBuyerAccountsUsdc).toBe(2_500_000n);
    expect(before.nextSweepAt).toBeUndefined();
    await store.recordSweep({ exporterId, buyerIds: [a.id], scheduledFor: new Date("2026-09-28T05:26:00Z") });
    expect((await store.getDashboard(exporterId)).nextSweepAt).toBe("2026-09-28T05:26:00.000Z");
  });

  test("getPayInvoice returns the line items, issue date, exporter logo/address and the buyer's name/address", async () => {
    await store.updateExporterProfile(exporterId, { logoUrl: "https://cdn.example/t.png", address: "Muar, Johor" });
    const b = await store.createBuyer({ ...buyerInput(exporterId, "Najd"), address: "Riyadh" });
    const inv = await store.createInvoice({ exporterId, buyerId: b.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    const pay = await store.getPayInvoice(inv.id);
    expect(pay).toMatchObject({ issuedAt: "2026-09-01", exporterLogoUrl: "https://cdn.example/t.png", exporterAddress: "Muar, Johor", buyerName: "Najd", buyerAddress: "Riyadh" });
    expect(pay?.lineItems).toEqual(item);
  });
});

describe("buyer accounts for the sweeper and permissions", () => {
  test("listBuyerAccounts exposes the stored spending-limit PDA and setBuyerSpendingLimit replaces it", async () => {
    const before = await store.listBuyerAccounts(exporterId);
    expect(before.map((x) => x.id)).toEqual([a.id, expect.any(String)]);
    expect(before[0]).toMatchObject({ id: a.id, multisig: a.multisig, usdcAta: a.usdcAta, spendingLimitPda: undefined });
    await store.setBuyerSpendingLimit(exporterId, a.id, "Limit111");
    expect((await store.listBuyerAccounts(exporterId))[0]?.spendingLimitPda).toBe("Limit111");
    await expect(store.setBuyerSpendingLimit("exp_other", a.id, "Limit222")).rejects.toThrow(/buyer not found/);
  });
});
