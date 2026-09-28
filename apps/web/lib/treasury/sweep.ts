import "server-only";
import { formatUsdc } from "@kutip/agent";
import { planSweep, readVaults, runSweep, type SweepPlan } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { UserError } from "@/lib/data/result";
import { agentKeypair, treasuryContext } from "./server";

/**
 * Manual "Sweep now" (IMPROVEMENTS T2 + A2). Same plan and guard as the daily sweep:
 * on-chain vault balances + spending limits → @kutip/agent treasuryMove → the agent
 * signs spendingLimitUse for whatever is inside today's cap. Exposed for the dashboard
 * hero and for Session 8c's command bar (preview → confirm → execute).
 */

/** Signature fee (2 signers) + the compute-budget price cap, per transaction. Paid by Kutip's fee payer. */
export const SWEEP_FEE_LAMPORTS_PER_TX = 2n * 5_000n + 10_000n;

export type SweepPreview = {
  items: Array<{ buyerId: string; buyerName: string; vault: string; balanceUsdc: bigint; amountUsdc: bigint; ruleId: string; reason: string }>;
  skipped: Array<{ buyerId: string; buyerName: string; mode: "proposal" | "refused"; reason: string }>;
  /** Buyer accounts the chain does not know yet (seeded placeholders). */
  unprovisioned: string[];
  totalUsdc: bigint;
  /** What stays behind because today's cap is used up; it moves after the limit resets. */
  heldByCapUsdc: bigint;
  destinationVault: string;
  treasuryMultisig: string;
  transactions: number;
  networkFeeLamports: bigint;
  feePaidByKutip: true;
  dailyLimitUsdc: bigint;
  rule: { id: "T2"; ok: boolean; reason: string };
  /** sweep = the agent can run it now; nothing = no funds waiting. */
  mode: "sweep" | "nothing";
};

function describe(plan: SweepPlan, opts: { names: Map<string, string>; balances: Map<string, bigint> }): Pick<SweepPreview, "items" | "skipped" | "totalUsdc" | "heldByCapUsdc"> {
  const items = plan.items.map((i) => ({
    buyerId: i.buyerId,
    buyerName: opts.names.get(i.buyerId) ?? i.buyerId,
    vault: i.vaultAta.toBase58(),
    balanceUsdc: i.balanceUsdc,
    amountUsdc: i.amountUsdc,
    ruleId: i.ruleId,
    reason: i.reason,
  }));
  const skipped = plan.skipped
    .filter((s) => (opts.balances.get(s.buyerId) ?? 0n) > 0n)
    .map((s) => ({ buyerId: s.buyerId, buyerName: opts.names.get(s.buyerId) ?? s.buyerId, mode: s.mode === "proposal" ? ("proposal" as const) : ("refused" as const), reason: s.reason }));
  const totalUsdc = items.reduce((sum, i) => sum + i.amountUsdc, 0n);
  const heldByCapUsdc = [...opts.balances.entries()].reduce((sum, [id, bal]) => sum + (bal - (items.find((i) => i.buyerId === id)?.amountUsdc ?? 0n)), 0n);
  return { items, skipped, totalUsdc, heldByCapUsdc };
}

export async function previewSweep(exporterId: string): Promise<SweepPreview> {
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const [exporter, buyers, accounts, rulebook] = await Promise.all([store.getExporter(exporterId), store.listBuyers(exporterId), store.listBuyerAccounts(exporterId), store.getRulebook(exporterId)]);
  if (!exporter) throw new Error(`exporter not found: ${exporterId}`);
  const vaults = await readVaults({ connection, feePayer, usdcMint, buyers: accounts, now: new Date() });
  const plan = planSweep({ vaults, rulebook, treasuryUsdcAta: new PublicKey(exporter.treasuryUsdcAta) });
  const names = new Map(buyers.map((b) => [b.id, b.name]));
  const balances = new Map(vaults.map((v) => [v.buyerId, v.balanceUsdc]));
  const seen = new Set(vaults.map((v) => v.buyerId));
  const d = describe(plan, { names, balances });
  const waiting = [...balances.values()].reduce((s, v) => s + v, 0n);
  return {
    ...d,
    unprovisioned: accounts.filter((a) => !seen.has(a.id)).map((a) => names.get(a.id) ?? a.id),
    destinationVault: exporter.treasuryVault,
    treasuryMultisig: exporter.treasuryMultisig,
    transactions: plan.batches.length,
    networkFeeLamports: BigInt(plan.batches.length) * SWEEP_FEE_LAMPORTS_PER_TX,
    feePaidByKutip: true,
    dailyLimitUsdc: rulebook.treasury.agentDailyLimitUsdc,
    rule:
      d.totalUsdc > 0n
        ? { id: "T2", ok: true, reason: `USD ${formatUsdc(d.totalUsdc)} is within the agent's daily cap of USD ${formatUsdc(rulebook.treasury.agentDailyLimitUsdc)} per buyer account and goes only to your treasury` }
        : waiting > 0n
          ? { id: "T2", ok: false, reason: d.skipped[0]?.reason ?? "Today's cap for these accounts is used up; the rest moves when the limit resets" }
          : { id: "T2", ok: true, reason: "No buyer account holds USDC right now" },
    mode: d.totalUsdc > 0n ? "sweep" : "nothing",
  };
}

export type SweepExecution = {
  sweeps: Array<{ id: string; signature: string; buyerIds: string[]; amountUsdc: bigint }>;
  totalUsdc: bigint;
  recordedAt: string;
};

/** Runs the sweep the preview described. Signed by the agent key; the on-chain spending limit is the real guard. */
export async function executeSweep(exporterId: string): Promise<SweepExecution> {
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const agent = agentKeypair();
  const result = await runSweep({ connection, feePayer, agent, usdcMint, store, exporterId });
  if (result.sweeps.length === 0) throw new UserError("Nothing to sweep: no buyer account holds USDC inside today's cap");
  return { sweeps: result.sweeps, totalUsdc: result.sweeps.reduce((s, x) => s + x.amountUsdc, 0n), recordedAt: new Date().toISOString() };
}
