import { createPrivateKey, sign as edSign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, it } from "vitest";
import { ownerStatement, verifyOwnerSignature } from "./owner-signature";

// Ed25519 detached signature the way Privy's embedded wallet produces one (same bytes as tweetnacl).
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
const privateKeyOf = (kp: Keypair) => createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(kp.secretKey.subarray(0, 32))]), format: "der", type: "pkcs8" });
const signWith = (kp: Keypair, msg: string) => bs58.encode(edSign(null, Buffer.from(new TextEncoder().encode(msg)), privateKeyOf(kp)));

const owner = Keypair.generate();
const sign = (msg: string) => signWith(owner, msg);
const now = new Date("2026-09-28T10:00:00Z");

describe("ownerStatement", () => {
  it("is a plain-English line naming the exporter, the purpose and the time", () => {
    const s = ownerStatement({ exporterId: "exp_teratai", purpose: "Whitelist HATA USDC deposit 7Y3k…", at: now });
    expect(s).toBe("Kutip · exp_teratai · Whitelist HATA USDC deposit 7Y3k… · 2026-09-28T10:00:00.000Z");
  });
});

describe("verifyOwnerSignature", () => {
  const purpose = "Approve agent permissions";
  const message = ownerStatement({ exporterId: "exp_teratai", purpose, at: now });

  it("accepts the session wallet's signature over a fresh statement for this exporter and purpose", () => {
    expect(verifyOwnerSignature({ wallet: owner.publicKey.toBase58(), message, signature: sign(message), exporterId: "exp_teratai", purpose, now })).toBe(true);
  });
  it("rejects a signature from another key", () => {
    const sig = signWith(Keypair.generate(), message);
    expect(verifyOwnerSignature({ wallet: owner.publicKey.toBase58(), message, signature: sig, exporterId: "exp_teratai", purpose, now })).toBe(false);
  });
  it("rejects a statement for another exporter or another purpose", () => {
    const m2 = ownerStatement({ exporterId: "exp_other", purpose, at: now });
    expect(verifyOwnerSignature({ wallet: owner.publicKey.toBase58(), message: m2, signature: sign(m2), exporterId: "exp_teratai", purpose, now })).toBe(false);
    const m3 = ownerStatement({ exporterId: "exp_teratai", purpose: "Cash out", at: now });
    expect(verifyOwnerSignature({ wallet: owner.publicKey.toBase58(), message: m3, signature: sign(m3), exporterId: "exp_teratai", purpose, now })).toBe(false);
  });
  it("rejects a statement older than ten minutes (no replay)", () => {
    const old = ownerStatement({ exporterId: "exp_teratai", purpose, at: new Date("2026-09-28T09:49:00Z") });
    expect(verifyOwnerSignature({ wallet: owner.publicKey.toBase58(), message: old, signature: sign(old), exporterId: "exp_teratai", purpose, now })).toBe(false);
  });
  it("never throws on garbage", () => {
    expect(verifyOwnerSignature({ wallet: "not-a-key", message, signature: "zz", exporterId: "exp_teratai", purpose, now })).toBe(false);
    expect(verifyOwnerSignature({ wallet: undefined, message, signature: sign(message), exporterId: "exp_teratai", purpose, now })).toBe(false);
  });
});
