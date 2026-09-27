/**
 * Solana Pay transaction-request builder (SPEC F4, DECISIONS D4).
 * Proven on mainnet in spikes/a-solana-pay. Two modes:
 *   usdc      buyer USDC ATA → vault USDC ATA, transferChecked, exact amount (legacy or v0)
 *   sol/usdt  Jupiter Swap API v1 ExactOut: vault ATA receives exactly `amountUsdc` (always v0)
 * The fee payer signs first; the buyer's signature slot is left empty for the wallet.
 */
import { ASSOCIATED_TOKEN_PROGRAM_ID, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type Keypair,
} from "@solana/web3.js";
import { assertComputeBudgetCaps, assertFeePayerAbsent } from "../shared/audit";
import { DEFAULT_CU_PRICE_MICROLAMPORTS, MAX_CU_LIMIT, MAX_TX_BYTES, SOL_MINT, USDC_DECIMALS, USDC_MINT, USDC_TRANSFER_CU_LIMIT, USDT_MINT } from "../shared/constants";
import { memoInstruction } from "../shared/memo";
import type { PaymentRpc } from "../shared/rpc";
import type { JupiterClient, JupiterInstruction } from "./jupiter";

export type { PaymentRpc };

export type PaymentMode = "usdc" | "sol" | "usdt";

export type BuildPaymentInput = {
  rpc: PaymentRpc;
  feePayer: Keypair;
  buyer: PublicKey;
  /** Exact USDC (base units) the vault ATA must receive. */
  amountUsdc: bigint;
  /** Buyer-multisig vault USDC ATA. Must already exist; we never create ATAs. */
  destinationAta: PublicKey;
  /** Solana Pay reference key (read-only, non-signer on the transfer/swap instruction). */
  reference: PublicKey;
  /** Opaque memo code, `k_` + 8 chars. Nothing identifying goes on-chain. */
  memo: string;
  mode: PaymentMode;
  /** usdc mode only; swaps are always v0. */
  txVersion?: "legacy" | "v0";
  usdcMint?: PublicKey;
  cuPriceMicroLamports?: number;
  /** Required for sol/usdt modes. */
  jupiter?: JupiterClient;
};

export type SwapQuote = { inputMint: "SOL" | "USDT"; quotedInput: bigint; quotedOut: bigint };

export type BuiltPayment = {
  transaction: Uint8Array;
  base64: string;
  version: "legacy" | "v0";
  blockhash: string;
  lastValidBlockHeight: number;
  quote?: SwapQuote;
};

const MEMO_RE = /^k_[a-z0-9]{8}$/;

export function computeBudgetInstructions(unitLimit: number, unitPrice: number): TransactionInstruction[] {
  return [ComputeBudgetProgram.setComputeUnitLimit({ units: unitLimit }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: unitPrice })];
}

async function assertDestination(rpc: PaymentRpc, destinationAta: PublicKey, usdcMint: PublicKey): Promise<void> {
  const dest = await rpc.getTokenAccount(destinationAta);
  if (!dest) throw new Error(`destination ATA ${destinationAta.toBase58()} does not exist; ATAs are created at provisioning, never in a payment`);
  if (!dest.mint.equals(usdcMint)) throw new Error(`destination ATA mint ${dest.mint.toBase58()} is not USDC`);
}

async function usdcInstructions(input: BuildPaymentInput, usdcMint: PublicKey): Promise<TransactionInstruction[]> {
  const buyerAta = getAssociatedTokenAddressSync(usdcMint, input.buyer, true);
  const acct = await input.rpc.getTokenAccount(buyerAta);
  if (!acct) throw new Error("buyer has no USDC token account");
  if (acct.amount < input.amountUsdc) throw new Error(`buyer USDC balance ${acct.amount} below invoice amount ${input.amountUsdc}`);
  const transfer = createTransferCheckedInstruction(buyerAta, usdcMint, input.destinationAta, input.buyer, input.amountUsdc, USDC_DECIMALS);
  transfer.keys.push({ pubkey: input.reference, isSigner: false, isWritable: false });
  return [...computeBudgetInstructions(USDC_TRANSFER_CU_LIMIT, input.cuPriceMicroLamports ?? DEFAULT_CU_PRICE_MICROLAMPORTS), transfer, memoInstruction(input.memo)];
}

/** Rent-exempt minimum of a token account; the buyer fronts it for the temp wSOL account and gets it back in cleanup. */
const WSOL_RENT_LAMPORTS = 2_100_000n;
const SWAP_CU_LIMIT_FALLBACK = 400_000;

const toInstruction = (ix: JupiterInstruction) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(ix.data, "base64"),
  });

