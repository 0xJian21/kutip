import { describe, expect, test } from "vitest";
import { deleteExporter } from "./admin";
import { ref, setup } from "./testing/fixtures";

describe("deleteExporter", () => {
  test("removes the exporter's rows but keeps wallet screenings (so a demo reset doesn't force a slow re-screen)", async () => {
    const { db, store, exporterId, a } = await setup();
    const inv = await store.createInvoice({ exporterId, buyerId: a.id, lineItems: [{ description: "x", quantity: 1, unitPriceUsdc: 1n }], issuedAt: "2026-09-01", dueDate: "2026-10-01", referencePubkey: ref(), status: "sent" });
    await store.recordScreening({ wallet: "Wallet111", invoiceId: inv.id, result: "pass", reasons: ["ok"] });
    await deleteExporter(db, exporterId);
    expect(await store.getExporter(exporterId)).toBeNull();
    expect(await store.latestScreening("Wallet111")).toMatchObject({ result: "pass", invoiceId: undefined });
  });
});
