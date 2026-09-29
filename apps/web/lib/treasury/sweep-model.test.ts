import { describe, expect, test } from "vitest";
import { defaultSelection, summariseSelection, sweepAccounts, type SweepAccount, type SweepPreview } from "./sweep-model";

const account = (buyerId: string, over: Partial<SweepAccount> = {}): SweepAccount => ({
  buyerId,
  buyerName: `Buyer ${buyerId}`,
  vault: `vault-${buyerId}`,
  balanceUsdc: 1_000_000n,
  sweepableUsdc: 1_000_000n,
  state: "ready",
  note: "Within today's cap",
  ...over,
});

const preview = (accounts: SweepAccount[]): SweepPreview => ({
  accounts,
  destinationVault: "treasury-vault",
  treasuryMultisig: "treasury-ms",
  dailyLimitUsdc: 5_000_000_000n,
  batchSize: 3,
  feeLamportsPerTx: 20_000n,
  feePaidByKutip: true,
});

describe("defaultSelection", () => {
  test("ticks every account that can move now, and nothing that can't", () => {
    const p = preview([account("a"), account("b", { state: "empty", balanceUsdc: 0n, sweepableUsdc: 0n }), account("c", { state: "capped", sweepableUsdc: 0n }), account("d")]);
    expect(defaultSelection(p)).toEqual(["a", "d"]);
  });
});

describe("summariseSelection", () => {
  test("total, transactions and fee follow the ticked accounts only", () => {
    const p = preview([account("a", { sweepableUsdc: 700_000n }), account("b", { sweepableUsdc: 250_000n }), account("c"), account("d"), account("e")]);
    const one = summariseSelection(p, ["b"]);
    expect(one).toMatchObject({ buyerIds: ["b"], totalUsdc: 250_000n, transactions: 1, networkFeeLamports: 20_000n });
    const four = summariseSelection(p, ["a", "b", "c", "d"]);
    expect(four).toMatchObject({ totalUsdc: 2_950_000n, transactions: 2, networkFeeLamports: 40_000n });
    expect(four.rule).toEqual({ id: "T2", ok: true, reason: "USD 2.95 is within the agent's daily cap of USD 5,000.00 per buyer account and goes only to your treasury" });
  });

  test("ignores ids that are not selectable (empty, capped, unknown)", () => {
    const p = preview([account("a"), account("b", { state: "empty", balanceUsdc: 0n, sweepableUsdc: 0n }), account("c", { state: "capped", sweepableUsdc: 0n })]);
    expect(summariseSelection(p, ["a", "b", "c", "zz"]).buyerIds).toEqual(["a"]);
  });

  test("what stays behind because of the cap is counted for the ticked accounts", () => {
    const p = preview([account("a", { balanceUsdc: 6_000_000_000n, sweepableUsdc: 5_000_000_000n }), account("b", { balanceUsdc: 9_000_000n, sweepableUsdc: 2_000_000n })]);
    expect(summariseSelection(p, ["a"]).heldByCapUsdc).toBe(1_000_000_000n);
    expect(summariseSelection(p, ["a", "b"]).heldByCapUsdc).toBe(1_007_000_000n);
  });

  test("nothing ticked: no transactions, and the rule says why the button is off", () => {
    const s = summariseSelection(preview([account("a")]), []);
    expect(s).toMatchObject({ totalUsdc: 0n, transactions: 0, networkFeeLamports: 0n });
    expect(s.rule).toEqual({ id: "T2", ok: false, reason: "Tick at least one buyer account to sweep" });
  });
});

describe("sweepAccounts", () => {
  const buyers = [
    { id: "a", name: "Harbourline", vault: "ata-a" },
    { id: "b", name: "Meridian", vault: "ata-b" },
    { id: "c", name: "Najd", vault: "ata-c" },
    { id: "d", name: "Oslo", vault: "ata-d" },
    { id: "e", name: "Seeded", vault: "ata-e" },
    { id: "f", name: "Partial", vault: "ata-f" },
  ];
  const vaults = [
    { buyerId: "a", balanceUsdc: 700_000n, remainingTodayUsdc: 5_000_000_000n },
    { buyerId: "b", balanceUsdc: 0n, remainingTodayUsdc: 5_000_000_000n },
    { buyerId: "c", balanceUsdc: 2_000_000n, remainingTodayUsdc: 0n },
    { buyerId: "d", balanceUsdc: 3_000_000n, remainingTodayUsdc: 5_000_000_000n },
    { buyerId: "f", balanceUsdc: 9_000_000n, remainingTodayUsdc: 4_000_000n },
  ];
  const planned = [
    { buyerId: "a", amountUsdc: 700_000n },
    { buyerId: "f", amountUsdc: 4_000_000n },
  ];
  const skipped = [
    { buyerId: "b", mode: "refused" as const, reason: "Nothing to sweep" },
    { buyerId: "c", mode: "refused" as const, reason: "Daily cap used" },
    { buyerId: "d", mode: "proposal" as const, reason: "Needs the owner's approval (T4)" },
  ];

  test("one row per buyer account, in buyer order, with a state the dialog can act on", () => {
    const rows = sweepAccounts({ buyers, vaults, planned, skipped, lastSweepAt: new Map([["a", "2026-09-28T02:00:00.000Z"]]) });
    expect(rows.map((r) => [r.buyerId, r.state, r.balanceUsdc, r.sweepableUsdc])).toEqual([
      ["a", "ready", 700_000n, 700_000n],
      ["b", "empty", 0n, 0n],
      ["c", "capped", 2_000_000n, 0n],
      ["d", "approval", 3_000_000n, 0n],
      ["e", "not_on_chain", 0n, 0n],
      ["f", "ready", 9_000_000n, 4_000_000n],
    ]);
    expect(rows[0]).toMatchObject({ buyerName: "Harbourline", vault: "ata-a", lastSweepAt: "2026-09-28T02:00:00.000Z", note: "Within today's cap" });
    expect(rows[3]!.note).toBe("Needs the owner's approval (T4)");
    expect(rows[5]!.note).toBe("USD 5.00 stays until the daily cap resets");
  });
});
