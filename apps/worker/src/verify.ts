/**
 * Payment verification (SPEC F6). Pure: a transaction view + what the invoice expects → verdict.
 * Two input shapes, one view: Yellowstone gRPC updates (live) and raw `getTransaction` JSON (backfill).
 * We never use getParsedTransaction (web3.js chokes on Solami's `stackHeight`, Spike C).
 */
import { formatUsdc } from "@kutip/agent";
import type { SubscribeUpdateTransactionInfo } from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";

const MEMO_PROGRAMS = ["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"];
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

type TokenBalance = { accountIndex: number; mint: string; owner: string; amount: bigint };

export type TxView = {
  signature: string;
  slot: number;
  failed: boolean;
  /** Static keys, then ALT-loaded writable, then ALT-loaded readonly (the order balances index into). */
  accountKeys: string[];
  numSigners: number;
  instructions: Array<{ programId: string; data: Uint8Array }>;
  preBalances: bigint[];
  postBalances: bigint[];
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
};

/** `getTransaction(sig, { encoding: "json", maxSupportedTransactionVersion: 0 })` result. */
export type RpcTransaction = {
  slot: number;
  version?: "legacy" | number;
  transaction: {
    signatures: string[];
    message: {
      header: { numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number };
      accountKeys: string[];
      instructions: Array<{ programIdIndex: number; accounts: number[]; data: string }>;
    };
  };
  meta: {
    err: unknown;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }>;
    postTokenBalances: Array<{ accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }>;
    loadedAddresses?: { writable: string[]; readonly: string[] };
  };
};

