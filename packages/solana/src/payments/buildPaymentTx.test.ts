import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, Transaction, TransactionMessage, VersionedTransaction, type TransactionInstruction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { COMPUTE_BUDGET_PROGRAM_ID, MEMO_PROGRAM_ID, USDC_MINT } from "../shared/constants";
import { decodeComputeBudget } from "../shared/audit";
import { memoText } from "../shared/memo";
import { buildPaymentTx, type PaymentRpc } from "./buildPaymentTx";
import type { JupiterClient, JupiterInstruction, JupiterSwapInstructions } from "./jupiter";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SOL_MINT, MAX_CU_LIMIT } from "../shared/constants";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const feePayer = Keypair.generate();
const buyer = Keypair.generate().publicKey;
const vault = Keypair.generate().publicKey;
const destinationAta = getAssociatedTokenAddressSync(USDC_MINT, vault, true);
const buyerAta = getAssociatedTokenAddressSync(USDC_MINT, buyer);
const reference = Keypair.generate().publicKey;
const BLOCKHASH = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";

function fakeRpc(accounts: Record<string, { mint: PublicKey; owner: PublicKey; amount: bigint }>, lamports: Record<string, bigint> = {}): PaymentRpc {
  return {
    getTokenAccount: async (a) => accounts[a.toBase58()] ?? null,
    getLamports: async (a) => lamports[a.toBase58()] ?? 0n,
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1000 }),
    getAddressLookupTable: async () => null,
  };
}
const funded = () =>
  fakeRpc({
    [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n },
    [buyerAta.toBase58()]: { mint: USDC_MINT, owner: buyer, amount: 5_000_000n },
  });

const base = () => ({ rpc: funded(), feePayer, buyer, amountUsdc: 100_000n, destinationAta, reference, memo: "k_test0001", mode: "usdc" as const });

function legacyIxs(bytes: Uint8Array): TransactionInstruction[] {
  return Transaction.from(bytes).instructions;
}
function v0Ixs(bytes: Uint8Array): TransactionInstruction[] {
  const tx = VersionedTransaction.deserialize(bytes);
  return TransactionMessage.decompile(tx.message).instructions;
}

describe("buildPaymentTx usdc", () => {
  test("layout: CU limit, CU price, transferChecked (+reference), memo", async () => {
    const built = await buildPaymentTx(base());
    expect(built.version).toBe("legacy");
    const ixs = legacyIxs(built.transaction);
    expect(ixs.map((ix) => ix.programId.toBase58())).toEqual([
      COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
      COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
      TOKEN_PROGRAM.toBase58(),
      MEMO_PROGRAM_ID.toBase58(),
    ]);
    const transfer = ixs[2]!;
    // TransferChecked: source, mint, destination, owner, [reference]
    expect(transfer.keys.map((k) => k.pubkey.toBase58())).toEqual([buyerAta, USDC_MINT, destinationAta, buyer, reference].map((k) => k.toBase58()));
    expect(transfer.keys[4]).toMatchObject({ isSigner: false, isWritable: false });
    expect(transfer.keys[3]).toMatchObject({ isSigner: true });
    const data = Buffer.from(transfer.data);
    expect(data[0]).toBe(12); // TransferChecked
    expect(data.readBigUInt64LE(1)).toBe(100_000n);
    expect(data[9]).toBe(6);
    expect(memoText(ixs[3]!.data)).toBe("k_test0001");
    expect(decodeComputeBudget(ixs)).toEqual({ unitLimit: 30_000, unitPrice: 10_000n });
  });

  test("fee payer is signature 0 and already signed; only the buyer's signature is missing", async () => {
    const built = await buildPaymentTx(base());
    const tx = Transaction.from(built.transaction);
    expect(tx.feePayer?.equals(feePayer.publicKey)).toBe(true);
    expect(tx.signatures.map((s) => s.publicKey.toBase58())).toEqual([feePayer.publicKey.toBase58(), buyer.toBase58()]);
    expect(tx.signatures[0]!.signature).not.toBeNull();
    expect(tx.signatures[1]!.signature).toBeNull();
    expect(tx.recentBlockhash).toBe(BLOCKHASH);
    expect(built.lastValidBlockHeight).toBe(1000);
    expect(built.base64).toBe(Buffer.from(built.transaction).toString("base64"));
  });

  test("fee payer appears in no instruction", async () => {
    const built = await buildPaymentTx(base());
    for (const ix of legacyIxs(built.transaction)) {
      expect(ix.programId.equals(feePayer.publicKey)).toBe(false);
      expect(ix.keys.some((k) => k.pubkey.equals(feePayer.publicKey))).toBe(false);
    }
  });

  test("refuses to sign when the buyer is the fee payer (fee payer would be an instruction account)", async () => {
    const fpAta = getAssociatedTokenAddressSync(USDC_MINT, feePayer.publicKey);
    const rpc = fakeRpc({
      [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n },
      [fpAta.toBase58()]: { mint: USDC_MINT, owner: feePayer.publicKey, amount: 5_000_000n },
    });
    await expect(buildPaymentTx({ ...base(), rpc, buyer: feePayer.publicKey })).rejects.toThrow(/fee payer/);
  });

  test("v0 variant: same instructions, 2 required signatures, fee payer signed", async () => {
    const built = await buildPaymentTx({ ...base(), txVersion: "v0" });
    expect(built.version).toBe("v0");
    const tx = VersionedTransaction.deserialize(built.transaction);
    expect(tx.message.header.numRequiredSignatures).toBe(2);
    expect(tx.message.staticAccountKeys[0]!.equals(feePayer.publicKey)).toBe(true);
    expect(tx.signatures[0]!.some((b) => b !== 0)).toBe(true);
    expect(tx.signatures[1]!.every((b) => b === 0)).toBe(true);
    expect(v0Ixs(built.transaction).map((ix) => ix.programId.toBase58())[2]).toBe(TOKEN_PROGRAM.toBase58());
    expect(built.transaction.length).toBeLessThanOrEqual(1232);
  });

  test("rejects when the destination ATA does not exist (we never create ATAs)", async () => {
    const rpc = fakeRpc({ [buyerAta.toBase58()]: { mint: USDC_MINT, owner: buyer, amount: 5_000_000n } });
    await expect(buildPaymentTx({ ...base(), rpc })).rejects.toThrow(/destination/);
  });

  test("rejects a destination whose mint is not USDC (look-alike)", async () => {
    const fake = Keypair.generate().publicKey;
    const rpc = fakeRpc({
      [destinationAta.toBase58()]: { mint: fake, owner: vault, amount: 0n },
      [buyerAta.toBase58()]: { mint: USDC_MINT, owner: buyer, amount: 5_000_000n },
    });
    await expect(buildPaymentTx({ ...base(), rpc })).rejects.toThrow(/mint/);
  });

  test("rejects a buyer without a USDC token account", async () => {
    const rpc = fakeRpc({ [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n } });
    await expect(buildPaymentTx({ ...base(), rpc })).rejects.toThrow(/no USDC/);
  });

  test("rejects an insufficient USDC balance", async () => {
    await expect(buildPaymentTx({ ...base(), amountUsdc: 5_000_001n })).rejects.toThrow(/balance/);
  });

  test("rejects a non-positive amount", async () => {
    await expect(buildPaymentTx({ ...base(), amountUsdc: 0n })).rejects.toThrow(/amount/);
  });

  test("rejects a memo that is not an opaque k_ code", async () => {
    await expect(buildPaymentTx({ ...base(), memo: "INV-2026-0001 Harbourline" })).rejects.toThrow(/memo/);
  });
});

