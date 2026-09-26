/** C3 discount, T2–T4 treasury movement, T5 cash-out alert. Integers only. */
import type { Rulebook } from "../rulebook";
import type { Decision } from "./decision";

const pct = (bps: bigint) => `${bps / 100n}${bps % 100n ? `.${String(bps % 100n).padStart(2, "0").replace(/0$/, "")}` : ""}%`;

/** Literal percentage from the buyer's own words ("5%", "2.5 percent") → basis points. Up to 2 decimals. */
export function parseDiscountBps(text: string): bigint | null {
  const m = /(\d{1,2})(?:\.(\d+))?\s*(?:%|percent)/i.exec(text);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > 2) return null;
  return BigInt(m[1]!) * 100n + BigInt(frac.padEnd(2, "0") || "0");
}

export function discountGuard(requestedBps: bigint | null, rulebook: Rulebook): Decision {
  const capBps = BigInt(Math.round(rulebook.collections.maxDiscountPctWithoutApproval * 100));
  if (requestedBps === null) return { allowed: false, ruleId: "C3", reason: "The discount size is unclear, so the owner decides" };
  if (requestedBps > capBps) {
    return { allowed: false, ruleId: "C3", reason: `A ${pct(requestedBps)} discount is above the ${pct(capBps)} the rulebook lets the agent offer` };
  }
  return { allowed: true, ruleId: "C3", reason: `A ${pct(requestedBps)} discount is within the ${pct(capBps)} the agent may offer` };
}

export type SweepInput = {
  amountUsdc: bigint;
  destination: string; // token account the sweep pays into
  treasuryUsdcAta: string;
  sweptTodayUsdc: bigint; // already moved from this buyer vault today
  rulebook: Rulebook;
};

/** Off-chain mirror of the on-chain spending limit: destination is the treasury, amount within today's cap. */
export function sweepGuard(s: SweepInput): Decision {
  if (s.destination !== s.treasuryUsdcAta) return { allowed: false, ruleId: "T3", reason: "Sweeps may only go to the main treasury" };
  if (s.amountUsdc <= 0n) return { allowed: false, ruleId: "T3", reason: "Nothing to sweep" };
  const limit = s.rulebook.treasury.agentDailyLimitUsdc;
  if (s.sweptTodayUsdc + s.amountUsdc > limit) {
    return { allowed: false, ruleId: "T3", reason: "This would take today's sweeps from this buyer account past the agent's daily limit" };
  }
  return { allowed: true, ruleId: "T3", reason: "Within the agent's daily limit and going to the main treasury" };
}

export type TreasuryMove =
  | { kind: "sweep"; sweep: SweepInput }
  | { kind: "swap" | "yield" | "cash_out" | "transfer"; rulebook: Rulebook };

export type MoveDecision = Decision & { mode: "autonomous" | "proposal" | "refused" };

/**
 * Only a guarded daily sweep runs on the agent's own authority (the Squads spending limit).
 * Everything else is a proposal: the agent key can only Initiate, so the owner signs regardless of
 * `otherMovementsNeedApproval`.
 */
export function treasuryMove(move: TreasuryMove): MoveDecision {
  if (move.kind !== "sweep") {
    return { mode: "proposal", allowed: true, ruleId: "T4", reason: "Any movement other than the daily sweep needs the owner's approval" };
  }
  const s = move.sweep;
  const guard = sweepGuard(s);
  if (!guard.allowed) {
    const overLimitOnly = s.destination === s.treasuryUsdcAta && s.amountUsdc > 0n;
    return overLimitOnly
      ? { mode: "proposal", allowed: true, ruleId: "T4", reason: `${guard.reason}; moving it needs the owner's approval` }
      : { ...guard, mode: "refused" };
  }
  if (!s.rulebook.treasury.sweepDaily) {
    return { mode: "proposal", allowed: true, ruleId: "T4", reason: "Daily sweeping is off, so each sweep needs the owner's approval" };
  }
  return { mode: "autonomous", allowed: true, ruleId: "T2", reason: "Daily sweep within the on-chain spending limit" };
}

/** Rates are MYR per USD with 4 implied decimals (BnmRate.myrPerUsd). */
export function cashOutAlert(r: { myrPerUsd: bigint; avg30dMyrPerUsd: bigint; rulebook: Rulebook }): Decision {
  const aboveBps = ((r.myrPerUsd - r.avg30dMyrPerUsd) * 10_000n) / r.avg30dMyrPerUsd;
  const margin = r.rulebook.treasury.cashOutAlertMarginBps;
  if (aboveBps >= margin) {
    return { allowed: true, ruleId: "T5", reason: `Today's rate is ${pct(aboveBps)} above the 30-day average, beating the ${pct(margin)} margin` };
  }
  return { allowed: false, ruleId: "T5", reason: `Today's rate is not ${pct(margin)} above the 30-day average` };
}
