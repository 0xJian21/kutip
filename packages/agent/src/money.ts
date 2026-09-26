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
