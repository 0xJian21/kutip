import { createStore, type Store } from "../store";
import type { Db } from "../client";
import type { Buyer, Rulebook } from "../types";
import { testDb } from "./pglite";

export const RULEBOOK: Rulebook = {
  collections: {
    firstReminderDaysBeforeDue: 3,
    maxMessagesPer48h: 1,
    quietHoursStart: 18,
    quietHoursEnd: 9,
    maxDiscountPctWithoutApproval: 2,
    escalateAfterOverdueReminders: 2,
    escalateOnDispute: true,
  },
  treasury: {
    acceptedTokens: ["USDC", "SOL"],
    sweepDaily: true,
    sweepRandomised: true,
    agentDailyLimitUsdc: 5_000_000_000n,
    otherMovementsNeedApproval: true,
    cashOutAlertMarginBps: 50n,
  },
};

export const APP_URL = "https://kutip.test";

let n = 0;
const key = (label: string) => `${label}_${++n}`.padEnd(32, "x");

export function buyerInput(exporterId: string, name: string) {
  return {
    exporterId,
    name,
    contactName: `${name} contact`,
    email: `${name.toLowerCase().replace(/\W/g, "")}@example.test`,
    country: "AU",
    countryName: "Australia",
    city: "Sydney",
    timezone: "Australia/Sydney",
    multisig: key(`${name}-ms`),
    vault: key(`${name}-vault`),
    usdcAta: key(`${name}-ata`),
  };
}

/** One exporter, two buyers, a rate. */
export async function setup(): Promise<{ db: Db; store: Store; exporterId: string; a: Buyer; b: Buyer }> {
  const db = await testDb();
  const store = createStore(db, { appUrl: APP_URL });
  const exporter = await store.createExporter({
    name: "Teratai Woodworks Sdn. Bhd.",
    treasuryMultisig: key("t-ms"),
    treasuryVault: key("t-vault"),
    treasuryUsdcAta: key("t-ata"),
    rulebook: RULEBOOK,
  });
  const a = await store.createBuyer(buyerInput(exporter.id, "Harbourline"));
  const b = await store.createBuyer(buyerInput(exporter.id, "Meridian"));
  await store.recordRate({ date: "2026-09-26", myrPerUsd: 42150n, avg30dMyrPerUsd: 41930n });
  return { db, store, exporterId: exporter.id, a, b };
}

export const ref = () => key("ref");
