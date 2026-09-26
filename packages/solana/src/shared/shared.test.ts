import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { assertComputeBudgetCaps, assertFeePayerAbsent, decodeComputeBudget } from "./audit";
import { MAX_CU_LIMIT, MAX_CU_PRICE_MICROLAMPORTS, MEMO_PROGRAM_ID } from "./constants";
import { memoInstruction, memoText } from "./memo";

const feePayer = Keypair.generate().publicKey;
const other = Keypair.generate().publicKey;

describe("memo", () => {
  test("memo instruction carries the opaque code with no accounts", () => {
    const ix = memoInstruction("k_3f9a0qzt");
    expect(ix.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(ix.keys).toEqual([]);
    expect(memoText(ix.data)).toBe("k_3f9a0qzt");
  });
});

describe("assertFeePayerAbsent", () => {
  test("passes when the fee payer is in no instruction", () => {
    const ixs = [SystemProgram.transfer({ fromPubkey: other, toPubkey: Keypair.generate().publicKey, lamports: 1 })];
    expect(() => assertFeePayerAbsent(ixs, feePayer)).not.toThrow();
  });
  test("throws when the fee payer is an instruction account", () => {
    const ixs = [SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: other, lamports: 1 })];
    expect(() => assertFeePayerAbsent(ixs, feePayer)).toThrow(/fee payer/);
  });
  test("throws when the fee payer is a read-only account", () => {
    const ix = new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [{ pubkey: feePayer, isSigner: false, isWritable: false }], data: Buffer.alloc(0) });
    expect(() => assertFeePayerAbsent([ix], feePayer)).toThrow(/fee payer/);
  });
  test("throws when the fee payer is the program id", () => {
    const ix = new TransactionInstruction({ programId: feePayer, keys: [], data: Buffer.alloc(0) });
    expect(() => assertFeePayerAbsent([ix], feePayer)).toThrow(/fee payer/);
  });
});

describe("compute budget", () => {
  test("decodes limit and price instructions", () => {
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 })];
    expect(decodeComputeBudget(ixs)).toEqual({ unitLimit: 30_000, unitPrice: 10_000n });
  });
  test("ignores non-compute-budget instructions", () => {
    expect(decodeComputeBudget([memoInstruction("x")])).toEqual({});
  });
  test("caps hold at the limits", () => {
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: MAX_CU_LIMIT }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: MAX_CU_PRICE_MICROLAMPORTS })];
    expect(() => assertComputeBudgetCaps(ixs)).not.toThrow();
  });
  test("rejects a compute unit price above the cap", () => {
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 1 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: MAX_CU_PRICE_MICROLAMPORTS + 1 })];
    expect(() => assertComputeBudgetCaps(ixs)).toThrow(/price/);
  });
  test("rejects a compute unit limit above the cap", () => {
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: MAX_CU_LIMIT + 1 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })];
    expect(() => assertComputeBudgetCaps(ixs)).toThrow(/limit/);
  });
  test("rejects a missing price instruction (unbounded priority fee)", () => {
    expect(() => assertComputeBudgetCaps([ComputeBudgetProgram.setComputeUnitLimit({ units: 1 })])).toThrow(/price/);
  });
  test("rejects a missing limit instruction", () => {
    expect(() => assertComputeBudgetCaps([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })])).toThrow(/limit/);
  });
  test("rejects any other compute budget instruction (e.g. heap frame)", () => {
    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 65536 }),
    ];
    expect(() => assertComputeBudgetCaps(ixs)).toThrow(/compute budget/i);
  });
  test("PublicKey sanity: constants are valid keys", () => {
    expect(new PublicKey(MEMO_PROGRAM_ID.toBase58()).equals(MEMO_PROGRAM_ID)).toBe(true);
  });
});
