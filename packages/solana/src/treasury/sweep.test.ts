import { DEFAULT_RULEBOOK } from "@kutip/agent";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { describe, expect, it } from "vitest";
import { SWEEP_BATCH_SIZE } from "./config";
import { limitPdaForBuyer, planSweep, randomSweepTime, runSweep, selectSweepAccounts, sweepInstructions, sweptToday, type SweepStore, type VaultState } from "./sweep";

const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const agent = Keypair.generate().publicKey;
const treasuryVaultPda = Keypair.generate().publicKey;
const treasuryUsdcAta = Keypair.generate().publicKey;
const rulebook = { ...DEFAULT_RULEBOOK, treasury: { ...DEFAULT_RULEBOOK.treasury, agentDailyLimitUsdc: 5_000_000_000n } };

function vault(buyerId: string, balance: bigint, extra: Partial<VaultState> = {}): VaultState {
  return {
    buyerId,
    multisigPda: Keypair.generate().publicKey,
    vaultAta: Keypair.generate().publicKey,
    spendingLimitPda: Keypair.generate().publicKey,
    balanceUsdc: balance,
    remainingTodayUsdc: 5_000_000_000n,
    sweptTodayUsdc: 0n,
    ...extra,
  };
}

describe("planSweep", () => {
  it("sweeps every funded vault in full and skips empty ones", () => {
    const plan = planSweep({ vaults: [vault("a", 700_000n), vault("b", 0n), vault("c", 1_000n)], rulebook, treasuryUsdcAta });
    expect(plan.items.map((i) => [i.buyerId, i.amountUsdc])).toEqual([["a", 700_000n], ["c", 1_000n]]);
    expect(plan.skipped).toEqual([{ buyerId: "b", mode: "refused", reason: "Nothing to sweep" }]);
  });

  it("caps at what is left of today's on-chain limit and hands the rest to a proposal", () => {
    const plan = planSweep({
      vaults: [vault("a", 6_000_000_000n, { remainingTodayUsdc: 2_000_000_000n, sweptTodayUsdc: 3_000_000_000n })],
      rulebook,
      treasuryUsdcAta,
    });
    expect(plan.items).toEqual([expect.objectContaining({ buyerId: "a", amountUsdc: 2_000_000_000n, ruleId: "T2" })]);
    expect(plan.skipped).toEqual([]);
  });

  it("does not sweep on its own when the rulebook turns daily sweeps off", () => {
    const off = { ...rulebook, treasury: { ...rulebook.treasury, sweepDaily: false } };
    const plan = planSweep({ vaults: [vault("a", 1_000_000n)], rulebook: off, treasuryUsdcAta });
    expect(plan.items).toEqual([]);
    expect(plan.skipped[0]).toMatchObject({ buyerId: "a", mode: "proposal", ruleId: "T4" });
  });

  it("refuses when the rules engine says the day's cap is already used up", () => {
    const plan = planSweep({
      vaults: [vault("a", 1_000_000n, { remainingTodayUsdc: 1_000_000n, sweptTodayUsdc: 5_000_000_000n })],
      rulebook,
      treasuryUsdcAta,
    });
    expect(plan.items).toEqual([]);
    expect(plan.skipped[0]).toMatchObject({ buyerId: "a", mode: "proposal", ruleId: "T4" });
  });

  it(`batches at most ${SWEEP_BATCH_SIZE} vaults per transaction`, () => {
    const vaults = ["a", "b", "c", "d", "e"].map((id) => vault(id, 10n));
    const plan = planSweep({ vaults, rulebook, treasuryUsdcAta });
    expect(plan.batches.map((b) => b.map((i) => i.buyerId))).toEqual([["a", "b", "c"], ["d", "e"]]);
    expect(plan.batches.flat()).toHaveLength(5);
  });
});

describe("sweptToday", () => {
  const limit = { amount: 5_000_000_000n, remainingAmount: 4_000_000_000n, lastReset: 1_000_000n, period: multisig.types.Period.Day };
  it("is what the limit has already paid out inside the current period", () => {
    expect(sweptToday(limit, 1_000_000n + 3600n)).toEqual({ sweptTodayUsdc: 1_000_000_000n, remainingTodayUsdc: 4_000_000_000n });
  });
  it("resets once the period has elapsed, matching the program's lazy reset", () => {
    expect(sweptToday(limit, 1_000_000n + 86_400n)).toEqual({ sweptTodayUsdc: 0n, remainingTodayUsdc: 5_000_000_000n });
  });
});

