import { Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { describe, expect, it } from "vitest";
import { limitCreateKeyFor, spendingLimitPdaFor } from "./provision";
import { limitVersionKeyFor, rejectProposalInstructions, spendingLimitChangeInstructions } from "./permissions";

const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const owner = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const feePayer = Keypair.generate().publicKey;
const multisigPda = Keypair.generate().publicKey;
const treasuryVaultPda = Keypair.generate().publicKey;
const treasuryVaultAta = Keypair.generate().publicKey;
const secret = new Uint8Array(64).fill(5);

const signers = (ix: { keys: Array<{ pubkey: PublicKey; isSigner: boolean }> }) => ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
const has = (ix: { keys: Array<{ pubkey: PublicKey }> }, k: PublicKey) => ix.keys.some((x) => x.pubkey.equals(k));

describe("limitVersionKeyFor", () => {
  it("differs from the provisioning create key and per amount, so a changed cap gets a fresh SpendingLimit PDA", () => {
    const original = limitCreateKeyFor(secret, multisigPda).publicKey;
    const v1 = limitVersionKeyFor(secret, multisigPda, 3_000_000_000n).publicKey;
    const v2 = limitVersionKeyFor(secret, multisigPda, 4_000_000_000n).publicKey;
    expect(v1.equals(original)).toBe(false);
    expect(v1.equals(v2)).toBe(false);
    expect(v1.equals(limitVersionKeyFor(secret, multisigPda, 3_000_000_000n).publicKey)).toBe(true);
  });
});

describe("spendingLimitChangeInstructions", () => {
  const current = spendingLimitPdaFor(multisigPda, limitCreateKeyFor(secret, multisigPda).publicKey);
  const newKey = limitVersionKeyFor(secret, multisigPda, 3_000_000_000n).publicKey;
  const p = { multisigPda, transactionIndex: 5n, owner, rentPayer: feePayer, currentLimitPda: current, newLimit: { createKey: newKey, agent, usdcMint: usdc, amountUsdc: 3_000_000_000n, treasuryVaultPda, treasuryVaultAta } };

  it("is one config transaction the owner creates, approves and executes in a row, rent paid by the fee payer", () => {
    const { ixs, spendingLimitPda } = spendingLimitChangeInstructions(p);
    expect(ixs).toHaveLength(4);
    for (const ix of ixs) expect(ix.programId.equals(multisig.PROGRAM_ID)).toBe(true);
    const [transactionPda] = multisig.getTransactionPda({ multisigPda, index: 5n });
    const [proposalPda] = multisig.getProposalPda({ multisigPda, transactionIndex: 5n });
    expect(has(ixs[0]!, transactionPda)).toBe(true);
    expect(signers(ixs[0]!)).toEqual(expect.arrayContaining([owner.toBase58(), feePayer.toBase58()]));
    expect(has(ixs[1]!, proposalPda)).toBe(true);
    expect(has(ixs[2]!, proposalPda)).toBe(true);
    expect(signers(ixs[2]!)).toContain(owner.toBase58());
    // execute touches both the limit being removed and the one being added
    expect(has(ixs[3]!, current)).toBe(true);
    expect(has(ixs[3]!, spendingLimitPda)).toBe(true);
    expect(spendingLimitPda.equals(spendingLimitPdaFor(multisigPda, newKey))).toBe(true);
    // the agent never signs a permissions change
    for (const ix of ixs) expect(signers(ix)).not.toContain(agent.toBase58());
  });

  it("only adds when there is no current limit", () => {
    const { ixs } = spendingLimitChangeInstructions({ ...p, currentLimitPda: undefined });
    expect(ixs).toHaveLength(4);
    expect(has(ixs[3]!, current)).toBe(false);
  });

  it("refuses to allowlist the treasury ATA instead of the vault PDA", () => {
    expect(() => spendingLimitChangeInstructions({ ...p, newLimit: { ...p.newLimit, treasuryVaultAta: treasuryVaultPda } })).toThrow(/differ/);
  });

  it("refuses a zero cap", () => {
    expect(() => spendingLimitChangeInstructions({ ...p, newLimit: { ...p.newLimit, amountUsdc: 0n } })).toThrow(/positive/);
  });
});

describe("rejectProposalInstructions", () => {
  it("is a single proposalReject by the owner", () => {
    const ixs = rejectProposalInstructions({ multisigPda, transactionIndex: 2n, member: owner });
    expect(ixs).toHaveLength(1);
    expect(ixs[0]!.programId.equals(multisig.PROGRAM_ID)).toBe(true);
    expect(signers(ixs[0]!)).toEqual([owner.toBase58()]);
    const [proposalPda] = multisig.getProposalPda({ multisigPda, transactionIndex: 2n });
    expect(has(ixs[0]!, proposalPda)).toBe(true);
  });
});
