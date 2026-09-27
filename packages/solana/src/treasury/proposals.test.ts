import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { describe, expect, it } from "vitest";
import { deriveAccounts } from "./provision";
import { decodeUsdcTransfer, proposalInstructions, transferMessage } from "./proposals";

const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const agent = Keypair.generate().publicKey;
const feePayer = Keypair.generate().publicKey;
const treasury = deriveAccounts(Keypair.generate().publicKey, usdc);
const cashOut = Keypair.generate().publicKey;
const blockhash = "11111111111111111111111111111111";

describe("transferMessage", () => {
  it("is one USDC transferChecked from the treasury vault ATA to the destination's ATA, signed by the vault", () => {
    const msg = transferMessage({ vault: treasury, destinationOwner: cashOut, usdcMint: usdc, amountUsdc: 250_000n, blockhash });
    expect(msg).toBeInstanceOf(TransactionMessage);
    expect(msg.payerKey.equals(treasury.vaultPda)).toBe(true);
    expect(msg.instructions).toHaveLength(1);
    const ix = msg.instructions[0]!;
    expect(ix.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.keys[0]!.pubkey.equals(treasury.vaultAta)).toBe(true);
    expect(ix.keys[2]!.pubkey.equals(getAssociatedTokenAddressSync(usdc, cashOut, true))).toBe(true);
    expect(ix.keys[3]!.pubkey.equals(treasury.vaultPda)).toBe(true);
    expect(ix.keys[3]!.isSigner).toBe(true);
  });
  it("refuses a zero amount", () => {
    expect(() => transferMessage({ vault: treasury, destinationOwner: cashOut, usdcMint: usdc, amountUsdc: 0n, blockhash })).toThrow(/positive/);
  });
});

describe("proposalInstructions", () => {
  it("is vaultTransactionCreate + proposalCreate, created by the agent, rent paid by the fee payer", () => {
    const msg = transferMessage({ vault: treasury, destinationOwner: cashOut, usdcMint: usdc, amountUsdc: 250_000n, blockhash });
    const ixs = proposalInstructions({ multisigPda: treasury.multisigPda, transactionIndex: 3n, creator: agent, rentPayer: feePayer, message: msg, memo: "k_cashout" });
    expect(ixs).toHaveLength(2);
    for (const ix of ixs) {
      expect(ix.programId.equals(multisig.PROGRAM_ID)).toBe(true);
      const signers = ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
      expect(signers).toEqual(expect.arrayContaining([agent.toBase58(), feePayer.toBase58()]));
    }
    const [transactionPda] = multisig.getTransactionPda({ multisigPda: treasury.multisigPda, index: 3n });
    const [proposalPda] = multisig.getProposalPda({ multisigPda: treasury.multisigPda, transactionIndex: 3n });
    expect(ixs[0]!.keys.some((k) => k.pubkey.equals(transactionPda))).toBe(true);
    expect(ixs[1]!.keys.some((k) => k.pubkey.equals(proposalPda))).toBe(true);
  });
});

describe("decodeUsdcTransfer", () => {
  it("reads destination ATA and amount from the account-layout VaultTransactionMessage the program stores", () => {
    const msg = transferMessage({ vault: treasury, destinationOwner: cashOut, usdcMint: usdc, amountUsdc: 250_000n, blockhash });
    // Same compilation the program performs on vaultTransactionCreate, then the account's borsh layout.
    const legacy = msg.compileToLegacyMessage();
    const stored = {
      numSigners: legacy.header.numRequiredSignatures,
      numWritableSigners: legacy.header.numRequiredSignatures - legacy.header.numReadonlySignedAccounts,
      numWritableNonSigners: legacy.accountKeys.length - legacy.header.numRequiredSignatures - legacy.header.numReadonlyUnsignedAccounts,
      accountKeys: legacy.accountKeys,
      instructions: legacy.compiledInstructions.map((ix) => ({ programIdIndex: ix.programIdIndex, accountIndexes: Uint8Array.from(ix.accountKeyIndexes), data: Uint8Array.from(ix.data) })),
      addressTableLookups: [],
    };
    const beet = multisig.generated.vaultTransactionMessageBeet.toFixedFromValue(stored);
    const buf = Buffer.alloc(beet.byteSize);
    beet.write(buf, 0, stored);
    const decodedMsg = beet.read(buf, 0);
    expect(decodeUsdcTransfer(decodedMsg)).toEqual({
      destinationAta: getAssociatedTokenAddressSync(usdc, cashOut, true).toBase58(),
      amountUsdc: 250_000n,
    });
  });
  it("returns null for a message that is not a single token transfer", () => {
    const msg = { numSigners: 1, numWritableSigners: 1, numWritableNonSigners: 0, accountKeys: [treasury.vaultPda], instructions: [], addressTableLookups: [] };
    expect(decodeUsdcTransfer(msg)).toBeNull();
  });
});
