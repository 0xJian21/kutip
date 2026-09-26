/**
 * In-memory guards for the tx-request endpoint (DECISIONS D4): one live tx per
 * invoice, simple rate limits, and the payment-mode choice. Process-local by
 * design; serverless instances each keep their own, which is fine for a cap.
 */
import type { PaymentMode } from "./buildPaymentTx";

export class LiveTxCache<T = string> {
  private readonly entries = new Map<string, { buyer: string; value: T; at: number }>();
  constructor(private readonly opts: { ttlMs: number }) {}

  get(invoiceId: string, buyer: string, now = Date.now()): T | undefined {
    const e = this.entries.get(invoiceId);
    if (!e || e.buyer !== buyer || now - e.at > this.opts.ttlMs) return undefined;
    return e.value;
  }

  set(invoiceId: string, buyer: string, value: T, now = Date.now()): void {
    this.entries.set(invoiceId, { buyer, value, at: now });
  }
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly opts: { limit: number; windowMs: number }) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.opts.windowMs);
    if (recent.length >= this.opts.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export type Token = "USDC" | "SOL" | "USDT";

/**
 * Explicit `token` (from the pay link) wins; otherwise USDC when the buyer holds
 * enough, else the first accepted swap token. Returns a wallet-facing error string.
 */
export function chooseMode(p: { token?: string; accepted: readonly Token[]; solEnabled: boolean; usdcBalance: bigint; amount: bigint }): { mode: PaymentMode } | { error: string } {
  const swapsOn = (t: Token) => p.accepted.includes(t) && p.solEnabled;
  if (p.token !== undefined) {
    const t = p.token.toUpperCase();
    if (t === "USDC" && p.accepted.includes("USDC")) return { mode: "usdc" };
    if ((t === "SOL" || t === "USDT") && p.accepted.includes(t)) {
      return p.solEnabled ? { mode: t === "SOL" ? "sol" : "usdt" } : { error: `${t} payments are temporarily unavailable; please pay in USDC` };
    }
    return { error: `This invoice accepts ${p.accepted.join(", ")}` };
  }
  if (p.usdcBalance >= p.amount) return { mode: "usdc" };
  if (swapsOn("SOL")) return { mode: "sol" };
  if (swapsOn("USDT")) return { mode: "usdt" };
  return { mode: "usdc" };
}
