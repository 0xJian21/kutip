/**
 * Cached balances for the treasury screens, from the same gRPC stream: USDC ATAs → updateBalances,
 * and the fee payer's SOL → an owner escalation when it runs low (DECISIONS D4 low-balance alert).
 */
import type { BalanceAccount, Store } from "@kutip/db";

/** SPL token account layout: mint (32) | owner (32) | amount (u64 LE) | … */
export function tokenAmount(data: Uint8Array): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(64, true);
}

export function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} SOL`;
}

const FEE_PAYER_ALERT = "Fee payer SOL balance";
const DAY_MS = 24 * 3_600_000;

export function createBalances(deps: { store: Store; feePayer: string; minLamports: bigint; log: (msg: string) => void }) {
  const { store, log } = deps;
  const byAta = new Map<string, BalanceAccount>();
  let armed = true;
  /** Seen a healthy balance since start: a new drop is a new incident, not a restart repeat. */
  let sawHealthy = false;

  async function alertFeePayer(lamports: bigint, at: Date): Promise<void> {
    for (const exporterId of await store.listExporterIds()) {
      const recent = await store.listAgentActions(exporterId, { limit: 50 });
      if (!sawHealthy && recent.some((a) => a.inputSummary.startsWith(FEE_PAYER_ALERT) && at.getTime() - Date.parse(a.createdAt) < DAY_MS)) continue;
      await store.recordAgentAction({
        exporterId,
        kind: "escalate",
        inputSummary: `${FEE_PAYER_ALERT}: ${formatSol(lamports)} (floor ${formatSol(deps.minLamports)})`,
        decision: "Asked the owner to top up the Kutip fee payer",
        reason: `The fee payer holds ${formatSol(lamports)}, below the ${formatSol(deps.minLamports)} floor, and buyers stop paying gas-free when it runs out`,
        confidence: 1,
        ruleId: "T4",
        status: "escalated",
        at,
      });
    }
  }

  return {
    setAccounts(accounts: BalanceAccount[]) {
      byAta.clear();
      for (const a of accounts) byAta.set(a.usdcAta, a);
    },

    accounts(): string[] {
      return [...byAta.keys(), deps.feePayer];
    },

    async onAccount(pubkey: string, lamports: bigint, data: Uint8Array, at: Date): Promise<void> {
      if (pubkey === deps.feePayer) {
        if (lamports < deps.minLamports && armed) {
          armed = false;
          log(`Fee payer low: ${formatSol(lamports)} < ${formatSol(deps.minLamports)}`);
          await alertFeePayer(lamports, at);
        } else if (lamports >= deps.minLamports) {
          armed = true;
          sawHealthy = true;
        }
        return;
      }
      const acct = byAta.get(pubkey);
      if (!acct || data.byteLength < 72) return;
      const amount = tokenAmount(data);
      await store.updateBalances(acct.exporterId, acct.buyerId ? { vaults: { [acct.buyerId]: amount } } : { treasuryUsdc: amount });
    },
  };
}

export type Balances = ReturnType<typeof createBalances>;
