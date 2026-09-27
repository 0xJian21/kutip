/**
 * Daily sweep (SPEC F7, L3): buyer vaults → main treasury via the agent's
 * spending limit, several buyers per transaction so amounts don't map to
 * invoices. `@kutip/agent` treasuryMove decides; the on-chain limit enforces.
 */
import { treasuryMove, type MoveDecision, type Rulebook } from "@kutip/agent";
import type { createStore } from "@kutip/db";
import { TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { SWEEP_BATCH_SIZE, USDC_DECIMALS, VAULT_INDEX, toSdkAmount } from "./config";
import { limitCreateKeyFor, spendingLimitPdaFor } from "./provision";
import { sendV0 } from "./rpc";

export type VaultState = {
  buyerId: string;
  multisigPda: PublicKey;
  vaultAta: PublicKey;
  spendingLimitPda: PublicKey;
  balanceUsdc: bigint;
  /** From the on-chain SpendingLimit, after the program's lazy period reset. */
  remainingTodayUsdc: bigint;
  sweptTodayUsdc: bigint;
};

export type SweepItem = VaultState & { amountUsdc: bigint; ruleId: string; reason: string };
export type SweepSkip = { buyerId: string; mode: MoveDecision["mode"]; ruleId?: string; reason: string };
export type SweepPlan = { items: SweepItem[]; skipped: SweepSkip[]; batches: SweepItem[][] };

const min = (a: bigint, b: bigint) => (a < b ? a : b);

export function planSweep(p: { vaults: VaultState[]; rulebook: Rulebook; treasuryUsdcAta: PublicKey }): SweepPlan {
  const items: SweepItem[] = [];
  const skipped: SweepSkip[] = [];
  const treasuryUsdcAta = p.treasuryUsdcAta.toBase58();
  for (const v of p.vaults) {
    const amountUsdc = min(v.balanceUsdc, v.remainingTodayUsdc);
    const d = treasuryMove({
      kind: "sweep",
      sweep: { amountUsdc, destination: treasuryUsdcAta, treasuryUsdcAta, sweptTodayUsdc: v.sweptTodayUsdc, rulebook: p.rulebook },
    });
    if (d.mode === "autonomous") items.push({ ...v, amountUsdc, ruleId: d.ruleId, reason: d.reason });
    else skipped.push({ buyerId: v.buyerId, mode: d.mode, ...(d.mode === "proposal" ? { ruleId: d.ruleId } : {}), reason: d.reason });
  }
  const batches: SweepItem[][] = [];
  for (let i = 0; i < items.length; i += SWEEP_BATCH_SIZE) batches.push(items.slice(i, i + SWEEP_BATCH_SIZE));
  return { items, skipped, batches };
}

const PERIOD_SECONDS: Record<number, bigint> = {
  [multisig.types.Period.OneTime]: 0n,
  [multisig.types.Period.Day]: 86_400n,
  [multisig.types.Period.Week]: 7n * 86_400n,
  [multisig.types.Period.Month]: 30n * 86_400n,
};

/** Mirrors spending_limit_use.rs: remaining resets to `amount` once `period` has passed since `lastReset`. */
export function sweptToday(
  limit: { amount: bigint; remainingAmount: bigint; lastReset: bigint; period: multisig.types.Period },
  nowUnix: bigint,
): { sweptTodayUsdc: bigint; remainingTodayUsdc: bigint } {
  const period = PERIOD_SECONDS[limit.period] ?? 0n;
  const reset = period > 0n && nowUnix - limit.lastReset >= period;
  const remainingTodayUsdc = reset ? limit.amount : limit.remainingAmount;
  return { sweptTodayUsdc: limit.amount - remainingTodayUsdc, remainingTodayUsdc };
}

export function sweepInstructions(p: { items: SweepItem[]; agent: PublicKey; usdcMint: PublicKey; treasuryVaultPda: PublicKey }): TransactionInstruction[] {
  return p.items.map((it) =>
    multisig.instructions.spendingLimitUse({
      multisigPda: it.multisigPda,
      member: p.agent,
      spendingLimit: it.spendingLimitPda,
      mint: p.usdcMint,
      vaultIndex: VAULT_INDEX,
      amount: toSdkAmount(it.amountUsdc, "sweep amount"),
      decimals: USDC_DECIMALS,
      destination: p.treasuryVaultPda, // destination OWNER; the SDK derives its USDC ATA
      tokenProgram: TOKEN_PROGRAM_ID,
    }),
  );
}

/** A uniformly random moment in the 24h after `after` (never `after` itself). */
export function randomSweepTime(after: Date, rand: () => number = Math.random): Date {
  const minMs = 60_000;
  return new Date(after.getTime() + minMs + Math.floor(rand() * (24 * 3600_000 - minMs)));
}

// ---------------------------------------------------------------------------
// Runner. The worker (Session 4) schedules `runSweep` at `randomSweepTime(...)`.
// ---------------------------------------------------------------------------

type Store = ReturnType<typeof createStore>;
export type SweepStore = Pick<Store, "getExporter" | "listBuyers" | "getRulebook" | "recordSweep" | "updateBalances" | "recordAgentAction">;

export type SweepDeps = {
  connection: Connection;
  feePayer: Keypair;
  agent: Keypair;
  usdcMint: PublicKey;
  store: SweepStore;
  exporterId: string;
  now?: Date;
  /** Called with the plan before any write; throw to abort (scripts prompt here). */
  confirm?: (lines: string[]) => Promise<void>;
};

export type SweepResult = {
  plan: SweepPlan;
  sweeps: Array<{ id: string; signature: string; buyerIds: string[]; amountUsdc: bigint }>;
};

/** Reads on-chain vault balances + spending limits for every provisioned buyer. */
export async function readVaults(p: { connection: Connection; feePayer: Keypair; usdcMint: PublicKey; buyers: Array<{ id: string; multisig: string; usdcAta: string }>; now: Date }): Promise<VaultState[]> {
  const out: VaultState[] = [];
  const nowUnix = BigInt(Math.floor(p.now.getTime() / 1000));
  for (const b of p.buyers) {
    let multisigPda: PublicKey;
    try {
      multisigPda = new PublicKey(b.multisig);
    } catch {
      continue; // seeded placeholder, not provisioned
    }
    const spendingLimitPda = spendingLimitPdaFor(multisigPda, limitCreateKeyFor(p.feePayer.secretKey, multisigPda).publicKey);
    const limitInfo = await p.connection.getAccountInfo(spendingLimitPda);
    if (!limitInfo) continue;
    const [limit] = multisig.accounts.SpendingLimit.fromAccountInfo(limitInfo);
    const vaultAta = new PublicKey(b.usdcAta);
    let balanceUsdc = 0n;
    try {
      balanceUsdc = (await getAccount(p.connection, vaultAta)).amount;
    } catch {
      /* no ATA yet → nothing to sweep */
    }
    const today = sweptToday(
      { amount: BigInt(limit.amount.toString()), remainingAmount: BigInt(limit.remainingAmount.toString()), lastReset: BigInt(limit.lastReset.toString()), period: limit.period },
      nowUnix,
    );
    out.push({ buyerId: b.id, multisigPda, vaultAta, spendingLimitPda, balanceUsdc, ...today });
  }
  return out;
}

export async function runSweep(d: SweepDeps): Promise<SweepResult> {
  const now = d.now ?? new Date();
  const exporter = await d.store.getExporter(d.exporterId);
  if (!exporter) throw new Error(`exporter not found: ${d.exporterId}`);
  const [buyers, rulebook] = await Promise.all([d.store.listBuyers(d.exporterId), d.store.getRulebook(d.exporterId)]);
  const vaults = await readVaults({ connection: d.connection, feePayer: d.feePayer, usdcMint: d.usdcMint, buyers, now });
  const treasuryVaultPda = new PublicKey(exporter.treasuryVault);
  const plan = planSweep({ vaults, rulebook, treasuryUsdcAta: new PublicKey(exporter.treasuryUsdcAta) });

  if (d.confirm) {
    await d.confirm([
      `sweep for ${exporter.name}: ${plan.items.length} vault(s) in ${plan.batches.length} tx(s) → treasury vault ${treasuryVaultPda.toBase58()}`,
      ...plan.items.map((i) => `  ${i.buyerId}: ${i.amountUsdc} base units from ${i.vaultAta.toBase58()} (limit ${i.spendingLimitPda.toBase58()})`),
      ...plan.skipped.map((s) => `  skip ${s.buyerId}: ${s.mode} — ${s.reason}`),
      `  signer AGENT ${d.agent.publicKey.toBase58()}, fee payer ${d.feePayer.publicKey.toBase58()}`,
    ]);
  }

  const sweeps: SweepResult["sweeps"] = [];
  for (const batch of plan.batches) {
    const buyerIds = batch.map((i) => i.buyerId);
    const amountUsdc = batch.reduce((s, i) => s + i.amountUsdc, 0n);
    const scheduled = await d.store.recordSweep({ exporterId: d.exporterId, buyerIds, amountUsdc, scheduledFor: now });
    const signature = await sendV0(d.connection, d.feePayer, sweepInstructions({ items: batch, agent: d.agent.publicKey, usdcMint: d.usdcMint, treasuryVaultPda }), [d.agent]);
    await d.store.recordSweep({ id: scheduled.id, exporterId: d.exporterId, buyerIds, amountUsdc, scheduledFor: now, signature, executedAt: new Date() });
    await d.store.recordAgentAction({
      exporterId: d.exporterId,
      kind: "sweep",
      inputSummary: `${buyerIds.length} buyer vault(s) with USDC waiting`,
      decision: `Swept ${buyerIds.length} buyer account(s) into the treasury in one transaction`,
      reason: batch[0]!.reason,
      confidence: 1,
      ruleId: batch[0]!.ruleId,
      status: "executed",
      txSignature: signature,
    });
    sweeps.push({ id: scheduled.id, signature, buyerIds, amountUsdc });
  }

  // Refresh cached balances (treasury + every vault we looked at).
  const vaultBalances: Record<string, bigint> = {};
  for (const v of vaults) {
    const swept = plan.items.find((i) => i.buyerId === v.buyerId)?.amountUsdc ?? 0n;
    vaultBalances[v.buyerId] = v.balanceUsdc - swept;
  }
  let treasuryUsdc: bigint | undefined;
  try {
    treasuryUsdc = (await getAccount(d.connection, new PublicKey(exporter.treasuryUsdcAta))).amount;
  } catch {
    /* keep the cached value */
  }
  await d.store.updateBalances(d.exporterId, { treasuryUsdc, vaults: vaultBalances });
  return { plan, sweeps };
}
