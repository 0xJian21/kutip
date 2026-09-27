/**
 * The few Solana JSON-RPC calls the worker needs, over fetch. Raw `getTransaction` (encoding "json"):
 * web3.js's getParsedTransaction fails on Solami's `stackHeight` (Spike C).
 */
import type { Commitment } from "@kutip/db";
import type { TrackerRpc } from "./payments";
import type { RpcTransaction } from "./verify";

export function createRpc(url: string, fetchFn: typeof fetch = fetch) {
  let id = 0;
  async function call<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result as T;
  }

  return {
    getTransaction: (signature: string) =>
      call<RpcTransaction | null>("getTransaction", [signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]),

    getSignaturesForAddress: (address: string) =>
      call<Array<{ signature: string; slot: number; err: unknown; confirmationStatus: Commitment | null; blockTime: number | null }>>("getSignaturesForAddress", [
        address,
        { commitment: "confirmed", limit: 20 },
      ]),

    getSignatureStatuses: async (signatures: string[]) =>
      (
        await call<{ value: Array<{ slot: number; confirmationStatus: Commitment | null; err: unknown } | null> }>("getSignatureStatuses", [
          signatures,
          { searchTransactionHistory: true },
        ])
      ).value,

    /** Existing accounts only, with lamports and raw data. */
    async getAccounts(pubkeys: string[]): Promise<Array<{ pubkey: string; lamports: bigint; data: Uint8Array }>> {
      const out: Array<{ pubkey: string; lamports: bigint; data: Uint8Array }> = [];
      for (let i = 0; i < pubkeys.length; i += 100) {
        const chunk = pubkeys.slice(i, i + 100);
        const { value } = await call<{ value: Array<{ lamports: number; data: [string, string] } | null> }>("getMultipleAccounts", [
          chunk,
          { encoding: "base64", commitment: "confirmed" },
        ]);
        value.forEach((a, j) => {
          if (a) out.push({ pubkey: chunk[j]!, lamports: BigInt(a.lamports), data: new Uint8Array(Buffer.from(a.data[0], "base64")) });
        });
      }
      return out;
    },
  } satisfies TrackerRpc & Record<string, unknown>;
}

export type Rpc = ReturnType<typeof createRpc>;
