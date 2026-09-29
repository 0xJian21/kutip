import "server-only";
import { planSweep, readVaults, runSweep, SWEEP_BATCH_SIZE, SweepSelectionError } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { UserError } from "@/lib/data/result";
import { agentKeypair, treasuryContext } from "./server";
import { sweepAccounts, type SweepPreview } from "./sweep-model";

/**
 * Manual "Sweep now" (IMPROVEMENTS T2 + A2). Same plan and guard as the daily sweep:
 * on-chain vault balances + spending limits → @kutip/agent treasuryMove → the agent
 * signs spendingLimitUse for whatever is inside today's cap. Exposed for the dashboard
 * hero and for Session 8c's command bar (preview → confirm → execute).
 */

/** Signature fee (2 signers) + the compute-budget price cap, per transaction. Paid by Kutip's fee payer. */
export const SWEEP_FEE_LAMPORTS_PER_TX = 2n * 5_000n + 10_000n;

export type { SweepPreview };

/** Every buyer account with what the agent could move now; the dialog lets the owner tick which ones. */
export async function previewSweep(exporterId: string): Promise<SweepPreview> {
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const [exporter, treasury, accounts, rulebook] = await Promise.all([store.getExporter(exporterId), store.getTreasury(exporterId), store.listBuyerAccounts(exporterId), store.getRulebook(exporterId)]);
  if (!exporter) throw new Error(`exporter not found: ${exporterId}`);
  const vaults = await readVaults({ connection, feePayer, usdcMint, buyers: accounts, now: new Date() });
  const plan = planSweep({ vaults, rulebook, treasuryUsdcAta: new PublicKey(exporter.treasuryUsdcAta) });
  const lastSweepAt = new Map(treasury.buyerAccounts.flatMap((a) => (a.lastSweepAt ? [[a.buyer.id, a.lastSweepAt] as const] : [])));
  return {
    accounts: sweepAccounts({
      buyers: treasury.buyerAccounts.map((a) => ({ id: a.buyer.id, name: a.buyer.name, vault: a.buyer.usdcAta })),
      vaults,
      planned: plan.items,
      skipped: plan.skipped.map((x) => ({ buyerId: x.buyerId, mode: x.mode === "proposal" ? "proposal" : "refused", reason: x.reason })),
      lastSweepAt,
    }),
    destinationVault: exporter.treasuryVault,
    treasuryMultisig: exporter.treasuryMultisig,
    dailyLimitUsdc: rulebook.treasury.agentDailyLimitUsdc,
    batchSize: SWEEP_BATCH_SIZE,
    feeLamportsPerTx: SWEEP_FEE_LAMPORTS_PER_TX,
    feePaidByKutip: true,
  };
}

export type SweepExecution = {
  sweeps: Array<{ id: string; signature: string; buyerIds: string[]; amountUsdc: bigint }>;
  totalUsdc: bigint;
  recordedAt: string;
};

/**
 * Sweeps the owner's ticked buyer accounts. The server re-reads them on-chain and re-plans
 * (T2 cap, destination = treasury): the dialog's numbers are never trusted. Signed by the agent
 * key; the on-chain spending limit is the real guard.
 */
export async function executeSweep(exporterId: string, buyerIds: string[]): Promise<SweepExecution> {
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const agent = agentKeypair();
  let result: Awaited<ReturnType<typeof runSweep>>;
  try {
    result = await runSweep({ connection, feePayer, agent, usdcMint, store, exporterId, buyerIds });
  } catch (e) {
    throw e instanceof SweepSelectionError ? new UserError(e.message) : e;
  }
  if (result.sweeps.length === 0) throw new UserError("Nothing to sweep: the ticked accounts hold no USDC inside today's cap");
  return { sweeps: result.sweeps, totalUsdc: result.sweeps.reduce((s, x) => s + x.amountUsdc, 0n), recordedAt: new Date().toISOString() };
}
