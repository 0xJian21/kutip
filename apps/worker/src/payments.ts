/**
 * Payment tracking (SPEC F6): a tx that touches an open invoice's reference key is verified and
 * recorded at processed ("Seen"), then advanced to confirmed ("Paid") and finalized ("Settled")
 * as slot-status updates for its slot arrive on the same gRPC stream. Missed updates (reconnects,
 * restarts) are caught up from RPC: `reconcile` for tracked txs, `backfill` for watched references.
 */
import type { Commitment, Store } from "@kutip/db";
import { isPubkey } from "./stream";
import { fromRpc, verifyPayment, type RpcTransaction, type TxView, type Verification } from "./verify";

type SignatureStatus = { slot: number; confirmationStatus: Commitment | null; err: unknown } | null;

export type TrackerRpc = {
  getSignatureStatuses(signatures: string[]): Promise<SignatureStatus[]>;
  getSignaturesForAddress(address: string): Promise<Array<{ signature: string; slot: number; err: unknown; confirmationStatus: Commitment | null }>>;
  getTransaction(signature: string): Promise<RpcTransaction | null>;
};

export type PaidInvoice = { invoiceId: string; exporterId: string; buyerId: string };

type Tracked = PaidInvoice & {
  slot: number;
  level: Commitment;
  seenAt: Date;
  lastAt: Date;
  v: Verification;
};

const RANK: Record<Commitment, number> = { processed: 0, confirmed: 1, finalized: 2 };
const LABEL: Record<Commitment, string> = { processed: "Seen", confirmed: "Paid", finalized: "Settled" };
/** Txs whose status hasn't moved for this long are checked over RPC. */
const STALE_MS = 20_000;

export function createPaymentTracker(deps: {
  store: Store;
  rpc: TrackerRpc;
  usdcMint: string;
  log: (msg: string) => void;
  /** An invoice just became paid (confirmed, verified, full amount). */
  onPaid?: (paid: PaidInvoice) => Promise<void>;
}) {
  const { store, rpc, log } = deps;
  const refs = new Map<string, string>(); // reference pubkey → invoice id
  const tracked = new Map<string, Tracked>(); // signature → state

  async function record(sig: string, t: Tracked, level: Commitment, at: Date): Promise<void> {
    const { invoice } = await store.recordPayment({
      invoiceId: t.invoiceId,
      signature: sig,
      payer: t.v.payer,
      amount: t.v.amount,
      inputMint: t.v.inputMint,
      inputAmount: t.v.inputAmount,
      quotedInput: t.v.quotedInput,
      quotedOut: t.v.quotedOut,
      commitment: level,
      slot: t.slot,
      verified: t.v.verified,
      issues: t.v.issues,
      via: "solana_pay",
      at,
    });
    const wasPaid = RANK[t.level] >= 1 && t.v.verified;
    t.level = level;
    t.lastAt = at;
    const since = level === "processed" ? "" : ` +${at.getTime() - t.seenAt.getTime()} ms`;
    const flags = t.v.verified ? "" : " UNVERIFIED";
    log(`${LABEL[level].padEnd(7)} ${t.invoiceId} ${sig.slice(0, 8)}… slot ${t.slot}${since} → invoice ${invoice.status}${flags}${t.v.issues.length ? ` (${t.v.issues.join("; ")})` : ""}`);
    if (level === "finalized") tracked.delete(sig);
    if (!wasPaid && RANK[level] >= 1 && (invoice.status === "paid" || invoice.status === "settled")) await deps.onPaid?.({ invoiceId: t.invoiceId, exporterId: t.exporterId, buyerId: t.buyerId });
  }

  /** Verify a tx against the invoice whose reference it carries. Null when it carries none we watch. */
  async function start(tx: TxView, at: Date): Promise<[string, Tracked] | null> {
    const ref = tx.accountKeys.find((k) => refs.has(k));
    if (!ref) return null;
    // One round trip for all three: every ms here delays "Seen" on the owner's screen.
    const [target, sol, usdt] = await Promise.all([store.getPaymentTarget(ref), store.latestQuote(ref, "SOL"), store.latestQuote(ref, "USDT")]);
    if (!target) return null;
    const quote = sol ?? usdt;
    const v = verifyPayment(tx, target, { usdcMint: deps.usdcMint, quote });
    return [tx.signature, { invoiceId: target.invoiceId, exporterId: target.exporterId, buyerId: target.buyerId, slot: tx.slot, level: "processed", seenAt: at, lastAt: at, v }];
  }

  return {
    setReferences(list: Array<{ invoiceId: string; referencePubkey: string }>) {
      refs.clear();
      for (const r of list) refs.set(r.referencePubkey, r.invoiceId);
    },

    /** A processed tx from the stream. */
    async onTransaction(tx: TxView, at: Date): Promise<void> {
      const known = tracked.get(tx.signature);
      if (known) {
        known.slot = tx.slot; // re-landed in another slot after a fork
        return;
      }
      const started = await start(tx, at);
      if (!started) return;
      const [sig, t] = started;
      tracked.set(sig, t);
      await record(sig, t, "processed", at);
    },

    async onSlot(slot: number, status: "confirmed" | "finalized" | "dead", at: Date): Promise<void> {
      for (const [sig, t] of tracked) {
        if (t.slot !== slot) continue;
        if (status === "dead") {
          tracked.delete(sig);
          log(`Dropped ${t.invoiceId} ${sig.slice(0, 8)}… slot ${slot} died; waiting for it to land again`);
        } else if (RANK[status] > RANK[t.level]) {
          await record(sig, t, status, at);
        }
      }
    },

    /** Ask RPC about txs whose status hasn't moved in a while. */
    async reconcile(now: Date): Promise<void> {
      const stale = [...tracked].filter(([, t]) => now.getTime() - t.lastAt.getTime() >= STALE_MS);
      if (stale.length === 0) return;
      const statuses = await rpc.getSignatureStatuses(stale.map(([sig]) => sig));
      for (const [i, [sig, t]] of stale.entries()) {
        const st = statuses[i];
        if (st?.err) {
          tracked.delete(sig);
          log(`Failed  ${t.invoiceId} ${sig.slice(0, 8)}… ${JSON.stringify(st.err)}`);
        } else if (st?.confirmationStatus && RANK[st.confirmationStatus] > RANK[t.level]) {
          t.slot = st.slot;
          await record(sig, t, st.confirmationStatus, now);
        }
      }
    },

    /** After a (re)connect: record anything paid to a watched reference while we weren't listening. */
    async backfill(now: Date): Promise<void> {
      for (const ref of [...refs.keys()].filter(isPubkey)) {
        for (const s of await rpc.getSignaturesForAddress(ref)) {
          if (s.err || !s.confirmationStatus || tracked.has(s.signature)) continue;
          const raw = await rpc.getTransaction(s.signature);
          if (!raw) continue;
          const started = await start(fromRpc(raw), now);
          if (!started) continue;
          const [sig, t] = started;
          tracked.set(sig, t);
          await record(sig, t, s.confirmationStatus, now);
        }
      }
    },

    /** Signatures still waiting for finality. */
    pending(): string[] {
      return [...tracked.keys()];
    },
  };
}

export type PaymentTracker = ReturnType<typeof createPaymentTracker>;
