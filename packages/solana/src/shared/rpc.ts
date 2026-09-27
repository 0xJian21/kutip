import { getAccount, TokenAccountNotFoundError, TokenInvalidAccountOwnerError } from "@solana/spl-token";
import { Connection, type AddressLookupTableAccount, type PublicKey } from "@solana/web3.js";

export type TokenAccountInfo = { mint: PublicKey; owner: PublicKey; amount: bigint };

/** The slice of RPC that payment building needs; faked in tests. */
export type PaymentRpc = {
  getTokenAccount(address: PublicKey): Promise<TokenAccountInfo | null>;
  getLamports(address: PublicKey): Promise<bigint>;
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
  getAddressLookupTable(address: PublicKey): Promise<AddressLookupTableAccount | null>;
};

/**
 * Solami's WS endpoint is not at the web3.js default path, so nothing here
 * subscribes; confirmation is done by polling getSignatureStatuses.
 */
export function makeConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: false });
}

export function rpcFromConnection(connection: Connection): PaymentRpc {
  return {
    async getTokenAccount(address) {
      try {
        const a = await getAccount(connection, address, "confirmed");
        return { mint: a.mint, owner: a.owner, amount: a.amount };
      } catch (e) {
        if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) return null;
        throw e;
      }
    },
    getLamports: async (address) => BigInt(await connection.getBalance(address, "confirmed")),
    getLatestBlockhash: () => connection.getLatestBlockhash("confirmed"),
    async getAddressLookupTable(address) {
      return (await connection.getAddressLookupTable(address)).value;
    },
  };
}

/** Polls getSignatureStatuses until the signature reaches `commitment` or the blockhash expires. */
export async function confirmByPolling(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  opts: { commitment?: "confirmed" | "finalized"; intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ slot: number; err: unknown }> {
  const commitment = opts.commitment ?? "confirmed";
  const interval = opts.intervalMs ?? 500;
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const st = value[0];
    if (st) {
      const level = st.confirmationStatus;
      if (st.err) return { slot: st.slot, err: st.err };
      if (level === "finalized" || (commitment === "confirmed" && level === "confirmed")) return { slot: st.slot, err: null };
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${signature}`);
    const height = await connection.getBlockHeight("confirmed");
    if (height > lastValidBlockHeight) throw new Error(`blockhash expired before ${signature} confirmed`);
    await new Promise((r) => setTimeout(r, interval));
  }
}
