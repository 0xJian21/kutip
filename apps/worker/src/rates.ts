/**
 * BNM USD/MYR reference rate (Open API, noon session, MYR per USD) and its 30-day average → recordRate,
 * then the cash-out alert rule (T5) per exporter. Rates are bigint with 4 implied decimals (40775n = 4.0775).
 */
import { cashOutAlert } from "@kutip/agent";
import type { Store } from "@kutip/db";

const BNM = "https://api.bnm.gov.my/public/exchange-rate/USD";
const QUERY = "session=1200&quote=rm";
type BnmRow = { date: string; buying_rate: number; selling_rate: number; middle_rate: number | null };

/**
 * JSON numbers → 4-decimal integer via their shortest decimal text (4.0774999999999997 prints as "4.0775"),
 * rounded half-up at the 5th decimal. No float arithmetic.
 */
export function parseRate(n: number): bigint {
  const [whole, frac = ""] = String(n).split(".");
  const digits = (frac + "00000").slice(0, 5);
  return BigInt(whole!) * 10_000n + BigInt(digits.slice(0, 4)) + (Number(digits[4]) >= 5 ? 1n : 0n);
}

const middle = (r: BnmRow) => (r.middle_rate != null ? parseRate(r.middle_rate) : (parseRate(r.buying_rate) + parseRate(r.selling_rate)) / 2n);

function daysBefore(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - days);
  return t.toISOString().slice(0, 10);
}

/** Mean of the published rates in the 30 calendar days ending on `date`, rounded half-up. */
export function average30d(rates: Array<{ date: string; myrPerUsd: bigint }>, date: string): bigint {
  const from = daysBefore(date, 30);
  const window = rates.filter((r) => r.date > from && r.date <= date);
  if (window.length === 0) throw new Error(`no BNM rates in the 30 days to ${date}`);
  const n = BigInt(window.length);
  return (window.reduce((s, r) => s + r.myrPerUsd, 0n) * 2n + n) / (2n * n);
}

async function bnm<T>(fetchFn: typeof fetch, path: string): Promise<T> {
  const res = await fetchFn(`${BNM}${path}?${QUERY}`, { headers: { accept: "application/vnd.BNM.API.v1+json" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`BNM ${path || "/"}: HTTP ${res.status}`);
  return ((await res.json()) as { data: { rate: T } }).data.rate;
}

export async function fetchBnmRate(fetchFn: typeof fetch = fetch): Promise<{ date: string; myrPerUsd: bigint; avg30dMyrPerUsd: bigint }> {
  const latest = await bnm<BnmRow>(fetchFn, "");
  const [y, m] = latest.date.split("-").map(Number) as [number, number];
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
  const months = await Promise.all([bnm<BnmRow[]>(fetchFn, `/year/${prev[0]}/month/${prev[1]}`), bnm<BnmRow[]>(fetchFn, `/year/${y}/month/${m}`)]);
  const rates = months.flat().map((r) => ({ date: r.date, myrPerUsd: middle(r) }));
  return { date: latest.date, myrPerUsd: middle(latest), avg30dMyrPerUsd: average30d(rates, latest.date) };
}

const fmt = (r: bigint) => `${r / 10_000n}.${(r % 10_000n).toString().padStart(4, "0")}`;
const pct = (bps: bigint) => `${bps / 100n}.${(bps % 100n).toString().padStart(2, "0")}%`;

export async function updateRate(deps: { store: Store; fetchFn?: typeof fetch; log: (msg: string) => void; now: Date }): Promise<void> {
  const { store, log } = deps;
  try {
    const r = await fetchBnmRate(deps.fetchFn);
    await store.recordRate(r);
    log(`BNM USD/MYR ${fmt(r.myrPerUsd)} (${r.date}), 30-day average ${fmt(r.avg30dMyrPerUsd)}`);
    const summary = `BNM USD/MYR ${fmt(r.myrPerUsd)} vs 30-day average ${fmt(r.avg30dMyrPerUsd)} (${r.date})`;
    for (const exporterId of await store.listExporterIds()) {
      const d = cashOutAlert({ ...r, rulebook: await store.getRulebook(exporterId) });
      if (!d.allowed) continue;
      if ((await store.listAgentActions(exporterId, { limit: 100 })).some((a) => a.kind === "cash_out_alert" && a.inputSummary === summary)) continue;
      const aboveBps = ((r.myrPerUsd - r.avg30dMyrPerUsd) * 10_000n) / r.avg30dMyrPerUsd;
      await store.recordAgentAction({
        exporterId, kind: "cash_out_alert", status: "executed", confidence: 1, ruleId: d.ruleId, at: deps.now,
        inputSummary: summary,
        decision: `Told the owner today's rate is ${pct(aboveBps)} above the 30-day average`,
        reason: d.reason,
      });
      log(`Cash-out alert for ${exporterId}: ${d.reason}`);
    }
  } catch (e) {
    log(`BNM rate update failed: ${(e as Error).message}`);
  }
}
