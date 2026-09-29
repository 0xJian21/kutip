import { beforeEach, describe, expect, test } from "vitest";
import type { Store } from "./store";
import { buyerInput, ref, RULEBOOK, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

let store: Store;
let exporterId: string;
let a: Buyer;

const item = [{ description: "Chair", quantity: 1, unitPriceUsdc: 1_000_000n }];

beforeEach(async () => {
  ({ store, exporterId, a } = await setup());
});

describe("invoice recipient (0007)", () => {
  test("createInvoice keeps where the email went and the owner's CC; getInvoice returns them", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent", sendTo: "ap@harbourline.example", sendCc: "owner@teratai.example" });
    expect(inv).toMatchObject({ sendTo: "ap@harbourline.example", sendCc: "owner@teratai.example" });
    expect((await store.getInvoice(exporterId, inv.id))!.invoice).toMatchObject({ sendTo: "ap@harbourline.example", sendCc: "owner@teratai.example" });
  });

  test("without them the invoice has neither field (older rows)", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    expect(inv.sendTo).toBeUndefined();
    expect(inv.sendCc).toBeUndefined();
  });

  test("the outbound message records who it was for and what happened", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    await store.recordMessage({ invoiceId: inv.id, direction: "out", from: "T", subject: "s", body: "b", toAddress: "ap@harbourline.example", delivery: "skipped" });
    const [m] = (await store.getInvoice(exporterId, inv.id))!.messages;
    expect(m).toMatchObject({ toAddress: "ap@harbourline.example", delivery: "skipped" });
  });

  test("the pay page never sees the recipient", async () => {
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent", sendTo: "ap@harbourline.example" });
    expect(JSON.stringify(await store.getPayInvoice(inv.id), (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain("harbourline.example");
  });
});

describe("setBuyerEmail", () => {
  test("updates this exporter's buyer only", async () => {
    await store.setBuyerEmail(exporterId, a.id, "ap@harbourline.example");
    expect((await store.listBuyers(exporterId)).find((b) => b.id === a.id)!.email).toBe("ap@harbourline.example");
    const other = await store.createExporter({ name: "Other Co", treasuryMultisig: "m2", treasuryVault: "v2", treasuryUsdcAta: "a2", rulebook: RULEBOOK });
    const theirs = await store.createBuyer(buyerInput(other.id, "Theirs"));
    await expect(store.setBuyerEmail(exporterId, theirs.id, "x@y.example")).rejects.toThrow(/buyer not found/);
  });
});

describe("getLetterhead", () => {
  test("the exporter's profile, owner name and latest rate for the formal emails", async () => {
    await store.createUser({ exporterId, name: "Farid Zulkifli", role: "owner" });
    const h = await store.getLetterhead(exporterId);
    expect(h).toMatchObject({ name: "Teratai Woodworks Sdn. Bhd.", ownerName: "Farid Zulkifli", rate: { myrPerUsd: 42150n, date: "2026-09-26" } });
    await expect(store.getLetterhead("exp_nobody")).rejects.toThrow(/exporter not found/);
  });
});
