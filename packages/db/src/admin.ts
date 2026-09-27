import { eq, inArray } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";

/** Delete one exporter and every row under it (also used to drop test exporters before a demo). */
export async function deleteExporter(db: Db, exporterId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const invoiceIds = tx.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.exporterId, exporterId));
    await tx.delete(s.payments).where(inArray(s.payments.invoiceId, invoiceIds));
    const refs = tx.select({ ref: s.invoices.referencePubkey }).from(s.invoices).where(eq(s.invoices.exporterId, exporterId));
    await tx.delete(s.quotes).where(inArray(s.quotes.referencePubkey, refs));
    await tx.delete(s.messages).where(inArray(s.messages.invoiceId, invoiceIds));
    await tx.delete(s.screenings).where(inArray(s.screenings.invoiceId, invoiceIds));
    await tx.delete(s.agentActions).where(eq(s.agentActions.exporterId, exporterId));
    await tx.delete(s.sweeps).where(eq(s.sweeps.exporterId, exporterId));
    await tx.delete(s.invoices).where(eq(s.invoices.exporterId, exporterId));
    await tx.delete(s.buyers).where(eq(s.buyers.exporterId, exporterId));
    await tx.delete(s.users).where(eq(s.users.exporterId, exporterId));
    await tx.delete(s.exporters).where(eq(s.exporters.id, exporterId));
  });
}
