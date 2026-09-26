/**
 * x402 v2, `exact` scheme on Solana (SPEC F5, DECISIONS D5). Self-hosted
 * facilitator: verify the pre-submit payload against the canonical spec's
 * static layout (x402-foundation/x402 specs/schemes/exact/scheme_exact_svm.md,
 * 2026-08-25) plus our D4 fee-payer isolation, co-sign as fee payer, submit,
 * confirm by polling. Implemented on @solana/web3.js v1 because the official
 * @x402/svm package is built on @solana/kit, which this repo does not use.
 */
import { createHash, createPublicKey, verify as verifyEd25519 } from "node:crypto";
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type Keypair,
  type TransactionInstruction,
} from "@solana/web3.js";
import { assertFeePayerAbsent, decodeComputeBudget } from "../shared/audit";
import { MAX_CU_LIMIT, MAX_CU_PRICE_MICROLAMPORTS, MEMO_PROGRAM_ID, USDC_DECIMALS, USDC_MINT } from "../shared/constants";
import { memoInstruction, memoText } from "../shared/memo";
import { confirmByPolling } from "../shared/rpc";

export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const LIGHTHOUSE_PROGRAM_ID = new PublicKey("L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95");
export const X402_HEADERS = { required: "PAYMENT-REQUIRED", signature: "PAYMENT-SIGNATURE", response: "PAYMENT-RESPONSE" } as const;

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { feePayer: string; memo: string; reference?: string };
};
export type ResourceInfo = { url: string; description?: string; mimeType?: string };
export type PaymentRequired = { x402Version: 2; error?: string; resource: ResourceInfo; accepts: PaymentRequirements[] };
export type PaymentPayload = { x402Version: 2; resource?: ResourceInfo; accepted: PaymentRequirements; payload: { transaction: string } };
export type SettleResponse = { success: boolean; errorReason?: string; transaction: string; network: string; payer?: string };

export function paymentRequirements(p: { amountUsdc: bigint; payTo: string; feePayer: string; memo: string; reference?: string; usdcMint?: PublicKey; maxTimeoutSeconds?: number }): PaymentRequirements {
  return {
    scheme: "exact",
    network: SOLANA_MAINNET,
    amount: p.amountUsdc.toString(),
    asset: (p.usdcMint ?? USDC_MINT).toBase58(),
    payTo: p.payTo,
    maxTimeoutSeconds: p.maxTimeoutSeconds ?? 60,
    // feePayer + memo are spec-defined; `reference` is a Kutip hint (scheme-specific keys are allowed) so a
    // bot can tag the transfer with our Solana Pay reference key. It is optional and not verified.
    extra: { feePayer: p.feePayer, memo: p.memo, ...(p.reference ? { reference: p.reference } : {}) },
  };
}

export function paymentRequired(p: { resource: ResourceInfo; accepts: PaymentRequirements[]; error?: string }): PaymentRequired {
  return { x402Version: 2, ...(p.error ? { error: p.error } : {}), resource: p.resource, accepts: p.accepts };
}

export const encodeHeader = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
export function decodeHeader<T = unknown>(header: string): T {
  const text = Buffer.from(header, "base64").toString("utf8");
  if (!text.trim().startsWith("{")) throw new Error("header is not base64 JSON");
  return JSON.parse(text) as T;
}

/** Reference client: v0 tx [CU limit, CU price, TransferChecked(+reference), Memo], fee payer = extra.feePayer, client-signed. */
export function buildX402ClientTransaction(p: { requirements: PaymentRequirements; client: Keypair; blockhash: string; sourceAta?: PublicKey }): PaymentPayload {
  const r = p.requirements;
  const mint = new PublicKey(r.asset);
  const source = p.sourceAta ?? getAssociatedTokenAddressSync(mint, p.client.publicKey, true);
  const dest = getAssociatedTokenAddressSync(mint, new PublicKey(r.payTo), true);
  const transfer = createTransferCheckedInstruction(source, mint, dest, p.client.publicKey, BigInt(r.amount), USDC_DECIMALS);
  if (r.extra.reference) transfer.keys.push({ pubkey: new PublicKey(r.extra.reference), isSigner: false, isWritable: false });
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }), transfer, memoInstruction(r.extra.memo)];
  const msg = new TransactionMessage({ payerKey: new PublicKey(r.extra.feePayer), recentBlockhash: p.blockhash, instructions: ixs }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([p.client]);
  return { x402Version: 2, accepted: r, payload: { transaction: Buffer.from(tx.serialize()).toString("base64") } };
}

