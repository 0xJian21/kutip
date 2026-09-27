/**
 * Wallet screening before we build a payment (SPEC F4 step 3, §6).
 * Static OFAC SDN list (sanctioned.json, with source + date) plus cheap RPC
 * heuristics: wallet age and the counterparties of its first transaction.
 * Fail-closed: if the RPC is unavailable the wallet is flagged, not passed.
 */
import type { Connection, PublicKey } from "@solana/web3.js";
import sanctioned from "./sanctioned.json";

export type ScreeningRpc = {
  getSignaturesForAddress(address: PublicKey, opts: { limit: number; before?: string }): Promise<{ signature: string; blockTime: number | null }[]>;
  /** Every account key of the transaction (static + lookup-table loaded), or null if unavailable. */
  getTransactionAccounts(signature: string): Promise<{ accounts: string[] } | null>;
};

export type ScreeningResult = { result: "pass" | "flag"; reasons: string[] };

export const SANCTIONED: ReadonlySet<string> = new Set(sanctioned.addresses.map((a) => a.address));
export const SANCTIONS_SOURCE = `OFAC SDN list dated ${sanctioned.sourceDate}`;

const PAGE = 1000;
const MAX_PAGES = 3;
const MIN_AGE_MS = 10 * 60_000;

export async function screenWallet(wallet: PublicKey, deps: { rpc: ScreeningRpc; now?: Date; sanctioned?: ReadonlySet<string> }): Promise<ScreeningResult> {
  const list = deps.sanctioned ?? SANCTIONED;
  const now = deps.now ?? new Date();
  const address = wallet.toBase58();
  if (list.has(address)) return { result: "flag", reasons: [`wallet is on the ${SANCTIONS_SOURCE} (OFAC SDN match)`] };

  try {
    let oldest: { signature: string; blockTime: number | null } | undefined;
    let pages = 0;
    let before: string | undefined;
    let exhausted = false;
    while (pages < MAX_PAGES) {
      const batch = await deps.rpc.getSignaturesForAddress(wallet, { limit: PAGE, before });
      pages++;
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      oldest = batch[batch.length - 1]!;
      before = oldest.signature;
      if (batch.length < PAGE) {
        exhausted = true;
        break;
      }
    }
    if (!oldest) return { result: "flag", reasons: ["wallet has no on-chain history"] };

    const reasons: string[] = [`no match on the ${SANCTIONS_SOURCE}`];
    if (oldest.blockTime !== null) {
      const ageMs = now.getTime() - oldest.blockTime * 1000;
      if (ageMs < MIN_AGE_MS) return { result: "flag", reasons: ["wallet first seen less than 10 minutes ago"] };
      reasons.push(`wallet first seen ${Math.floor(ageMs / 86_400_000)} days ago${exhausted ? "" : " (3000+ transactions)"}`);
    }
    if (!exhausted) {
      reasons.push("funding source not checked (history longer than 3 pages)");
      return { result: "pass", reasons };
    }
    const first = await deps.rpc.getTransactionAccounts(oldest.signature);
    const hit = first?.accounts.find((a) => a !== address && list.has(a));
    if (hit) return { result: "flag", reasons: [`first transaction involved a sanctioned address (${hit.slice(0, 6)}…)`] };
    reasons.push("first transaction counterparties not sanctioned");
    return { result: "pass", reasons };
  } catch (e) {
    return { result: "flag", reasons: [`wallet could not be screened: ${(e as Error).message}`] };
  }
}

export function screeningRpcFromConnection(connection: Connection): ScreeningRpc {
  return {
    getSignaturesForAddress: async (address, opts) =>
      (await connection.getSignaturesForAddress(address, opts, "confirmed")).map((s) => ({ signature: s.signature, blockTime: s.blockTime ?? null })),
    async getTransactionAccounts(signature) {
      // Raw getTransaction: Solami's responses break web3.js getParsedTransaction (spike A).
      const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (!tx) return null;
      const keys = [...tx.transaction.message.staticAccountKeys, ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
      return { accounts: keys.map((k) => k.toBase58()) };
    },
  };
}