const JUP_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const jupIx = (programId: string, keys: PublicKey[], opts: { signer?: PublicKey; ro?: PublicKey[] } = {}): JupiterInstruction => ({
  programId,
  accounts: [
    ...keys.map((k) => ({ pubkey: k.toBase58(), isSigner: opts.signer?.equals(k) ?? false, isWritable: true })),
    ...(opts.ro ?? []).map((k) => ({ pubkey: k.toBase58(), isSigner: false, isWritable: false })),
  ],
  data: Buffer.from([1, 2, 3]).toString("base64"),
});

function fakeJupiter(over: Partial<JupiterSwapInstructions> = {}, inAmount = 4_139_555n): JupiterClient & { swapCalls: unknown[] } {
  const wsol = Keypair.generate().publicKey;
  const client = {
    swapCalls: [] as unknown[],
    async quoteExactOut(p: { inputMint: string; outputMint: string; amountOut: bigint }) {
      return { inputMint: p.inputMint, outputMint: p.outputMint, inAmount, outAmount: p.amountOut, raw: { inAmount: inAmount.toString(), outAmount: p.amountOut.toString() } };
    },
    async swapInstructions(p: { trackingAccount: string }) {
      client.swapCalls.push(p);
      return {
        computeBudgetInstructions: [],
        setupInstructions: [jupIx(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), [buyer, wsol], { signer: buyer }), jupIx("11111111111111111111111111111111", [buyer, wsol], { signer: buyer })],
        swapInstruction: jupIx(JUP_PROGRAM, [buyer, wsol, destinationAta], { signer: buyer, ro: [new PublicKey(p.trackingAccount)] }),
        cleanupInstruction: jupIx(TOKEN_PROGRAM.toBase58(), [wsol, buyer], { signer: buyer }),
        otherInstructions: [],
        addressLookupTableAddresses: [],
        computeUnitLimit: 300_000,
        ...over,
      };
    },
  };
  return client;
}

const solBase = () => ({
  ...base(),
  rpc: fakeRpc({ [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n } }, { [buyer.toBase58()]: 100_000_000n }),
  mode: "sol" as const,
  jupiter: fakeJupiter(),
});