/** Duplicate-settlement guard keyed on the message bytes (immune to the mutable fee-payer signature slot). */
export class ReplayCache {
  private readonly seen = new Map<string, number>();
  constructor(private readonly ttlMs = 120_000) {}
  /** Returns false if already seen within the ttl; records the hash otherwise. */
  claim(messageHash: string, now = Date.now()): boolean {
    for (const [k, t] of this.seen) if (now - t > this.ttlMs) this.seen.delete(k);
    if (this.seen.has(messageHash)) return false;
    this.seen.set(messageHash, now);
    return true;
  }
}

export type X402Rpc = {
  getAddressLookupTable(address: PublicKey): Promise<AddressLookupTableAccount | null>;
  simulateTransaction(tx: VersionedTransaction): Promise<{ err: unknown; logs?: string[] | null }>;
  sendRawTransaction(bytes: Uint8Array): Promise<string>;
  confirmTransaction(signature: string): Promise<{ slot: number; err: unknown }>;
};

export type Verified = { ok: true; transaction: VersionedTransaction; payer: string; messageHash: string; network: string };
export type Rejected = { ok: false; reason: string; message: string };

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
function signatureValid(pubkey: PublicKey, message: Uint8Array, signature: Uint8Array): boolean {
  if (signature.every((b) => b === 0)) return false;
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(pubkey.toBytes())]), format: "der", type: "spki" });
  return verifyEd25519(null, Buffer.from(message), key, Buffer.from(signature));
}

class Reject extends Error {
  constructor(public readonly reason: string, message: string) {
    super(message);
  }
}
const reject = (reason: string, message: string): never => {
  throw new Reject(`invalid_exact_svm_${reason}`, message);
};

const TRANSFER_CHECKED = 12;

export async function verifyX402(p: {
  payload: PaymentPayload;
  requirements: PaymentRequirements;
  feePayer: PublicKey;
  rpc: X402Rpc;
  replay: ReplayCache;
  now?: Date;
}): Promise<Verified | Rejected> {
  try {
    return await verify(p);
  } catch (e) {
    if (e instanceof Reject) return { ok: false, reason: e.reason, message: e.message };
    return { ok: false, reason: "invalid_exact_svm_payload", message: (e as Error).message };
  }
}

