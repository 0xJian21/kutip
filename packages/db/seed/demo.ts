/**
 * Loads Session 2's mock fixtures (apps/web/lib/mock/fixtures.ts) into the DB
 * with their ids and timestamps, so the real app renders exactly the mock demo.
 * All data is fictional; addresses are base58-shaped strings, not real accounts.
 */
import { eq } from "drizzle-orm";
import {
  AGENT_ACTIONS,
  BUYERS,
  BUYER_VAULT_BALANCES,
  EXPORTER,
  INVOICES,
  MESSAGES,
  PAYMENTS,
  RATE,
  RATE_30D_AVG,
  SWEEPS,
  TREASURY_MAIN_BALANCE,
  WHITELISTED_CASH_OUT,
} from "@/lib/mock/fixtures";
import { deleteExporter } from "../src/admin";
import type { Db } from "../src/client";
import { rulebookToJson } from "../src/map";
import * as s from "../src/schema";

const date = (iso: string | undefined) => (iso ? new Date(iso) : null);

export async function seedDemo(db: Db): Promise<"seeded" | "skipped"> {
  const [existing] = await db.select({ id: s.exporters.id }).from(s.exporters).where(eq(s.exporters.id, EXPORTER.id));
  if (existing) return "skipped";

  await db.transaction(async (tx) => {
    await tx
      .insert(s.fxRates)
      .values({ date: RATE.date, myrPerUsd: RATE.myrPerUsd, avg30dMyrPerUsd: RATE_30D_AVG.myrPerUsd })
      .onConflictDoNothing();

    await tx.insert(s.exporters).values({
      id: EXPORTER.id,
      name: EXPORTER.name,
      registrationNo: EXPORTER.registrationNo,
      city: EXPORTER.city,
      treasuryMultisig: EXPORTER.treasuryMultisig,
      treasuryVault: EXPORTER.treasuryVault,
      treasuryUsdcAta: EXPORTER.treasuryUsdcAta,
      treasuryUsdcBalance: TREASURY_MAIN_BALANCE,
      rulebook: rulebookToJson(EXPORTER.rulebook),
      cashOutWhitelist: WHITELISTED_CASH_OUT,
    });

    await tx.insert(s.users).values([
      { id: "usr_owner", exporterId: EXPORTER.id, name: EXPORTER.ownerName, role: "owner" },
      { id: "usr_admin", exporterId: EXPORTER.id, name: EXPORTER.adminName, role: "admin" },
    ]);

    // Distinct created_at keeps the fixture order for buyer lists.
    const base = Date.parse("2026-07-01T00:00:00Z");
    await tx.insert(s.buyers).values(
      BUYERS.map((b, i) => ({
        ...b,
        exporterId: EXPORTER.id,
        vaultUsdcBalance: BUYER_VAULT_BALANCES[b.id] ?? 0n,
        createdAt: new Date(base + i * 1000),
      })),
    );

    await tx.insert(s.invoices).values(
      INVOICES.map((i) => ({
        id: i.id,
        exporterId: EXPORTER.id,
        buyerId: i.buyerId,
        number: i.number,
        lineItems: i.lineItems.map((li) => ({ ...li, unitPriceUsdc: li.unitPriceUsdc.toString() })),
        amountUsdc: i.amountUsdc,
        receivedUsdc: i.receivedUsdc,
        issuedAt: i.issuedAt,
        dueDate: i.dueDate,
        status: i.status,
        referencePubkey: i.referencePubkey,
        memoCode: i.memoCode,
        createdAt: new Date(i.createdAt),
        sentAt: date(i.sentAt),
        seenAt: date(i.seenAt),
        paidAt: date(i.paidAt),
        settledAt: date(i.settledAt),
      })),
    );

    await tx.insert(s.payments).values(
      PAYMENTS.map((p) => ({
        id: p.id,
        invoiceId: p.invoiceId,
        signature: p.signature,
        payer: p.payer,
        mint: p.mint,
        amount: p.amount,
        inputMint: p.inputMint ?? null,
        inputAmount: p.inputAmount ?? null,
        quotedInput: p.quotedInput ?? null,
        quotedOut: p.quotedOut ?? null,
        commitment: p.commitment,
        slot: p.slot,
        verified: p.verified,
        issues: p.issues,
        via: p.via,
        observedAt: new Date(p.observedAt),
        confirmedAt: date(p.confirmedAt),
        finalizedAt: date(p.finalizedAt),
      })),
    );

    await tx.insert(s.messages).values(
      MESSAGES.map((m) => ({ ...m, classification: m.classification ?? null, createdAt: new Date(m.createdAt) })),
    );

    await tx.insert(s.agentActions).values(
      AGENT_ACTIONS.map((a) => ({
        ...a,
        exporterId: EXPORTER.id,
        buyerId: a.buyerId ?? null,
        invoiceId: a.invoiceId ?? null,
        txSignature: a.txSignature ?? null,
        createdAt: new Date(a.createdAt),
      })),
    );

    await tx.insert(s.sweeps).values(
      SWEEPS.map((w) => ({
        id: w.id,
        exporterId: EXPORTER.id,
        buyerIds: w.buyerIds,
        amountUsdc: w.amountUsdc,
        signature: w.signature ?? null,
        scheduledFor: new Date(w.scheduledFor),
        executedAt: date(w.executedAt),
      })),
    );
  });
  return "seeded";
}

/** Delete the demo exporter and everything under it (rehearsals leave paid invoices behind). */
export async function resetDemo(db: Db): Promise<void> {
  await deleteExporter(db, EXPORTER.id);
}
