import { ASSOCIATED_TOKEN_PROGRAM_ID, createTransferCheckedInstruction, createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { USDC_MINT, X402_MAX_CU_LIMIT, X402_MAX_CU_PRICE_MICROLAMPORTS } from "../shared/constants";
import { memoInstruction } from "../shared/memo";
import {
  buildX402ClientTransaction,
  decodeHeader,
  encodeHeader,
  LIGHTHOUSE_PROGRAM_ID,
  paymentRequired,
  paymentRequirements,
  ReplayCache,
  settleX402,
  SOLANA_MAINNET,
  verifyX402,
  type PaymentPayload,
  type X402Rpc,
} from "./x402";

const feePayer = Keypair.generate();
const client = Keypair.generate();
const payTo = Keypair.generate().publicKey; // buyer vault PDA
const destAta = getAssociatedTokenAddressSync(USDC_MINT, payTo, true);
const clientAta = getAssociatedTokenAddressSync(USDC_MINT, client.publicKey);
const BLOCKHASH = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
const reference = Keypair.generate().publicKey;

const reqs = () =>
  paymentRequirements({ amountUsdc: 100_000n, payTo: payTo.toBase58(), feePayer: feePayer.publicKey.toBase58(), memo: "k_test0001", reference: reference.toBase58() });

function fakeRpc(over: Partial<X402Rpc> = {}): X402Rpc & { sent: Uint8Array[] } {
  const rpc = {
    sent: [] as Uint8Array[],
    getAddressLookupTable: async () => null,
    simulateTransaction: async () => ({ err: null }),
    sendRawTransaction: async (bytes: Uint8Array) => {
      rpc.sent.push(bytes);
      return "5".repeat(88);
    },
    confirmTransaction: async () => ({ slot: 1, err: null }),
    ...over,
  };
  return rpc;
}

/** A client payload with custom instructions, signed by `signer` (default: the client). */
function payloadWith(ixs: TransactionInstruction[], opts: { signer?: Keypair; payer?: PublicKey; extraSigner?: Keypair } = {}): PaymentPayload {
  const msg = new TransactionMessage({ payerKey: opts.payer ?? feePayer.publicKey, recentBlockhash: BLOCKHASH, instructions: ixs }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  const signers = [opts.signer ?? client, ...(opts.extraSigner ? [opts.extraSigner] : [])];
  try {
    tx.sign(signers);
  } catch {
    /* unsigned variants */
  }
  return { x402Version: 2, accepted: reqs(), payload: { transaction: Buffer.from(tx.serialize()).toString("base64") } };
}
const cu = (limit = 20_000, price = 1) => [ComputeBudgetProgram.setComputeUnitLimit({ units: limit }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: price })];
const transfer = (amount = 100_000n, dest = destAta, mint = USDC_MINT, decimals = 6) => createTransferCheckedInstruction(clientAta, mint, dest, client.publicKey, amount, decimals);
const good = () => [...cu(), transfer(), memoInstruction("k_test0001")];
const lighthouse = () => new TransactionInstruction({ programId: LIGHTHOUSE_PROGRAM_ID, keys: [{ pubkey: client.publicKey, isSigner: false, isWritable: false }], data: Buffer.from([0]) });

const verify = (payload: PaymentPayload, over: { rpc?: X402Rpc; replay?: ReplayCache; requirements?: ReturnType<typeof reqs> } = {}) =>
  verifyX402({ payload, requirements: over.requirements ?? reqs(), feePayer: feePayer.publicKey, rpc: over.rpc ?? fakeRpc(), replay: over.replay ?? new ReplayCache() });

async function expectReason(payload: PaymentPayload, re: RegExp, over: Parameters<typeof verify>[1] = {}) {
  const r = await verify(payload, over);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(`${r.reason}: ${r.message}`).toMatch(re);
}

describe("x402 headers and requirements", () => {
  test("PaymentRequired shape: v2, exact, solana mainnet CAIP-2, USDC, payTo vault, feePayer + memo in extra", () => {
    const pr = paymentRequired({ resource: { url: "https://kutip.test/api/x402/invoice/inv_1", description: "Invoice INV-2026-0001", mimeType: "application/json" }, accepts: [reqs()] });
    expect(pr.x402Version).toBe(2);
    expect(pr.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      amount: "100000",
      asset: USDC_MINT.toBase58(),
      payTo: payTo.toBase58(),
      maxTimeoutSeconds: 60,
      extra: { feePayer: feePayer.publicKey.toBase58(), memo: "k_test0001", reference: reference.toBase58() },
    });
    expect(SOLANA_MAINNET).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  });
  test("headers are base64 JSON round-trips", () => {
    const pr = paymentRequired({ resource: { url: "https://x" }, accepts: [reqs()] });
    expect(decodeHeader(encodeHeader(pr))).toEqual(pr);
    expect(() => decodeHeader("not-base64-json")).toThrow();
  });
});