async function verify(p: Parameters<typeof verifyX402>[0]): Promise<Verified> {
  const { payload, requirements: req } = p;
  if (payload.x402Version !== 2) reject("version", "x402Version must be 2");
  const acc = payload.accepted;
  if (!acc || acc.scheme !== "exact") reject("scheme", "scheme must be exact");
  if (acc.network !== req.network) reject("network", `network must be ${req.network}`);
  if (acc.amount !== req.amount || acc.asset !== req.asset || acc.payTo !== req.payTo || acc.extra?.feePayer !== req.extra.feePayer || acc.extra?.memo !== req.extra.memo) {
    reject("requirements_mismatch", "accepted requirements do not match this invoice");
  }
  if (req.extra.feePayer !== p.feePayer.toBase58()) reject("fee_payer_not_managed", "fee payer is not managed by this facilitator");

  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(Buffer.from(payload.payload.transaction, "base64"));
  } catch {
    return reject("transaction_could_not_decode", "could not decode transaction");
  }
  const msg = tx.message;
  const keys = msg.staticAccountKeys;
  if (!keys[0]?.equals(p.feePayer)) reject("fee_payer_mismatch", "transaction fee payer must be extra.feePayer");
  if (msg.header.numRequiredSignatures !== 2) reject("required_signers", "transaction must require exactly two signers: the client and the fee payer");
  const messageBytes = msg.serialize();
  const client = keys[1]!;
  if (!signatureValid(client, messageBytes, tx.signatures[1]!)) reject("signature", "client signature missing or invalid");

  const luts: AddressLookupTableAccount[] = [];
  for (const lookup of msg.addressTableLookups) {
    const lut = await p.rpc.getAddressLookupTable(lookup.accountKey);
    if (!lut) reject("lookup_table", `lookup table ${lookup.accountKey.toBase58()} could not be resolved`);
    luts.push(lut!);
  }
  const ixs = TransactionMessage.decompile(msg, { addressLookupTableAccounts: luts }).instructions;
  try {
    assertFeePayerAbsent(ixs, p.feePayer); // D4: checked before anything else about the layout
  } catch (e) {
    reject("fee_payer_in_instruction", (e as Error).message);
  }
  if (ixs.length < 3 || ixs.length > 7) reject("instructions_length", "transaction must contain 3 to 7 instructions");

  const budgetIxs = ixs.slice(0, 2);
  const isBudget = (ix: TransactionInstruction, disc: number) => ix.programId.equals(ComputeBudgetProgram.programId) && ix.data[0] === disc;
  if (!isBudget(ixs[0]!, 2)) reject("compute_limit_instruction", "instruction 0 must be SetComputeUnitLimit");
  if (!isBudget(ixs[1]!, 3)) reject("compute_price_instruction", "instruction 1 must be SetComputeUnitPrice");
  const budget = decodeComputeBudget(budgetIxs);
  if (budget.unitLimit === undefined || budget.unitLimit > MAX_CU_LIMIT) reject("compute_limit_too_high", `compute unit limit above cap ${MAX_CU_LIMIT}`);
  if (budget.unitPrice === undefined || budget.unitPrice > BigInt(MAX_CU_PRICE_MICROLAMPORTS)) reject("compute_price_too_high", `compute unit price above cap ${MAX_CU_PRICE_MICROLAMPORTS}`);

  const t = ixs[2]!;
  const tokenProgram = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].find((pid) => pid.equals(t.programId));
  if (!tokenProgram || t.data[0] !== TRANSFER_CHECKED || t.data.length !== 10) reject("transfer_instruction", "instruction 2 must be a token TransferChecked");
  const [source, mint, dest, authority, ...rest] = t.keys;
  if (!source || !mint || !dest || !authority || !authority.isSigner) reject("transfer_accounts", "TransferChecked accounts malformed");
  if (rest.some((k) => k.isSigner)) reject("transfer_extra_signers", "TransferChecked must not require extra signers");
  const asset = new PublicKey(req.asset);
  if (!mint!.pubkey.equals(asset)) reject("mint_mismatch", "transfer mint is not the required asset");
  const expectedDest = getAssociatedTokenAddressSync(asset, new PublicKey(req.payTo), true, tokenProgram);
  if (!dest!.pubkey.equals(expectedDest)) reject("recipient_mismatch", "transfer destination is not the recipient's token account");
  const data = Buffer.from(t.data);
  const amount = data.readBigUInt64LE(1);
  if (amount !== BigInt(req.amount)) reject("amount_mismatch", `transfer amount ${amount} does not equal required ${req.amount}`);
  if (data[9] !== USDC_DECIMALS) reject("decimals_mismatch", "transfer decimals must be 6");
  if (authority!.pubkey.equals(p.feePayer)) reject("fee_payer_transferring_funds", "fee payer must not be the transfer authority");
  if (!authority!.pubkey.equals(client)) reject("authority_not_client", "transfer authority must be the client signer");

  for (const ix of ixs.slice(3)) {
    if (!ix.programId.equals(LIGHTHOUSE_PROGRAM_ID) && !ix.programId.equals(MEMO_PROGRAM_ID)) reject("program_not_allowed", "only Lighthouse or Memo instructions may follow the transfer");
  }
  const memos = ixs.filter((ix) => ix.programId.equals(MEMO_PROGRAM_ID));
  if (memos.length !== 1 || memoText(memos[0]!.data) !== req.extra.memo) reject("memo_mismatch", "exactly one Memo instruction with extra.memo is required");

  const messageHash = createHash("sha256").update(messageBytes).digest("hex");
  if (!p.replay.claim(messageHash, p.now?.getTime())) reject("duplicate_settlement", "this transaction was already submitted");

  const sim = await p.rpc.simulateTransaction(tx);
  if (sim.err) reject("transaction_simulation_failed", `transaction simulation failed: ${JSON.stringify(sim.err)}`);

  return { ok: true, transaction: tx, payer: authority!.pubkey.toBase58(), messageHash, network: req.network };
}

export async function settleX402(p: { verified: Verified; feePayer: Keypair; rpc: X402Rpc }): Promise<SettleResponse> {
  const { transaction: tx, payer, network } = p.verified;
  tx.sign([p.feePayer]);
  let signature: string;
  try {
    signature = await p.rpc.sendRawTransaction(tx.serialize());
  } catch (e) {
    return { success: false, errorReason: `send failed: ${(e as Error).message}`, transaction: "", network, payer };
  }
  try {
    const { err } = await p.rpc.confirmTransaction(signature);
    if (err) return { success: false, errorReason: `transaction failed on-chain: ${JSON.stringify(err)}`, transaction: signature, network, payer };
  } catch (e) {
    return { success: false, errorReason: `settlement_pending: ${(e as Error).message}`, transaction: signature, network, payer };
  }
  return { success: true, transaction: signature, network, payer };
}

export function x402RpcFromConnection(connection: Connection): X402Rpc {
  return {
    async getAddressLookupTable(address) {
      return (await connection.getAddressLookupTable(address)).value;
    },
    async simulateTransaction(tx) {
      const { value } = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" });
      return { err: value.err, logs: value.logs };
    },
    sendRawTransaction: (bytes) => connection.sendRawTransaction(bytes, { skipPreflight: true, preflightCommitment: "confirmed", maxRetries: 3 }),
    async confirmTransaction(signature) {
      const { lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      return confirmByPolling(connection, signature, lastValidBlockHeight, { timeoutMs: 45_000 });
    },
  };
}
