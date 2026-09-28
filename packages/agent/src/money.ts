/** USDC amounts are bigint base units (6 decimals). Text ↔ units happens here, never in a model. */
const DECIMALS = 6;
const UNIT = 10n ** BigInt(DECIMALS);

/** "USD 33,750.00", "$50", "8760.00 USD" → base units. Throws on anything ambiguous. */
export function parseUsdc(text: string): bigint {
  const s = text.trim().replace(/^(USD|US\$|\$)\s*/i, "").replace(/\s*(USD|USDC)$/i, "");
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`Not a USD amount: "${text}"`);
  const frac = m[2] ?? "";
  if (frac.length > DECIMALS) throw new Error(`More than ${DECIMALS} decimals: "${text}"`);
  return BigInt(m[1]!.replaceAll(",", "")) * UNIT + BigInt(frac.padEnd(DECIMALS, "0"));
}

/** Base units → "USD 8,760.00" (cents unless there is sub-cent precision). */
export function formatUsdc(units: bigint): string {
  const whole = (units / UNIT).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let frac = (units % UNIT).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `USD ${whole}.${frac}`;
}

/**
 * What the owner typed in the command bar ("RM 10k", "USD 500", "250 USDC") → integer units:
 * MYR in sen, USD in USDC base units. Null for anything unclear; the model never does this.
 */
export function parseMoneyText(text: string): { currency: "MYR" | "USD"; units: bigint } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  const m = /^(rm|myr|usd|us\$|\$)?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s?([km])?\s?(ringgit|myr|usd|usdc|dollars?)?$/.exec(t);
  if (!m) return null;
  const [, pre, whole, frac = "", mult, post] = m;
  const cur = pre === "rm" || pre === "myr" || post === "ringgit" || post === "myr" ? "MYR" : pre || post ? "USD" : null;
  if (!cur || (pre && post && (cur === "MYR") !== (post === "ringgit" || post === "myr"))) return null;
  const decimals = cur === "MYR" ? 2 : DECIMALS;
  const scale = mult === "k" ? 3 : mult === "m" ? 6 : 0;
  if (frac.length > decimals + scale) return null;
  const digits = BigInt(whole!.replaceAll(",", "") + frac.padEnd(decimals + scale, "0"));
  return digits > 0n ? { currency: cur, units: digits } : null;
}

/** MYR sen → USDC base units at a BNM rate with 4 implied decimals, rounded down. */
export function myrSenToUsdc(sen: bigint, myrPerUsd: bigint): bigint {
  return (sen * 10n ** 8n) / myrPerUsd;
}

/** USDC base units → MYR sen at a BNM rate with 4 implied decimals, rounded down. */
export function usdcToMyrSen(usdc: bigint, myrPerUsd: bigint): bigint {
  return (usdc * myrPerUsd) / 10n ** 8n;
}