export function fromRpc(tx: RpcTransaction): TxView {
  const m = tx.transaction.message;
  const keys = [...m.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const tb = (b: RpcTransaction["meta"]["preTokenBalances"][number]): TokenBalance => ({
    accountIndex: b.accountIndex,
    mint: b.mint,
    owner: b.owner ?? "",
    amount: BigInt(b.uiTokenAmount.amount),
  });
  return {
    signature: tx.transaction.signatures[0]!,
    slot: tx.slot,
    failed: tx.meta.err != null,
    accountKeys: keys,
    numSigners: m.header.numRequiredSignatures,
    instructions: m.instructions.map((ix) => ({ programId: keys[ix.programIdIndex]!, data: bs58.decode(ix.data) })),
    preBalances: tx.meta.preBalances.map(BigInt),
    postBalances: tx.meta.postBalances.map(BigInt),
    preTokenBalances: tx.meta.preTokenBalances.map(tb),
    postTokenBalances: tx.meta.postTokenBalances.map(tb),
  };
}

export function fromGrpc(slot: number | string, info: SubscribeUpdateTransactionInfo): TxView {
  const m = info.transaction?.message;
  const meta = info.meta;
  if (!m || !meta) throw new Error("transaction update without message or meta");
  const keys = [...m.accountKeys, ...meta.loadedWritableAddresses, ...meta.loadedReadonlyAddresses].map((k) => bs58.encode(k));
  const tb = (b: (typeof meta.preTokenBalances)[number]): TokenBalance => ({
    accountIndex: b.accountIndex,
    mint: b.mint,
    owner: b.owner,
    amount: BigInt(b.uiTokenAmount?.amount ?? "0"),
  });
  return {
    signature: bs58.encode(info.signature),
    slot: Number(slot),
    failed: meta.err !== undefined,
    accountKeys: keys,
    numSigners: m.header?.numRequiredSignatures ?? 1,
    instructions: m.instructions.map((ix) => ({ programId: keys[ix.programIdIndex]!, data: Uint8Array.from(ix.data) })),
    preBalances: meta.preBalances.map(BigInt),
    postBalances: meta.postBalances.map(BigInt),
    preTokenBalances: meta.preTokenBalances.map(tb),
    postTokenBalances: meta.postTokenBalances.map(tb),
  };
}

/** What the invoice expects (a subset of @kutip/db PaymentTarget). */
export type Target = { amountUsdc: bigint; receivedUsdc: bigint; memoCode: string; vault: string; vaultUsdcAta: string };
export type Quote = { inputMint: "SOL" | "USDT"; quotedInput: bigint; quotedOut: bigint };

export type Verification = {
  verified: boolean;
  issues: string[];
  /** USDC base units credited to the buyer vault ATA. */
  amount: bigint;
  payer: string;
  inputMint?: "SOL" | "USDT";
  inputAmount?: bigint;
  quotedInput?: bigint;
  quotedOut?: bigint;
};

/** Token balance change per account index (post − pre). */
function tokenDeltas(tx: TxView): Array<TokenBalance & { delta: bigint }> {
  const pre = new Map(tx.preTokenBalances.map((b) => [b.accountIndex, b]));
  const post = new Map(tx.postTokenBalances.map((b) => [b.accountIndex, b]));
  const indexes = new Set([...pre.keys(), ...post.keys()]);
  return [...indexes].map((i) => {
    const b = (post.get(i) ?? pre.get(i))!;
    return { ...b, delta: (post.get(i)?.amount ?? 0n) - (pre.get(i)?.amount ?? 0n) };
  });
}

export function memosOf(tx: TxView): string[] {
  return tx.instructions.filter((ix) => MEMO_PROGRAMS.includes(ix.programId)).map((ix) => Buffer.from(ix.data).toString("utf8"));
}

export function verifyPayment(tx: TxView, target: Target, opts: { usdcMint: string; quote?: Quote | null }): Verification {
  const issues: string[] = [];
  // Kutip is always the fee payer (signer 0) on txs we build, so the buyer is the next signer.
  const payer = tx.accountKeys[tx.numSigners > 1 ? 1 : 0]!;
  if (tx.failed) return { verified: false, issues: ["Transaction failed on-chain"], amount: 0n, payer };

  const deltas = tokenDeltas(tx);
  for (const d of deltas) {
    if (d.delta > 0n && d.owner === target.vault && d.mint !== opts.usdcMint) issues.push(`Look-alike token ${d.mint} sent instead of USDC`);
  }
  const credit = deltas.find((d) => tx.accountKeys[d.accountIndex] === target.vaultUsdcAta && d.mint === opts.usdcMint && d.delta > 0n);
  if (!credit) return { verified: false, issues: [...issues, "No USDC reached the buyer vault"], amount: 0n, payer };
  if (credit.owner !== target.vault) issues.push(`Destination account is owned by ${credit.owner}, not the buyer vault`);

  const memos = memosOf(tx);
  if (!memos.includes(target.memoCode)) {
    issues.push(memos.length ? `Memo "${memos.join(", ")}" does not match ${target.memoCode}` : `Memo ${target.memoCode} is missing`);
  }
  const verified = issues.length === 0;

  const amount = credit.delta;
  const due = target.amountUsdc - target.receivedUsdc;
  if (amount < due) issues.push(`Amount is less than the invoice total: ${formatUsdc(amount)} received, ${formatUsdc(due)} due`);
  if (amount > due) issues.push(`Amount is more than the invoice total: ${formatUsdc(amount)} received, ${formatUsdc(due)} due`);

  const result: Verification = { verified, issues, amount, payer };
  // Paid in USDC directly if the payer's own USDC went down; otherwise it was a swap.
  const payerUsdcOut = deltas.some((d) => d.owner === payer && d.mint === opts.usdcMint && d.delta < 0n);
  if (!payerUsdcOut) {
    const usdtOut = deltas.find((d) => d.owner === payer && d.mint === USDT_MINT && d.delta < 0n);
    const payerIndex = tx.accountKeys.indexOf(payer);
    const lamportsOut = tx.preBalances[payerIndex]! - tx.postBalances[payerIndex]!;
    if (usdtOut) Object.assign(result, { inputMint: "USDT", inputAmount: -usdtOut.delta });
    else if (lamportsOut > 0n) Object.assign(result, { inputMint: "SOL", inputAmount: lamportsOut });
    if (result.inputMint && opts.quote?.inputMint === result.inputMint) {
      Object.assign(result, { quotedInput: opts.quote.quotedInput, quotedOut: opts.quote.quotedOut });
    }
  }
  return result;
}
