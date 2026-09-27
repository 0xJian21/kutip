import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { describe, expect, it } from "vitest";
import { createKeyFor, deriveAccounts, multisigMembers, provisionInstructions, spendingLimitAction } from "./provision";

const { Permission, Permissions, Period } = multisig.types;
const owner = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

describe("createKeyFor", () => {
  const secret = new Uint8Array(64).fill(7);
  it("is deterministic for the same secret and label", () => {
    expect(createKeyFor(secret, "buyer:b_1").publicKey.toBase58()).toBe(createKeyFor(secret, "buyer:b_1").publicKey.toBase58());
  });
  it("differs per label and per secret", () => {
    expect(createKeyFor(secret, "buyer:b_1").publicKey.equals(createKeyFor(secret, "buyer:b_2").publicKey)).toBe(false);
    expect(createKeyFor(new Uint8Array(64).fill(8), "buyer:b_1").publicKey.equals(createKeyFor(secret, "buyer:b_1").publicKey)).toBe(false);
  });
});

describe("multisigMembers", () => {
  it("gives the owner all permissions and the agent Initiate only", () => {
    const members = multisigMembers({ owner, agent });
    expect(members.map((m) => m.key.toBase58())).toEqual([owner.toBase58(), agent.toBase58()]);
    expect(members[0]!.permissions.mask).toBe(Permissions.all().mask); // 7 = Initiate|Vote|Execute
    expect(members[1]!.permissions.mask).toBe(Permission.Initiate); // 1
  });
});

describe("deriveAccounts", () => {
  it("derives vault 0 and its USDC ATA from the create key", () => {
    const createKey = Keypair.generate().publicKey;
    const a = deriveAccounts(createKey, usdc);
    const [multisigPda] = multisig.getMultisigPda({ createKey });
    const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
    expect(a.multisigPda.equals(multisigPda)).toBe(true);
    expect(a.vaultPda.equals(vaultPda)).toBe(true);
    expect(PublicKey.isOnCurve(a.vaultAta.toBytes())).toBe(false); // an ATA is a PDA
  });
});

describe("spendingLimitAction", () => {
  const treasuryVaultPda = Keypair.generate().publicKey;
  const treasuryVaultAta = Keypair.generate().publicKey;
  it("allowlists the treasury VAULT PDA (not its ATA), USDC, Day period, agent as the only member", () => {
    const createKey = Keypair.generate().publicKey;
    const action = spendingLimitAction({ createKey, agent, usdcMint: usdc, amountUsdc: 5_000_000_000n, treasuryVaultPda, treasuryVaultAta });
    expect(action.__kind).toBe("AddSpendingLimit");
    if (action.__kind !== "AddSpendingLimit") throw new Error("unreachable");
    expect(action.destinations.map((d) => d.toBase58())).toEqual([treasuryVaultPda.toBase58()]);
    expect(action.destinations.some((d) => d.equals(treasuryVaultAta))).toBe(false);
    expect(action.members.map((m) => m.toBase58())).toEqual([agent.toBase58()]);
    expect(action.period).toBe(Period.Day);
    expect(action.mint.equals(usdc)).toBe(true);
    expect(action.vaultIndex).toBe(0);
    expect(Number(action.amount)).toBe(5_000_000_000);
  });
  it("refuses amounts the SDK cannot carry as a JS number", () => {
    expect(() =>
      spendingLimitAction({ createKey: owner, agent, usdcMint: usdc, amountUsdc: 2n ** 53n, treasuryVaultPda, treasuryVaultAta }),
    ).toThrow(/safe integer/);
  });
  it("refuses a zero limit", () => {
    expect(() => spendingLimitAction({ createKey: owner, agent, usdcMint: usdc, amountUsdc: 0n, treasuryVaultPda, treasuryVaultAta })).toThrow(/positive/);
  });
});

describe("provisionInstructions", () => {
  const feePayer = Keypair.generate().publicKey;
  const treasury = deriveAccounts(Keypair.generate().publicKey, usdc);
  const createKey = Keypair.generate().publicKey;
  const limitCreateKey = Keypair.generate().publicKey;
  const programTreasury = Keypair.generate().publicKey;

  it("creates a controlled multisig, adds the limit, hands control back, and creates the vault ATA — all in one tx", () => {
    const ixs = provisionInstructions({
      feePayer, owner, agent, usdcMint: usdc, createKey, programTreasury,
      spendingLimit: { createKey: limitCreateKey, amountUsdc: 5_000_000_000n, treasury },
    });
    expect(ixs.map((ix) => ix.programId.toBase58())).toEqual([
      multisig.PROGRAM_ID.toBase58(), multisig.PROGRAM_ID.toBase58(), multisig.PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    ]);
    // last Squads ix: set config authority back to the default pubkey (= autonomous, owner-controlled)
    const setAuthority = ixs[2]!;
    expect(setAuthority.data.subarray(8, 40)).toEqual(Buffer.from(PublicKey.default.toBytes()));
    // the fee payer signs as creator / config authority; the owner never has to
    const signers = new Set(ixs.flatMap((ix) => ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58())));
    expect(signers).toEqual(new Set([feePayer.toBase58(), createKey.toBase58()]));
  });

  it("without a spending limit (treasury multisig) it is create + ATA only, autonomous from the start", () => {
    const ixs = provisionInstructions({ feePayer, owner, agent, usdcMint: usdc, createKey, programTreasury });
    expect(ixs).toHaveLength(2);
    expect(ixs[1]!.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
  });
});
