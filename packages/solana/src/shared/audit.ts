import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { COMPUTE_BUDGET_PROGRAM_ID, MAX_CU_LIMIT, MAX_CU_PRICE_MICROLAMPORTS } from "./constants";

/** DECISIONS D4: the fee payer only ever signs as payer. It must not be an account (or program) of any instruction. */
export function assertFeePayerAbsent(ixs: readonly TransactionInstruction[], feePayer: PublicKey): void {
  ixs.forEach((ix, i) => {
    if (ix.programId.equals(feePayer) || ix.keys.some((k) => k.pubkey.equals(feePayer))) {
      throw new Error(`fee payer appears in instruction ${i}; refusing to sign`);
    }
  });
}

export type ComputeBudget = { unitLimit?: number; unitPrice?: bigint };

// ComputeBudget instruction discriminators (u8): 1 RequestHeapFrame, 2 SetComputeUnitLimit(u32), 3 SetComputeUnitPrice(u64).
const SET_CU_LIMIT = 2;
const SET_CU_PRICE = 3;

/** Reads the CU limit / price from the compute-budget instructions. Throws on any other compute-budget instruction. */
export function decodeComputeBudget(ixs: readonly TransactionInstruction[]): ComputeBudget {
  const out: ComputeBudget = {};
  for (const ix of ixs) {
    if (!ix.programId.equals(COMPUTE_BUDGET_PROGRAM_ID)) continue;
    const data = Buffer.from(ix.data);
    if (data[0] === SET_CU_LIMIT && data.length === 5) out.unitLimit = data.readUInt32LE(1);
    else if (data[0] === SET_CU_PRICE && data.length === 9) out.unitPrice = data.readBigUInt64LE(1);
    else throw new Error(`unexpected compute budget instruction (discriminator ${data[0]})`);
  }
  return out;
}

export function assertComputeBudgetCaps(ixs: readonly TransactionInstruction[], caps: { maxUnitLimit?: number; maxUnitPrice?: bigint } = {}): ComputeBudget {
  const budget = decodeComputeBudget(ixs);
  const maxLimit = caps.maxUnitLimit ?? MAX_CU_LIMIT;
  const maxPrice = caps.maxUnitPrice ?? BigInt(MAX_CU_PRICE_MICROLAMPORTS);
  if (budget.unitLimit === undefined) throw new Error("missing compute unit limit instruction");
  if (budget.unitLimit > maxLimit) throw new Error(`compute unit limit ${budget.unitLimit} above cap ${maxLimit}`);
  if (budget.unitPrice === undefined) throw new Error("missing compute unit price instruction");
  if (budget.unitPrice > maxPrice) throw new Error(`compute unit price ${budget.unitPrice} above cap ${maxPrice}`);
  return budget;
}