describe("buildX402ClientTransaction (what a bot sends)", () => {
  test("produces a payload the facilitator accepts", async () => {
    const payload = buildX402ClientTransaction({ requirements: reqs(), client, blockhash: BLOCKHASH });
    const r = await verify(payload);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payer).toBe(client.publicKey.toBase58());
  });
  test("carries the reference as a trailing read-only key on the transfer", async () => {
    const payload = buildX402ClientTransaction({ requirements: reqs(), client, blockhash: BLOCKHASH });
    const tx = VersionedTransaction.deserialize(Buffer.from(payload.payload.transaction, "base64"));
    const ixs = TransactionMessage.decompile(tx.message).instructions;
    expect(ixs[2]!.keys.at(-1)!.pubkey.equals(reference)).toBe(true);
    expect(ixs[2]!.keys.at(-1)).toMatchObject({ isSigner: false, isWritable: false });
  });
});

describe("verifyX402: every rule has a negative case", () => {
  test("accepts the canonical layout", async () => {
    expect((await verify(payloadWith(good()))).ok).toBe(true);
  });
  test("accepts wallet-injected Lighthouse instructions (up to 3) around the memo", async () => {
    expect((await verify(payloadWith([...cu(), transfer(), lighthouse(), lighthouse(), lighthouse(), memoInstruction("k_test0001")]))).ok).toBe(true);
  });
  test("rejects x402Version != 2", () => expectReason({ ...payloadWith(good()), x402Version: 1 } as unknown as PaymentPayload, /version/));
  test("rejects a non-exact scheme", () => {
    const p = payloadWith(good());
    return expectReason({ ...p, accepted: { ...p.accepted, scheme: "upto" as "exact" } }, /scheme/);
  });
  test("rejects a network mismatch", () => {
    const p = payloadWith(good());
    return expectReason({ ...p, accepted: { ...p.accepted, network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" } }, /network/);
  });
  test("rejects tampered accepted requirements (amount)", () => {
    const p = payloadWith(good());
    return expectReason({ ...p, accepted: { ...p.accepted, amount: "1" } }, /requirements/);
  });
  test("rejects a fee payer that is not ours", () => expectReason(payloadWith(good(), { payer: client.publicKey }), /fee payer/));
  test("rejects a missing client signature", () => expectReason(payloadWith(good(), { signer: Keypair.generate() }), /signature/));
  test("rejects a tampered message", async () => {
    const p = payloadWith(good());
    const bytes = Buffer.from(p.payload.transaction, "base64");
    const at = bytes.indexOf(Buffer.from("k_test0001")); // flip a memo byte after signing
    bytes[at] = bytes[at]! ^ 0xff;
    await expectReason({ ...p, payload: { transaction: bytes.toString("base64") } }, /signature/);
  });
  test("rejects a third required signer", () => expectReason(payloadWith([...good(), SystemProgram.transfer({ fromPubkey: Keypair.generate().publicKey, toPubkey: client.publicKey, lamports: 1 })]), /signers|instruction/));
  test("rejects fewer than 3 instructions", () => expectReason(payloadWith([cu()[0]!, transfer()]), /instructions/));
  test("rejects more than 7 instructions", () => expectReason(payloadWith([...cu(), transfer(), lighthouse(), lighthouse(), lighthouse(), lighthouse(), memoInstruction("k_test0001")]), /instructions/));
  test("rejects when instruction 0 is not SetComputeUnitLimit", () => expectReason(payloadWith([cu()[1]!, cu()[0]!, transfer(), memoInstruction("k_test0001")]), /SetComputeUnitLimit/));
  test("rejects when instruction 1 is not SetComputeUnitPrice", () => expectReason(payloadWith([cu()[0]!, memoInstruction("x"), transfer(), memoInstruction("k_test0001")]), /SetComputeUnitPrice/));
  test("rejects a compute unit price above the cap", () => expectReason(payloadWith([...cu(20_000, X402_MAX_CU_PRICE_MICROLAMPORTS + 1), transfer(), memoInstruction("k_test0001")]), /price/));
  test("x402 caps are tight: a failed settle costs the fee payer at most ~12k lamports", () => {
    expect(X402_MAX_CU_LIMIT).toBeLessThanOrEqual(200_000);
    expect(X402_MAX_CU_PRICE_MICROLAMPORTS).toBeLessThanOrEqual(10_000);
  });
  test("rejects a compute unit limit above the cap", () => expectReason(payloadWith([...cu(X402_MAX_CU_LIMIT + 1, 1), transfer(), memoInstruction("k_test0001")]), /limit/));
  test("rejects a plain Transfer instead of TransferChecked", () => expectReason(payloadWith([...cu(), createTransferInstruction(clientAta, destAta, client.publicKey, 100_000n), memoInstruction("k_test0001")]), /TransferChecked/));
  test("rejects a look-alike mint", () => {
    const fake = Keypair.generate().publicKey;
    return expectReason(payloadWith([...cu(), transfer(100_000n, getAssociatedTokenAddressSync(fake, payTo, true), fake), memoInstruction("k_test0001")]), /mint/);
  });
  test("rejects a destination that is not ATA(payTo, USDC)", () => expectReason(payloadWith([...cu(), transfer(100_000n, getAssociatedTokenAddressSync(USDC_MINT, Keypair.generate().publicKey)), memoInstruction("k_test0001")]), /recipient/));
  test("rejects an amount below the invoice", () => expectReason(payloadWith([...cu(), transfer(99_999n), memoInstruction("k_test0001")]), /amount/));
  test("rejects an amount above the invoice (exact scheme)", () => expectReason(payloadWith([...cu(), transfer(100_001n), memoInstruction("k_test0001")]), /amount/));
  test("rejects wrong decimals", () => expectReason(payloadWith([...cu(), transfer(100_000n, destAta, USDC_MINT, 9), memoInstruction("k_test0001")]), /decimals/));
  test("rejects the fee payer as an instruction account (read-only)", () => {
    const t = transfer();
    t.keys.push({ pubkey: feePayer.publicKey, isSigner: false, isWritable: false });
    return expectReason(payloadWith([...cu(), t, memoInstruction("k_test0001")]), /fee payer/);
  });
  test("rejects the fee payer as the transfer authority", () => {
    const fpAta = getAssociatedTokenAddressSync(USDC_MINT, feePayer.publicKey);
    const t = createTransferCheckedInstruction(fpAta, USDC_MINT, destAta, feePayer.publicKey, 100_000n, 6);
    return expectReason(payloadWith([...cu(), t, memoInstruction("k_test0001")], { signer: feePayer }), /fee payer/);
  });
  test("rejects the fee payer as a program id", () => {
    const ix = new TransactionInstruction({ programId: feePayer.publicKey, keys: [], data: Buffer.alloc(0) });
    return expectReason(payloadWith([...cu(), transfer(), ix, memoInstruction("k_test0001")]), /fee payer|program/);
  });
  test("rejects a missing memo when extra.memo is set", () => expectReason(payloadWith([...cu(), transfer()]), /memo/));
  test("rejects a memo mismatch", () => expectReason(payloadWith([...cu(), transfer(), memoInstruction("k_other001")]), /memo/));
  test("rejects two memos", () => expectReason(payloadWith([...cu(), transfer(), memoInstruction("k_test0001"), memoInstruction("k_test0001")]), /memo/));
  test("rejects a program outside Lighthouse/Memo after the transfer", () => expectReason(payloadWith([...cu(), transfer(), SystemProgram.transfer({ fromPubkey: client.publicKey, toPubkey: payTo, lamports: 1 }), memoInstruction("k_test0001")]), /program/));
  test("rejects an unresolvable address lookup table", async () => {
    const lut = { key: Keypair.generate().publicKey, state: { deactivationSlot: 0n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, addresses: [destAta, clientAta] } };
    const { AddressLookupTableAccount } = await import("@solana/web3.js");
    const account = new AddressLookupTableAccount(lut);
    const msg = new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: BLOCKHASH, instructions: good() }).compileToV0Message([account]);
    const tx = new VersionedTransaction(msg);
    tx.sign([client]);
    const payload = { x402Version: 2 as const, accepted: reqs(), payload: { transaction: Buffer.from(tx.serialize()).toString("base64") } };
    expect(tx.message.addressTableLookups.length).toBe(1);
    await expectReason(payload, /lookup table/);
    const r = await verify(payload, { rpc: fakeRpc({ getAddressLookupTable: async () => account }) });
    expect(r.ok).toBe(true);
  });
  test("rejects when simulation fails", () => expectReason(payloadWith(good()), /simulation/, { rpc: fakeRpc({ simulateTransaction: async () => ({ err: { InstructionError: [2, "Custom"] } }) }) }));
  test("rejects a replayed transaction (same message bytes)", async () => {
    const replay = new ReplayCache();
    const p = payloadWith(good());
    expect((await verify(p, { replay })).ok).toBe(true);
    await expectReason(p, /duplicate/, { replay });
  });
  test("rejects garbage transaction bytes", () => expectReason({ ...payloadWith(good()), payload: { transaction: "AAAA" } }, /decode|transaction/));
  test("ATA program is never allowed (no ATA creation in a payment)", () => {
    const ix = new TransactionInstruction({ programId: ASSOCIATED_TOKEN_PROGRAM_ID, keys: [], data: Buffer.alloc(0) });
    return expectReason(payloadWith([...cu(), transfer(), ix, memoInstruction("k_test0001")]), /program/);
  });
});

describe("settleX402", () => {
  test("co-signs as fee payer, sends the fully signed bytes, confirms and returns the receipt", async () => {
    const rpc = fakeRpc();
    const v = await verify(payloadWith(good()), { rpc });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const s = await settleX402({ verified: v, feePayer, rpc });
    expect(s).toEqual({ success: true, transaction: "5".repeat(88), network: SOLANA_MAINNET, payer: client.publicKey.toBase58() });
    const sent = VersionedTransaction.deserialize(rpc.sent[0]!);
    expect(sent.signatures.every((sig) => sig.some((b) => b !== 0))).toBe(true);
    expect(sent.message.staticAccountKeys[0]!.equals(feePayer.publicKey)).toBe(true);
  });
  test("reports a send failure without a signature, and without the RPC error text (it can carry the RPC URL + key)", async () => {
    const rpc = fakeRpc({ sendRawTransaction: async () => { throw new Error("request to https://rpc.example/?api_key=SECRET failed"); } });
    const v = await verify(payloadWith(good()), { rpc });
    if (!v.ok) throw new Error("expected valid");
    const s = await settleX402({ verified: v, feePayer, rpc });
    expect(s).toMatchObject({ success: false, transaction: "", errorReason: "send_failed" });
    expect(JSON.stringify(s)).not.toContain("SECRET");
  });
  test("reports an on-chain failure with the signature", async () => {
    const rpc = fakeRpc({ confirmTransaction: async () => ({ slot: 5, err: { InstructionError: [2, "Custom"] } }) });
    const v = await verify(payloadWith(good()), { rpc });
    if (!v.ok) throw new Error("expected valid");
    const s = await settleX402({ verified: v, feePayer, rpc });
    expect(s).toMatchObject({ success: false, transaction: "5".repeat(88), errorReason: expect.stringMatching(/failed/) });
  });
});