describe("sweepInstructions", () => {
  it("builds one spendingLimitUse per vault, signed by the agent, to the treasury vault PDA", () => {
    const items = planSweep({ vaults: [vault("a", 5n), vault("b", 6n)], rulebook, treasuryUsdcAta }).items;
    const ixs = sweepInstructions({ items, agent, usdcMint: usdc, treasuryVaultPda });
    expect(ixs).toHaveLength(2);
    for (const ix of ixs) {
      expect(ix.programId.equals(multisig.PROGRAM_ID)).toBe(true);
      const signers = ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
      expect(signers).toEqual([agent.toBase58()]);
      expect(ix.keys.some((k) => k.pubkey.equals(treasuryVaultPda))).toBe(true);
    }
    expect(ixs[0]!.keys.some((k) => k.pubkey.equals(items[0]!.spendingLimitPda))).toBe(true);
  });
});

describe("randomSweepTime", () => {
  const after = new Date("2026-10-01T00:00:00Z");
  it("lands strictly after `after` and within the next 24h", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const t = randomSweepTime(after, () => r).getTime() - after.getTime();
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(24 * 3600_000);
    }
  });
  it("is spread across the day, not a fixed offset", () => {
    expect(randomSweepTime(after, () => 0.25).getTime()).toBeLessThan(randomSweepTime(after, () => 0.75).getTime());
  });
});

describe("selectSweepAccounts", () => {
  const accounts = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("keeps every account when no selection is given (the daily sweep)", () => {
    expect(selectSweepAccounts(accounts)).toEqual(accounts);
  });

  it("keeps only the owner's ticked accounts, in account order", () => {
    expect(selectSweepAccounts(accounts, ["c", "a"]).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("refuses an empty selection", () => {
    expect(() => selectSweepAccounts(accounts, [])).toThrow(/at least one/);
  });

  it("refuses an account that is not this exporter's", () => {
    expect(() => selectSweepAccounts(accounts, ["a", "someone-elses"])).toThrow(/not one of your buyer accounts/);
  });
});

describe("runSweep with a selection", () => {
  it("reads and moves only the selected buyer accounts", async () => {
    const feePayer = Keypair.generate();
    const buyers = ["a", "b", "c"].map((id) => ({ id, multisig: Keypair.generate().publicKey.toBase58(), usdcAta: Keypair.generate().publicKey.toBase58() }));
    const limitOf = new Map(buyers.map((b) => [limitPdaForBuyer({ multisigPda: new PublicKey(b.multisig), secret: feePayer.secretKey }).toBase58(), b.id]));
    const read: string[] = [];
    // No spending limit on-chain → nothing is planned or sent; we only watch which accounts were read.
    const connection = { getAccountInfo: async (pda: PublicKey) => (read.push(limitOf.get(pda.toBase58()) ?? "?"), null) } as unknown as Parameters<typeof runSweep>[0]["connection"];
    const writes: string[] = [];
    const store: SweepStore = {
      getExporter: async () => ({ id: "e", name: "E", treasuryVault: treasuryVaultPda.toBase58(), treasuryUsdcAta: treasuryUsdcAta.toBase58() }) as never,
      listBuyerAccounts: async () => buyers,
      getRulebook: async () => rulebook,
      recordSweep: async () => (writes.push("recordSweep"), {}) as never,
      recordAgentAction: async () => (writes.push("recordAgentAction"), {}) as never,
      updateBalances: async (_e, b) => void writes.push(`updateBalances:${Object.keys(b.vaults ?? {}).join(",")}`),
    };
    const r = await runSweep({ connection, feePayer, agent: Keypair.generate(), usdcMint: usdc, store, exporterId: "e", buyerIds: ["b"] });
    expect(read.filter((x) => x !== "?")).toEqual(["b"]); // "?" = the treasury balance refresh at the end
    expect(r.sweeps).toEqual([]);
    expect(writes).toEqual(["updateBalances:"]);
  });

  it("refuses a selection with another exporter's account before touching the chain", async () => {
    const read: string[] = [];
    const connection = { getAccountInfo: async () => (read.push("x"), null) } as unknown as Parameters<typeof runSweep>[0]["connection"];
    const store = {
      getExporter: async () => ({ id: "e", name: "E", treasuryVault: treasuryVaultPda.toBase58(), treasuryUsdcAta: treasuryUsdcAta.toBase58() }),
      listBuyerAccounts: async () => [{ id: "a", multisig: Keypair.generate().publicKey.toBase58(), usdcAta: Keypair.generate().publicKey.toBase58() }],
      getRulebook: async () => rulebook,
    } as unknown as SweepStore;
    await expect(runSweep({ connection, feePayer: Keypair.generate(), agent: Keypair.generate(), usdcMint: usdc, store, exporterId: "e", buyerIds: ["zz"] })).rejects.toThrow(/not one of your buyer accounts/);
    expect(read).toEqual([]);
  });
});
