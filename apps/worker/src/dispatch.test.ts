import { SlotStatus, type SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { expect, test } from "vitest";
import { createDispatcher } from "./dispatch";
import { reviveGrpc } from "./testing/grpc";

const update = reviveGrpc("grpc-2Kr2ZYrP");
const slot = Number(update.slot);
const at = new Date("2026-09-27T04:36:57.525Z");

/** A tracker whose processed write is slow (a Supabase round trip or nine), like the live run. */
function slowTracker() {
  const calls: string[] = [];
  const pending: string[] = [];
  return {
    calls,
    tracker: {
      pending: () => [...pending],
      onTransaction: async () => {
        await new Promise((r) => setTimeout(r, 50));
        pending.push("sig");
        calls.push("processed");
      },
      onSlot: async (s: number, level: string) => void calls.push(`${level}@${s === slot ? "tx-slot" : s}`),
    },
  };
}

test("a slot status that arrives while its tx is still being written is applied, in order (live-run bug)", async () => {
  const { tracker, calls } = slowTracker();
  const d = createDispatcher({ tracker, balances: { onAccount: async () => {} }, log: () => {} });
  d.onUpdate({ filters: [], transaction: update, createdAt: at } as unknown as SubscribeUpdate, at);
  d.onUpdate({ filters: [], slot: { slot: String(slot), status: SlotStatus.SLOT_CONFIRMED } } as unknown as SubscribeUpdate, new Date(at.getTime() + 190));
  d.onUpdate({ filters: [], slot: { slot: String(slot), status: SlotStatus.SLOT_PROCESSED } } as unknown as SubscribeUpdate, new Date(at.getTime() + 200));
  d.onUpdate({ filters: [], slot: { slot: String(slot), status: SlotStatus.SLOT_FINALIZED } } as unknown as SubscribeUpdate, new Date(at.getTime() + 8_000));
  await d.idle();
  expect(calls).toEqual(["processed", "confirmed@tx-slot", "finalized@tx-slot"]);
});

test("account updates reach balances with the decoded pubkey and lamports", async () => {
  const seen: Array<[string, bigint, number]> = [];
  const { tracker } = slowTracker();
  const d = createDispatcher({ tracker, balances: { onAccount: async (p, l, data) => void seen.push([p, l, data.length]) }, log: () => {} });
  const pubkey = new Uint8Array(32).fill(0);
  d.onUpdate({ filters: [], account: { slot: "1", isStartup: false, account: { pubkey, lamports: "2039280", owner: pubkey, executable: false, rentEpoch: "0", data: new Uint8Array(165), writeVersion: "1" } } } as unknown as SubscribeUpdate, at);
  await d.idle();
  expect(seen).toEqual([["11111111111111111111111111111111", 2_039_280n, 165]]);
});

test("a failing handler is logged and later updates still run", async () => {
  const logs: string[] = [];
  const { tracker, calls } = slowTracker();
  tracker.onTransaction = async () => {
    throw new Error("db down");
  };
  const d = createDispatcher({ tracker, balances: { onAccount: async () => {} }, log: (m) => logs.push(m) });
  d.onUpdate({ filters: [], transaction: update } as unknown as SubscribeUpdate, at);
  d.onUpdate({ filters: [], slot: { slot: String(slot), status: SlotStatus.SLOT_CONFIRMED } } as unknown as SubscribeUpdate, at);
  await d.idle();
  expect(logs.join()).toContain("transaction failed: Error: db down");
  expect(calls).toEqual(["confirmed@tx-slot"]);
});
