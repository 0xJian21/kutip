import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { explainOwnerStatement, ownerStatement, statementTransaction, verifyOwnerStatement } from "./owner-signature";

const owner = Keypair.generate();
const now = new Date("2026-09-28T10:00:00Z");
const purpose = "Approve agent permissions · abc123";

/** What the browser does: sign the fee-free memo transaction with the owner's key. */
function signedBy(kp: Keypair, message: string): string {
  const tx = VersionedTransaction.deserialize(Buffer.from(statementTransaction({ owner: kp.publicKey, statement: message }), "base64"));
  tx.sign([kp]);
  return Buffer.from(tx.serialize()).toString("base64");
}

describe("ownerStatement", () => {
  it("is a plain-English line naming the exporter, the purpose and the time", () => {
    expect(ownerStatement({ exporterId: "exp_teratai", purpose: "Whitelist cash-out address 7Y3k", at: now })).toBe("Kutip · exp_teratai · Whitelist cash-out address 7Y3k · 2026-09-28T10:00:00.000Z");
  });
});

describe("statementTransaction", () => {
  it("is payer = owner, one memo instruction carrying the statement, and a blockhash that can never land", () => {
    const message = ownerStatement({ exporterId: "exp_teratai", purpose, at: now });
    const tx = VersionedTransaction.deserialize(Buffer.from(statementTransaction({ owner: owner.publicKey, statement: message }), "base64"));
    expect(tx.message.staticAccountKeys[0]!.equals(owner.publicKey)).toBe(true);
    expect(tx.message.compiledInstructions).toHaveLength(1);
    expect(Buffer.from(tx.message.compiledInstructions[0]!.data).toString("utf8")).toBe(message);
    expect(tx.message.recentBlockhash).toBe("11111111111111111111111111111111");
    expect(tx.message.header.numRequiredSignatures).toBe(1);
  });
});

describe("verifyOwnerStatement", () => {
  const message = ownerStatement({ exporterId: "exp_teratai", purpose, at: now });
  const base = { wallet: owner.publicKey.toBase58(), exporterId: "exp_teratai", purpose, now };

  it("accepts the session wallet's signature over a fresh statement for this exporter and purpose", () => {
    const r = verifyOwnerStatement({ ...base, signedTransaction: signedBy(owner, message) });
    expect(r).toEqual({ ok: true, message, signature: expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{86,88}$/) });
  });
  it("rejects a signature from another key", () => {
    expect(explainOwnerStatement({ ...base, signedTransaction: signedBy(Keypair.generate(), message) })).toMatch(/payer|signature/);
  });
  it("rejects a statement for another exporter or purpose", () => {
    expect(explainOwnerStatement({ ...base, signedTransaction: signedBy(owner, ownerStatement({ exporterId: "exp_other", purpose, at: now })) })).toMatch(/exporter/);
    expect(explainOwnerStatement({ ...base, signedTransaction: signedBy(owner, ownerStatement({ exporterId: "exp_teratai", purpose: "Cash out", at: now })) })).toMatch(/purpose/);
  });
  it("rejects a statement older than ten minutes (no replay)", () => {
    const old = ownerStatement({ exporterId: "exp_teratai", purpose, at: new Date("2026-09-28T09:49:00Z") });
    expect(explainOwnerStatement({ ...base, signedTransaction: signedBy(owner, old) })).toMatch(/stale/);
  });
  it("rejects an unsigned or tampered transaction and never throws on garbage", () => {
    const unsigned = statementTransaction({ owner: owner.publicKey, statement: message });
    expect(explainOwnerStatement({ ...base, signedTransaction: unsigned })).toMatch(/signature/);
    expect(explainOwnerStatement({ ...base, signedTransaction: "zz" })).toBeTruthy();
    expect(explainOwnerStatement({ ...base, wallet: undefined, signedTransaction: signedBy(owner, message) })).toMatch(/wallet/);
  });
});
