import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

/** Keys come from env only (CLAUDE.md). Never log the secret. */
export function keypairFromSecret(base58Secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(base58Secret));
}

/** Random Solana Pay reference key for a new invoice (pubkey only; nothing ever signs with it). */
export function newReferenceKey(): string {
  return Keypair.generate().publicKey.toBase58();
}

export function isPublicKey(s: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(s).toBytes()) || new PublicKey(s).toBase58() === s;
  } catch {
    return false;
  }
}
