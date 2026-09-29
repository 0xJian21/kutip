import { beforeEach, describe, expect, test } from "vitest";
import { createStore, type Store } from "./store";
import type { Db } from "./client";
import { APP_URL, buyerInput, ref, RULEBOOK, setup } from "./testing/fixtures";
import type { Buyer } from "./types";

let db: Db;
let store: Store;
let exporterId: string;
let a: Buyer;
let b: Buyer;

const item = [{ description: "Chair", quantity: 1, unitPriceUsdc: 1_000_000n }];

beforeEach(async () => {
  ({ db, store, exporterId, a, b } = await setup());
});

const invoiceFor = (buyer: Buyer, exporter = exporterId) =>
  store.createInvoice({ exporterId: exporter, buyerId: buyer.id, lineItems: item, issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });

describe("listSentMessages", () => {
  test("every buyer's sent outbound messages in one call, oldest first; inbound excluded; other exporters never", async () => {
    const ia = await invoiceFor(a);
    const ib = await invoiceFor(b);
    await store.recordMessage({ invoiceId: ib.id, direction: "out", from: "T", subject: "s", body: "b", at: new Date("2026-09-20T02:00:00Z") });
    await store.recordMessage({ invoiceId: ia.id, direction: "out", from: "T", subject: "s", body: "b", at: new Date("2026-09-10T02:00:00Z") });
    await store.recordMessage({ invoiceId: ia.id, direction: "in", from: "Buyer", subject: "re", body: "b", at: new Date("2026-09-11T02:00:00Z") });

    const other = await store.createExporter({ name: "Other Co", treasuryMultisig: "m2", treasuryVault: "v2", treasuryUsdcAta: "a2", rulebook: RULEBOOK });
    const theirs = await store.createBuyer(buyerInput(other.id, "Theirs"));
    const it = await invoiceFor(theirs, other.id);
    await store.recordMessage({ invoiceId: it.id, direction: "out", from: "O", subject: "s", body: "b" });

    expect(await store.listSentMessages(exporterId)).toEqual([
      { buyerId: a.id, invoiceId: ia.id, at: "2026-09-10T02:00:00.000Z" },
      { buyerId: b.id, invoiceId: ib.id, at: "2026-09-20T02:00:00.000Z" },
    ]);
  });

  test("matches what getBuyerContext reports as sent (drafts are not sent)", async () => {
    const ia = await invoiceFor(a);
    await store.recordMessage({ invoiceId: ia.id, direction: "out", from: "T", subject: "s", body: "b", at: new Date("2026-09-10T02:00:00Z") });
    const ctx = await store.getBuyerContext(exporterId, a.id);
    const fromContext = ctx!.messages.filter((m) => m.direction === "out").map((m) => ({ buyerId: a.id, invoiceId: m.invoiceId, at: m.createdAt }));
    expect(await store.listSentMessages(exporterId)).toEqual(fromContext);
  });
});

describe("rate cache (rateTtlMs)", () => {
  test("off by default: a new rate shows at once", async () => {
    await store.recordRate({ date: "2026-09-27", myrPerUsd: 42200n, avg30dMyrPerUsd: 41950n });
    expect((await store.getDashboard(exporterId)).rate).toEqual({ myrPerUsd: 42200n, date: "2026-09-27" });
  });

  test("with a TTL the rate is read once, kept as bigint, and refreshed after the TTL", async () => {
    let now = 1_000_000;
    const cached = createStore(db, { appUrl: APP_URL, rateTtlMs: 60_000, clock: () => now });
    expect((await cached.getDashboard(exporterId)).rate).toEqual({ myrPerUsd: 42150n, date: "2026-09-26" });
    await store.recordRate({ date: "2026-09-27", myrPerUsd: 42200n, avg30dMyrPerUsd: 41950n });
    now += 59_000;
    expect((await cached.getTreasury(exporterId)).rate).toEqual({ myrPerUsd: 42150n, date: "2026-09-26" });
    now += 2_000;
    const t = await cached.getTreasury(exporterId);
    expect(t.rate).toEqual({ myrPerUsd: 42200n, date: "2026-09-27" });
    expect(t.cashOut.thirtyDayAvg.myrPerUsd).toBe(41950n);
  });
});
