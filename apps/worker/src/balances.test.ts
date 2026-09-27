import { setup } from "@kutip/db/src/testing/fixtures";
import type { Buyer, Store } from "@kutip/db";
import { beforeEach, describe, expect, test } from "vitest";
import { createBalances, formatSol, tokenAmount } from "./balances";

/** An SPL token account: mint(32) owner(32) amount(u64 LE) … */
function tokenAccount(amount: bigint): Uint8Array {
  const data = new Uint8Array(165);
  new DataView(data.buffer).setBigUint64(64, amount, true);
  return data;
}

test("tokenAmount reads the u64 at offset 64", () => {
  expect(tokenAmount(tokenAccount(1_200_000n))).toBe(1_200_000n);
  expect(tokenAmount(tokenAccount(2n ** 64n - 1n))).toBe(2n ** 64n - 1n);
});

test("formatSol shows lamports as SOL without floats", () => {
  expect(formatSol(26_500_000n)).toBe("0.0265 SOL");
  expect(formatSol(1_000_000_000n)).toBe("1 SOL");
});

describe("balance updates", () => {
  let store: Store;
  let exporterId: string;
  let a: Buyer;
  let logs: string[];
  const FEE_PAYER = "FeePayer1111";

  beforeEach(async () => {
    ({ store, exporterId, a } = await setup());
    logs = [];
  });

  async function balances() {
    const b = createBalances({ store, feePayer: FEE_PAYER, minLamports: 10_000_000n, log: (m) => logs.push(m) });
    b.setAccounts((await store.listWatchedAccounts()).balances);
    return b;
  }

  test("vault and treasury ATA updates are cached on the owner's rows", async () => {
    const b = await balances();
    const e = (await store.getExporter(exporterId))!;
    await b.onAccount(a.usdcAta, 2_039_280n, tokenAccount(1_200_000n), new Date());
    await b.onAccount(e.treasuryUsdcAta, 2_039_280n, tokenAccount(500_000n), new Date());
    await b.onAccount("Unknown", 1n, tokenAccount(9n), new Date());
    const t = await store.getTreasury(exporterId);
    expect(t.mainBalanceUsdc).toBe(500_000n);
    expect(t.buyerAccounts.find((x) => x.buyer.id === a.id)?.balanceUsdc).toBe(1_200_000n);
  });

  test("fee payer below the floor → one escalation per drop, re-armed once topped up", async () => {
    const b = await balances();
    await b.onAccount(FEE_PAYER, 26_500_000n, new Uint8Array(), new Date());
    expect(await store.listAgentActions(exporterId)).toEqual([]);

    await b.onAccount(FEE_PAYER, 9_000_000n, new Uint8Array(), new Date());
    await b.onAccount(FEE_PAYER, 8_000_000n, new Uint8Array(), new Date());
    let actions = await store.listAgentActions(exporterId);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "escalate", status: "escalated", ruleId: "T4", confidence: 1 });
    expect(actions[0]!.reason).toContain("0.009 SOL");

    await b.onAccount(FEE_PAYER, 50_000_000n, new Uint8Array(), new Date());
    await b.onAccount(FEE_PAYER, 5_000_000n, new Uint8Array(), new Date());
    actions = await store.listAgentActions(exporterId);
    expect(actions).toHaveLength(2);
  });

  test("a restart below the floor doesn't repeat a same-day alert", async () => {
    await (await balances()).onAccount(FEE_PAYER, 9_000_000n, new Uint8Array(), new Date());
    await (await balances()).onAccount(FEE_PAYER, 9_000_000n, new Uint8Array(), new Date());
    expect(await store.listAgentActions(exporterId)).toHaveLength(1);
  });
});
