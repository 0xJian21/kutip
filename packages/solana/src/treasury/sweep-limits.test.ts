import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { limitCreateKeyFor, spendingLimitPdaFor } from "./provision";
import { limitPdaForBuyer } from "./sweep";

const secret = new Uint8Array(64).fill(9);
const multisigPda = Keypair.generate().publicKey;

describe("limitPdaForBuyer", () => {
  it("prefers the stored PDA (a re-issued cap) over the provisioning derivation", () => {
    const stored = Keypair.generate().publicKey;
    expect(limitPdaForBuyer({ multisigPda, spendingLimitPda: stored.toBase58(), secret }).equals(stored)).toBe(true);
  });
  it("falls back to the provisioning derivation when nothing is stored or the stored value is not a key", () => {
    const derived = spendingLimitPdaFor(multisigPda, limitCreateKeyFor(secret, multisigPda).publicKey);
    expect(limitPdaForBuyer({ multisigPda, secret }).equals(derived)).toBe(true);
    expect(limitPdaForBuyer({ multisigPda, spendingLimitPda: "seeded-placeholder", secret }).equals(derived)).toBe(true);
    expect(limitPdaForBuyer({ multisigPda, spendingLimitPda: PublicKey.default.toBase58(), secret }).equals(derived)).toBe(true);
  });
});
