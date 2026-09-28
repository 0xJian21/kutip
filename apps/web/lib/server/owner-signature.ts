/**
 * "Approve with Touch ID" for things that are not on-chain moves (whitelisting a cash-out
 * address, approving the agent's permissions). The owner's Privy wallet signs a small
 * transaction it can never send: payer = the owner, one Memo instruction carrying a
 * dated plain-English statement, and an all-zero blockhash. Signing a transaction is the
 * path Privy's embedded wallet already proves on-chain (approvals), and MFA prompts
 * Touch ID / Face ID for it. The server checks the Ed25519 signature over the message
 * bytes against the session's registered owner wallet, that the statement names this
 * exporter and purpose, and that it is fresh. Pure, so it is testable.
 */
import { createPublicKey, verify } from "node:crypto";
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
export const STATEMENT_MAX_AGE_MS = 10 * 60_000;
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
/** Not a real blockhash: the network will never accept this transaction. */
const NEVER_BLOCKHASH = "11111111111111111111111111111111";

export function ownerStatement(p: { exporterId: string; purpose: string; at: Date }): string {
  return `Kutip · ${p.exporterId} · ${p.purpose} · ${p.at.toISOString()}`;
}

/** Unsigned statement transaction, base64, for the owner to sign client-side. */
export function statementTransaction(p: { owner: PublicKey; statement: string }): string {
  const memo = new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(p.statement, "utf8") });
  const msg = new TransactionMessage({ payerKey: p.owner, recentBlockhash: NEVER_BLOCKHASH, instructions: [memo] }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

type Check = { wallet: string | undefined; signedTransaction: string; exporterId: string; purpose: string; now?: Date };
type Verified = { ok: true; message: string; signature: string };

/** Why a signed statement was rejected (public data only), or the verified statement. */
function check(p: Check): Verified | string {
  try {
    if (!p.wallet) return "session has no owner wallet";
    const tx = VersionedTransaction.deserialize(Buffer.from(p.signedTransaction, "base64"));
    const keys = tx.message.staticAccountKeys;
    const owner = new PublicKey(p.wallet);
    if (!keys[0]?.equals(owner)) return `payer ${keys[0]?.toBase58()} is not the session wallet`;
    if (tx.message.recentBlockhash !== NEVER_BLOCKHASH) return "statement transaction has a real blockhash";
    const ixs = tx.message.compiledInstructions;
    if (ixs.length !== 1 || !keys[ixs[0]!.programIdIndex]?.equals(MEMO_PROGRAM) || ixs[0]!.accountKeyIndexes.length !== 0) return "not a single memo instruction";
    const message = Buffer.from(ixs[0]!.data).toString("utf8");
    const parts = message.split(" · ");
    if (parts.length < 4 || parts[0] !== "Kutip") return `statement shape: ${parts.length} parts`;
    if (parts[1] !== p.exporterId) return `exporter ${parts[1]} ≠ ${p.exporterId}`;
    const purpose = parts.slice(2, -1).join(" · ");
    if (purpose !== p.purpose) return `purpose "${purpose}" ≠ "${p.purpose}"`;
    const at = Date.parse(parts.at(-1)!);
    const now = (p.now ?? new Date()).getTime();
    if (!Number.isFinite(at) || now - at > STATEMENT_MAX_AGE_MS || at - now > 60_000) return `stale statement (${parts.at(-1)})`;
    const sig = Buffer.from(tx.signatures[0] ?? []);
    if (sig.length !== 64 || sig.every((b) => b === 0)) return "owner signature missing";
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(owner.toBytes())]), format: "der", type: "spki" });
    if (!verify(null, Buffer.from(tx.message.serialize()), key, sig)) return `signature does not verify for wallet ${p.wallet}`;
    return { ok: true, message, signature: bs58.encode(sig) };
  } catch (e) {
    return `check threw: ${(e as Error).message}`;
  }
}

export function explainOwnerStatement(p: Check): string | null {
  const r = check(p);
  return typeof r === "string" ? r : null;
}

export function verifyOwnerStatement(p: Check): Verified | { ok: false; reason: string } {
  const r = check(p);
  return typeof r === "string" ? { ok: false, reason: r } : r;
}