describe("buildPaymentTx sol (Jupiter v1 ExactOut)", () => {
  test("layout: CU limit, CU price, setup…, swap (+reference), cleanup, memo; always v0", async () => {
    const jupiter = fakeJupiter();
    const built = await buildPaymentTx({ ...solBase(), jupiter });
    expect(built.version).toBe("v0");
    const ixs = v0Ixs(built.transaction);
    expect(ixs.map((ix) => ix.programId.toBase58())).toEqual([
      COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
      COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
      ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
      "11111111111111111111111111111111",
      JUP_PROGRAM,
      TOKEN_PROGRAM.toBase58(),
      MEMO_PROGRAM_ID.toBase58(),
    ]);
    expect(decodeComputeBudget(ixs)).toEqual({ unitLimit: 300_000, unitPrice: 10_000n });
    const swap = ixs[4]!;
    expect(swap.keys.at(-1)).toMatchObject({ isSigner: false, isWritable: false });
    expect(swap.keys.at(-1)!.pubkey.equals(reference)).toBe(true);
    expect(memoText(ixs[6]!.data)).toBe("k_test0001");
    expect(built.quote).toEqual({ inputMint: "SOL", quotedInput: 4_139_555n, quotedOut: 100_000n });
    expect((jupiter.swapCalls[0] as { trackingAccount: string; destinationTokenAccount: string }).destinationTokenAccount).toBe(destinationAta.toBase58());
    const tx = VersionedTransaction.deserialize(built.transaction);
    expect(tx.message.header.numRequiredSignatures).toBe(2);
    expect(tx.message.staticAccountKeys[0]!.equals(feePayer.publicKey)).toBe(true);
    expect(tx.signatures[0]!.some((b) => b !== 0)).toBe(true);
  });

  test("pins the reference to the CU-limit instruction when Jupiter drops the tracking account", async () => {
    const jupiter = fakeJupiter();
    const orig = jupiter.swapInstructions.bind(jupiter);
    jupiter.swapInstructions = async (p) => {
      const s = await orig(p);
      s.swapInstruction.accounts = s.swapInstruction.accounts.filter((a) => a.pubkey !== p.trackingAccount);
      return s;
    };
    const ixs = v0Ixs((await buildPaymentTx({ ...solBase(), jupiter })).transaction);
    expect(ixs[0]!.keys.map((k) => k.pubkey.toBase58())).toEqual([reference.toBase58()]);
    expect(ixs.filter((ix) => ix.keys.some((k) => k.pubkey.equals(reference)))).toHaveLength(1);
  });

  test("USDT mode uses the USDT mint as input and reports it in the quote", async () => {
    const usdtAta = getAssociatedTokenAddressSync(new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), buyer);
    const rpc = fakeRpc({
      [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n },
      [usdtAta.toBase58()]: { mint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), owner: buyer, amount: 1_000_000n },
    });
    const built = await buildPaymentTx({ ...solBase(), rpc, mode: "usdt", jupiter: fakeJupiter({}, 100_500n) });
    expect(built.quote).toEqual({ inputMint: "USDT", quotedInput: 100_500n, quotedOut: 100_000n });
  });

  test("rejects when the buyer cannot cover the quoted SOL input plus wSOL rent", async () => {
    const rpc = fakeRpc({ [destinationAta.toBase58()]: { mint: USDC_MINT, owner: vault, amount: 0n } }, { [buyer.toBase58()]: 4_139_555n });
    await expect(buildPaymentTx({ ...solBase(), rpc })).rejects.toThrow(/SOL balance/);
  });

  test("rejects Jupiter instructions that reference the fee payer", async () => {
    const jupiter = fakeJupiter({ otherInstructions: [jupIx("11111111111111111111111111111111", [feePayer.publicKey, buyer])] });
    await expect(buildPaymentTx({ ...solBase(), jupiter })).rejects.toThrow(/fee payer/);
  });

  test("rejects Jupiter instructions that would create the destination ATA", async () => {
    const jupiter = fakeJupiter({ setupInstructions: [jupIx(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), [buyer, destinationAta], { signer: buyer })] });
    await expect(buildPaymentTx({ ...solBase(), jupiter })).rejects.toThrow(/destination/);
  });

  test("clamps Jupiter's compute unit limit to the cap", async () => {
    const ixs = v0Ixs((await buildPaymentTx({ ...solBase(), jupiter: fakeJupiter({ computeUnitLimit: 9_000_000 }) })).transaction);
    expect(decodeComputeBudget(ixs).unitLimit).toBe(MAX_CU_LIMIT);
  });

  test("resolves Jupiter's lookup tables through the rpc and fails if one is missing", async () => {
    const lut = Keypair.generate().publicKey;
    const jupiter = fakeJupiter({ addressLookupTableAddresses: [lut.toBase58()] });
    await expect(buildPaymentTx({ ...solBase(), jupiter })).rejects.toThrow(/lookup table/);
  });

  test("requires a Jupiter client in swap modes", async () => {
    await expect(buildPaymentTx({ ...solBase(), jupiter: undefined })).rejects.toThrow(/jupiter/i);
  });

  test("SOL_MINT constant is wrapped SOL", () => {
    expect(SOL_MINT.toBase58()).toBe("So11111111111111111111111111111111111111112");
  });
});
