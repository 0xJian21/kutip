/**
 * Money helpers. Every stored amount is a bigint in base units.
 * USDC has 6 decimals; MYR is kept in sen (2 decimals); SOL in lamports (9).
 * No floats anywhere in here.
 */

export const USDC_DECIMALS = 6;
export const MYR_DECIMALS = 2;
export const SOL_DECIMALS = 9;

/** BNM reference rate: MYR per 1 USD, as an integer with 4 decimals. */
export const RATE_DECIMALS = 4;
export type BnmRate = {
  /** e.g. 42150n means 4.2150 MYR per USD */
  myrPerUsd: bigint;
  /** ISO date the rate was published for */
  date: string;
};

function pow10(n: number): bigint {
  let r = 1n;
  for (let i = 0; i < n; i++) r *= 10n;
  return r;
}

/** Divide with round-half-up, for non-negative numerators. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const neg = numerator < 0n;
  const n = neg ? -numerator : numerator;
  const q = (n + denominator / 2n) / denominator;
  return neg ? -q : q;
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format an integer amount with `decimals` base-unit decimals, showing
 * exactly `fraction` decimal places (rounded half-up).
 */
export function formatUnits(amount: bigint, decimals: number, fraction: number): string {
  if (fraction > decimals) throw new Error("fraction exceeds decimals");
  const neg = amount < 0n;
  const scaled = divRound(neg ? -amount : amount, pow10(decimals - fraction));
  const s = scaled.toString().padStart(fraction + 1, "0");
  const int = s.slice(0, s.length - fraction);
  const frac = s.slice(s.length - fraction);
  const body = fraction > 0 ? `${groupThousands(int)}.${frac}` : groupThousands(int);
  return neg ? `−${body}` : body;
}

/** "48,211.40" */
export function formatUsdc(amount: bigint, fraction = 2): string {
  return formatUnits(amount, USDC_DECIMALS, fraction);
}

/** All six decimals, for execution receipts: "50.000000" */
export function formatUsdcExact(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS, USDC_DECIMALS);
}

/** USDC base units × BNM rate → MYR sen (bigint, round half-up). */
export function toMyr(amountUsdc: bigint, rate: BnmRate): bigint {
  // (usdc/1e6) × (rate/1e4) = myr ; in sen: × 1e2
  // sen = usdc × rate × 1e2 / (1e6 × 1e4) = usdc × rate / 1e8
  return divRound(amountUsdc * rate.myrPerUsd, pow10(USDC_DECIMALS + RATE_DECIMALS - MYR_DECIMALS));
}

/** "RM48,211.40" (sen in, string out) */
export function formatMyr(sen: bigint, opts: { symbol?: boolean } = {}): string {
  const body = formatUnits(sen, MYR_DECIMALS, 2);
  return opts.symbol === false ? body : `RM${body}`;
}

/** "0.2831" */
export function formatSol(lamports: bigint, fraction = 4): string {
  return formatUnits(lamports, SOL_DECIMALS, fraction);
}

/** "4.2150" */
export function formatRate(rate: BnmRate): string {
  return formatUnits(rate.myrPerUsd, RATE_DECIMALS, 4);
}

/**
 * Effective rate of a swap: how many MYR each USDC actually cost the buyer's
 * counter-asset, expressed relative to the BNM rate in basis points.
 * Positive = better than reference. Kept integer (bps).
 */
export function bpsDiff(actualOut: bigint, quotedOut: bigint): bigint {
  if (quotedOut === 0n) return 0n;
  return divRound((actualOut - quotedOut) * 10_000n, quotedOut);
}

/** "+0.12%" / "−0.05%" from basis points */
export function formatBps(bps: bigint): string {
  const neg = bps < 0n;
  const abs = neg ? -bps : bps;
  const s = abs.toString().padStart(3, "0");
  const body = `${s.slice(0, -2)}.${s.slice(-2)}%`;
  return neg ? `−${body}` : `+${body}`;
}

/** Parse "48211.40" style user input into USDC base units. Rejects floats. */
export function parseUsdc(input: string): bigint | null {
  const m = /^\s*(\d{1,12})(?:\.(\d{1,6}))?\s*$/.exec(input.replace(/,/g, ""));
  if (!m) return null;
  const int = m[1] ?? "0";
  const frac = (m[2] ?? "").padEnd(USDC_DECIMALS, "0");
  return BigInt(int) * pow10(USDC_DECIMALS) + BigInt(frac);
}