async function swapInstructions(
  input: BuildPaymentInput,
  usdcMint: PublicKey,
): Promise<{ ixs: TransactionInstruction[]; luts: AddressLookupTableAccount[]; quote: SwapQuote }> {
  if (!input.jupiter) throw new Error("jupiter client required for swap modes");
  const inputMint = input.mode === "sol" ? SOL_MINT : USDT_MINT;
  const quote = await input.jupiter.quoteExactOut({ inputMint: inputMint.toBase58(), outputMint: usdcMint.toBase58(), amountOut: input.amountUsdc });

  if (input.mode === "sol") {
    const lamports = await input.rpc.getLamports(input.buyer);
    if (lamports < quote.inAmount + WSOL_RENT_LAMPORTS) throw new Error(`buyer SOL balance ${lamports} below quoted input ${quote.inAmount} plus wSOL rent`);
  } else {
    const acct = await input.rpc.getTokenAccount(getAssociatedTokenAddressSync(USDT_MINT, input.buyer, true));
    if (!acct) throw new Error("buyer has no USDT token account");
    if (acct.amount < quote.inAmount) throw new Error(`buyer USDT balance ${acct.amount} below quoted input ${quote.inAmount}`);
  }

  const s = await input.jupiter.swapInstructions({
    quote,
    userPublicKey: input.buyer.toBase58(),
    destinationTokenAccount: input.destinationAta.toBase58(),
    trackingAccount: input.reference.toBase58(),
  });
  const unitLimit = Math.min(s.computeUnitLimit ?? SWAP_CU_LIMIT_FALLBACK, MAX_CU_LIMIT);
  const ixs = [
    ...computeBudgetInstructions(unitLimit, input.cuPriceMicroLamports ?? DEFAULT_CU_PRICE_MICROLAMPORTS), // ours, not Jupiter's: capped price
    ...s.setupInstructions.map(toInstruction),
    toInstruction(s.swapInstruction),
    ...(s.cleanupInstruction ? [toInstruction(s.cleanupInstruction)] : []),
    ...s.otherInstructions.map(toInstruction),
    memoInstruction(input.memo),
  ];
  for (const ix of ixs) {
    if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) && ix.keys.some((k) => k.pubkey.equals(input.destinationAta))) {
      throw new Error("swap instructions would create the destination ATA; it must be pre-provisioned");
    }
  }
  if (!ixs.some((ix) => ix.keys.some((k) => k.pubkey.equals(input.reference)))) {
    // ComputeBudget ignores extra accounts, so the reference can ride there as a read-only key.
    ixs[0]!.keys.push({ pubkey: input.reference, isSigner: false, isWritable: false });
  }
  const luts: AddressLookupTableAccount[] = [];
  for (const addr of s.addressLookupTableAddresses) {
    const lut = await input.rpc.getAddressLookupTable(new PublicKey(addr));
    if (!lut) throw new Error(`lookup table ${addr} not found`);
    luts.push(lut);
  }
  return { ixs, luts, quote: { inputMint: input.mode === "sol" ? "SOL" : "USDT", quotedInput: quote.inAmount, quotedOut: quote.outAmount } };
}

export async function buildPaymentTx(input: BuildPaymentInput): Promise<BuiltPayment> {
  if (input.amountUsdc <= 0n) throw new Error("amount must be positive");
  if (!MEMO_RE.test(input.memo)) throw new Error("memo must be an opaque k_ code");
  const usdcMint = input.usdcMint ?? USDC_MINT;
  await assertDestination(input.rpc, input.destinationAta, usdcMint);

  let ixs: TransactionInstruction[];
  let luts: AddressLookupTableAccount[] = [];
  let quote: SwapQuote | undefined;
  let version = input.txVersion ?? "legacy";
  if (input.mode === "usdc") {
    ixs = await usdcInstructions(input, usdcMint);
  } else {
    ({ ixs, luts, quote } = await swapInstructions(input, usdcMint));
    version = "v0";
  }

  assertFeePayerAbsent(ixs, input.feePayer.publicKey);
  assertComputeBudgetCaps(ixs);
  const { blockhash, lastValidBlockHeight } = await input.rpc.getLatestBlockhash();
  const transaction = version === "legacy" ? signLegacy(ixs, input.feePayer, blockhash, lastValidBlockHeight) : signV0(ixs, luts, input.feePayer, blockhash);
  if (transaction.length > MAX_TX_BYTES) throw new Error(`transaction too large: ${transaction.length} > ${MAX_TX_BYTES} bytes`);
  return { transaction, base64: Buffer.from(transaction).toString("base64"), version, blockhash, lastValidBlockHeight, quote };
}

function signLegacy(ixs: TransactionInstruction[], feePayer: Keypair, blockhash: string, lastValidBlockHeight: number): Uint8Array {
  const tx = new Transaction({ feePayer: feePayer.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
  tx.partialSign(feePayer);
  return tx.serialize({ requireAllSignatures: false });
}

function signV0(ixs: TransactionInstruction[], luts: AddressLookupTableAccount[], feePayer: Keypair, blockhash: string): Uint8Array {
  const msg = new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(luts);
  const tx = new VersionedTransaction(msg);
  tx.sign([feePayer]);
  return tx.serialize();
}
