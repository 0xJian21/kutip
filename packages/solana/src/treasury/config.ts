import { PublicKey } from "@solana/web3.js";

export const USDC_DECIMALS = 6;
/** Every Kutip multisig uses vault index 0. */
export const VAULT_INDEX = 0;
/** Compute-unit caps for admin / agent transactions (DECISIONS D4). */
export const CU_LIMIT = 200_000;
export const CU_PRICE_MICRO_LAMPORTS = 50_000;
/** Max spendingLimitUse instructions per sweep transaction (keeps the v0 tx well under 1232 bytes). */
export const SWEEP_BATCH_SIZE = 3;

export const USDC_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/** The SDK carries amounts as JS numbers; refuse anything it would round. */
export function toSdkAmount(amount: bigint, what = "amount"): number {
  if (amount <= 0n) throw new Error(`${what} must be positive`);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${what} exceeds the SDK's safe integer range`);
  return Number(amount);
}
