/**
 * "Sweep now" shapes shared by the server preview and the dialog (client-safe: no Solana imports).
 * The dialog uses `summariseSelection` for the live total and fee; the server re-plans the
 * ticked accounts on execute (T2 cap, destination = treasury), so these numbers are a preview only.
 */
import { formatUsdc } from "../ui/money";

/**
 * ready = moves now (inside today's cap). empty = holds nothing. capped = today's cap is used up.
 * approval / refused = the rules engine would not let the agent move it. not_on_chain = no multisig yet.
 */
export type SweepAccountState = "ready" | "empty" | "capped" | "approval" | "refused" | "not_on_chain";

export type SweepAccount = {
  buyerId: string;
  buyerName: string;
  /** The buyer account's USDC address. */
  vault: string;
  balanceUsdc: bigint;
  /** What the agent can move now: the balance, cut to what is left of today's cap. */
  sweepableUsdc: bigint;
  state: SweepAccountState;
  /** One line for the row: why it can or cannot move. */
  note: string;
  lastSweepAt?: string;
};

export type SweepPreview = {
  accounts: SweepAccount[];
  destinationVault: string;
  treasuryMultisig: string;
  /** Per buyer account per day (rule T2). */
  dailyLimitUsdc: bigint;
  /** Buyer accounts per transaction, and the network fee per transaction (Kutip pays it). */
  batchSize: number;
  feeLamportsPerTx: bigint;
  feePaidByKutip: true;
};

export type SweepSelection = {
  buyerIds: string[];
  totalUsdc: bigint;
  /** Balance of the ticked accounts that stays behind until the cap resets. */
  heldByCapUsdc: bigint;
  transactions: number;
  networkFeeLamports: bigint;
  rule: { id: "T2"; ok: boolean; reason: string };
};

export const selectable = (a: SweepAccount) => a.state === "ready" && a.sweepableUsdc > 0n;

export function defaultSelection(p: SweepPreview): string[] {
  return p.accounts.filter(selectable).map((a) => a.buyerId);
}

export function summariseSelection(p: SweepPreview, ids: Iterable<string>): SweepSelection {
  const wanted = new Set(ids);
  const picked = p.accounts.filter((a) => wanted.has(a.buyerId) && selectable(a));
  const totalUsdc = picked.reduce((s, a) => s + a.sweepableUsdc, 0n);
  const transactions = Math.ceil(picked.length / p.batchSize);
  return {
    buyerIds: picked.map((a) => a.buyerId),
    totalUsdc,
    heldByCapUsdc: picked.reduce((s, a) => s + (a.balanceUsdc - a.sweepableUsdc), 0n),
    transactions,
    networkFeeLamports: BigInt(transactions) * p.feeLamportsPerTx,
    rule:
      picked.length === 0
        ? { id: "T2", ok: false, reason: "Tick at least one buyer account to sweep" }
        : { id: "T2", ok: true, reason: `USD ${formatUsdc(totalUsdc)} is within the agent's daily cap of USD ${formatUsdc(p.dailyLimitUsdc)} per buyer account and goes only to your treasury` },
  };
}

/**
 * Rows for the dialog from the sweep plan: every buyer account of the exporter, including the
 * ones that cannot move (so the owner sees why). `vaults` are only the accounts found on-chain.
 */
export function sweepAccounts(p: {
  buyers: Array<{ id: string; name: string; vault: string }>;
  vaults: Array<{ buyerId: string; balanceUsdc: bigint; remainingTodayUsdc: bigint }>;
  planned: Array<{ buyerId: string; amountUsdc: bigint }>;
  skipped: Array<{ buyerId: string; mode: "proposal" | "refused"; reason: string }>;
  lastSweepAt: Map<string, string>;
}): SweepAccount[] {
  return p.buyers.map((b) => {
    const base = { buyerId: b.id, buyerName: b.name, vault: b.vault, ...(p.lastSweepAt.has(b.id) ? { lastSweepAt: p.lastSweepAt.get(b.id)! } : {}) };
    const v = p.vaults.find((x) => x.buyerId === b.id);
    if (!v) return { ...base, balanceUsdc: 0n, sweepableUsdc: 0n, state: "not_on_chain", note: "Not on Solana yet" };
    const row = { ...base, balanceUsdc: v.balanceUsdc };
    if (v.balanceUsdc === 0n) return { ...row, sweepableUsdc: 0n, state: "empty", note: "Nothing waiting" };
    const plan = p.planned.find((x) => x.buyerId === b.id);
    if (plan) {
      const held = v.balanceUsdc - plan.amountUsdc;
      return { ...row, sweepableUsdc: plan.amountUsdc, state: "ready", note: held > 0n ? `USD ${formatUsdc(held)} stays until the daily cap resets` : "Within today's cap" };
    }
    if (v.remainingTodayUsdc === 0n) return { ...row, sweepableUsdc: 0n, state: "capped", note: "Today's cap is used up; it moves after the limit resets" };
    const skip = p.skipped.find((x) => x.buyerId === b.id);
    return { ...row, sweepableUsdc: 0n, state: skip?.mode === "proposal" ? "approval" : "refused", note: skip?.reason ?? "The agent can't move this one" };
  });
}
