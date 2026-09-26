import { PublicKey } from "@solana/web3.js";

/** Mainnet mints. USDC_MINT may be overridden by env (tests, look-alike checks use the real one). */
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USDC_DECIMALS = 6;

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey("ComputeBudget111111111111111111111111111111");

/** Solana packet limit for a serialized transaction. */
export const MAX_TX_BYTES = 1232;

/**
 * Fee-payer guardrails (DECISIONS D4). Worst case priority fee = limit × price
 * = 1.4M CU × 100k µL = 0.00014 SOL on top of the 5k-lamport base fee per signature.
 */
export const MAX_CU_LIMIT = 1_400_000;
export const MAX_CU_PRICE_MICROLAMPORTS = 100_000;
/** What we set on the transactions we build ourselves. */
export const DEFAULT_CU_PRICE_MICROLAMPORTS = 10_000;
export const USDC_TRANSFER_CU_LIMIT = 30_000;
