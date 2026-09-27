/**
 * Stream updates → tracker / balances, handled strictly one at a time in arrival order, so a tx's
 * processed write has landed before its slot's confirmed/finalized status is applied.
 */
import { SlotStatus, type SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";
import type { Balances } from "./balances";
import type { PaymentTracker } from "./payments";
import { fromGrpc } from "./verify";

const SLOT: Partial<Record<SlotStatus, "confirmed" | "finalized" | "dead">> = {
  [SlotStatus.SLOT_CONFIRMED]: "confirmed",
  [SlotStatus.SLOT_FINALIZED]: "finalized",
  [SlotStatus.SLOT_DEAD]: "dead",
};

export function createDispatcher(deps: {
  tracker: Pick<PaymentTracker, "onTransaction" | "onSlot" | "pending">;
  balances: Pick<Balances, "onAccount">;
  log: (msg: string) => void;
  /** Called for each tx the tracker picked up (e.g. record it as a fixture). */
  onTracked?: (u: NonNullable<SubscribeUpdate["transaction"]>) => void;
}) {
  const { tracker, balances, log } = deps;
  let chain = Promise.resolve();
  const enqueue = (label: string, fn: () => Promise<void>) => {
    chain = chain.then(fn).catch((e: Error) => log(`${label} failed: ${e.stack ?? e.message}`));
  };

  return {
    enqueue,
    onUpdate(u: SubscribeUpdate, at: Date) {
      const tx = u.transaction;
      if (tx?.transaction) {
        const lag = u.createdAt ? ` geyser→worker ${at.getTime() - u.createdAt.getTime()} ms` : "";
        enqueue("transaction", async () => {
          const view = fromGrpc(tx.slot, tx.transaction!);
          const before = tracker.pending().length;
          await tracker.onTransaction(view, at);
          if (tracker.pending().length <= before) return;
          log(`        ${view.signature.slice(0, 8)}… processed at slot ${view.slot},${lag}`);
          deps.onTracked?.(tx);
        });
      } else if (u.slot) {
        // Always queued: whether the slot matters is only known once earlier tx writes have landed
        // (live run: "confirmed" arrived while the processed write was still in flight and was dropped).
        const level = SLOT[u.slot.status];
        if (level) enqueue("slot", () => tracker.onSlot(Number(u.slot!.slot), level, at));
      } else if (u.account?.account) {
        const a = u.account.account;
        enqueue("account", () => balances.onAccount(bs58.encode(a.pubkey), BigInt(a.lamports), a.data, at));
      }
    },
    /** Resolves once everything queued so far has run. */
    idle: () => chain,
  };
}
