import { ComputeBudgetProgram, Connection, Keypair, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount, type Signer, type TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import { CU_LIMIT, CU_PRICE_MICRO_LAMPORTS } from "./config";

/** Solami's WS lives at /ws/sol; web3.js would guess the RPC path and 405. */
export function connectionFor(rpcUrl: string): Connection {
  const wsEndpoint = rpcUrl.replace(/^http/, "ws").replace("/sol", "/ws/sol");
  return new Connection(rpcUrl, { commitment: "confirmed", wsEndpoint });
}

export function keypairFromEnv(name: string): Keypair {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return Keypair.fromSecretKey(bs58.decode(v));
}

/** Compute-budget caps first (D4), then the caller's instructions. */
export function withComputeBudget(ixs: TransactionInstruction[]): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE_MICRO_LAMPORTS }),
    ...ixs,
  ];
}

export async function buildV0(
  connection: Connection,
  payerKey: Keypair["publicKey"],
  ixs: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[] = [],
): Promise<{ tx: VersionedTransaction; lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({ payerKey, recentBlockhash: blockhash, instructions: withComputeBudget(ixs) }).compileToV0Message(lookupTables);
  return { tx: new VersionedTransaction(msg), lastValidBlockHeight };
}

/** Build, sign with the fee payer + `signers`, send with preflight, confirm by polling. */
export async function sendV0(connection: Connection, feePayer: Keypair, ixs: TransactionInstruction[], signers: Signer[]): Promise<string> {
  const { tx, lastValidBlockHeight } = await buildV0(connection, feePayer.publicKey, ixs);
  tx.sign([feePayer, ...signers]);
  const sig = await connection.sendTransaction(tx);
  await confirmByPolling(connection, sig, lastValidBlockHeight);
  return sig;
}

/** Send an already fully-signed transaction (e.g. owner-signed via Privy) and confirm it. */
export async function sendSigned(connection: Connection, tx: VersionedTransaction): Promise<string> {
  const sig = await connection.sendTransaction(tx);
  const { lastValidBlockHeight } = await connection.getLatestBlockhash();
  await confirmByPolling(connection, sig, lastValidBlockHeight);
  return sig;
}

/** getSignatureStatuses polling: no WebSocket dependency. */
export async function confirmByPolling(connection: Connection, sig: string, lastValidBlockHeight: number): Promise<void> {
  for (;;) {
    const st = (await connection.getSignatureStatuses([sig])).value[0];
    if (st?.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(st.err)}`);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    if ((await connection.getBlockHeight()) > lastValidBlockHeight) {
      throw new Error(`tx ${sig} not confirmed before block height ${lastValidBlockHeight}; check Solscan before re-running`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
