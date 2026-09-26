/**
 * Seeded DB vs Session 2's mock data layer: every screen's query must return
 * the same thing, so the real app looks identical to the mock demo.
 * Timestamps are compared as instants ("…:02Z" vs "…:02.000Z").
 */
import { beforeAll, describe, expect, test } from "vitest";
import { mockData } from "@/lib/mock";
import { APP_ORIGIN, EXPORTER, INVOICES } from "@/lib/mock/fixtures";
import { createStore, type Store } from "../src/store";
import { testDb } from "../src/testing/pglite";
import { resetDemo, seedDemo } from "./demo";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function norm(v: unknown): unknown {
  if (typeof v === "string" && ISO.test(v)) return new Date(v).toISOString();
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, norm(x)]));
  }
  return v;
}

const NOW = new Date("2026-09-27T04:00:00Z");
const E = EXPORTER.id;
let store: Store;

beforeAll(async () => {
  const db = await testDb();
  await seedDemo(db);
  store = createStore(db, { appUrl: APP_ORIGIN });
});

describe("seeded DB matches the mock data layer", () => {
  test("getExporter", async () => {
    expect(norm(await store.getExporter(E))).toEqual(norm(await mockData.getExporter()));
  });

  test("getDashboard", async () => {
    expect(norm(await store.getDashboard(E, { now: NOW }))).toEqual(norm(await mockData.getDashboard()));
  });

  test("listBuyers", async () => {
    expect(norm(await store.listBuyers(E))).toEqual(norm(await mockData.listBuyers()));
  });

  test.each([
    {},
    { status: "open" as const },
    { status: "needs_attention" as const },
    { status: "overdue" as const },
    { status: "settled" as const },
    { buyerId: "b_harbourline" },
    { query: "meridian" },
    { query: "0142" },
  ])("listInvoices %o", async (filter) => {
    expect(norm(await store.listInvoices(E, filter))).toEqual(norm(await mockData.listInvoices(filter)));
  });

  test("getInvoice for every invoice", async () => {
    for (const inv of INVOICES) {
      expect(norm(await store.getInvoice(E, inv.id)), inv.id).toEqual(norm(await mockData.getInvoice(inv.id)));
    }
  }, 30_000);

  test("getPayInvoice for every non-draft invoice; drafts are not public", async () => {
    for (const inv of INVOICES) {
      const db = await store.getPayInvoice(inv.id);
      if (inv.status === "draft") expect(db, inv.id).toBeNull();
      else expect(norm(db), inv.id).toEqual(norm(await mockData.getPayInvoice(inv.id)));
    }
  }, 30_000);

  test("listAgentActions", async () => {
    expect(norm(await store.listAgentActions(E))).toEqual(norm(await mockData.listAgentActions()));
  });

  test("getRulebook", async () => {
    expect(await store.getRulebook(E)).toEqual(await mockData.getRulebook());
  });

  test("getTreasury", async () => {
    expect(norm(await store.getTreasury(E))).toEqual(norm(await mockData.getTreasury()));
  });
});

test("seedDemo is skip-if-already-done", async () => {
  const db = await testDb();
  expect(await seedDemo(db)).toBe("seeded");
  expect(await seedDemo(db)).toBe("skipped");
});

test("resetDemo removes only the demo exporter's rows, then it seeds again", async () => {
  const db = await testDb();
  const s = createStore(db, { appUrl: APP_ORIGIN });
  const other = await s.createExporter({ name: "Other", treasuryMultisig: "m", treasuryVault: "v", treasuryUsdcAta: "a", rulebook: EXPORTER.rulebook });
  await seedDemo(db);
  await s.recordPayment({ invoiceId: "inv_demo", signature: "rehearsal", payer: "p", amount: 50_000_000n, commitment: "confirmed", slot: 1, verified: true, issues: [], via: "solana_pay" });
  await resetDemo(db);
  expect(await s.getExporter(E)).toBeNull();
  expect(await s.getExporter(other.id)).not.toBeNull();
  expect(await seedDemo(db)).toBe("seeded");
  expect((await s.getInvoice(E, "inv_demo"))?.invoice.status).toBe("sent");
});
