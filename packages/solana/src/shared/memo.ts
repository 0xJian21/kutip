import { TransactionInstruction } from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "./constants";

/** SPL Memo v2. It requires every provided account to sign, so the memo never carries the reference key. */
export function memoInstruction(text: string): TransactionInstruction {
  return new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(text, "utf8") });
}

export function memoText(data: Uint8Array): string {
  return Buffer.from(data).toString("utf8");
}
