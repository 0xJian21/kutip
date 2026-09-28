/**
 * "Approve with Touch ID" for things that are not transactions (whitelisting a cash-out
 * address, approving the agent's permissions): the owner's Privy wallet signs a plain
 * statement; the server checks the Ed25519 signature against the session wallet, that the
 * statement names this exporter and purpose, and that it is fresh. Pure, so it is testable.
 */
import { createPublicKey, verify } from "node:crypto";
import bs58 from "bs58";

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");
export const STATEMENT_MAX_AGE_MS = 10 * 60_000;

export function ownerStatement(p: { exporterId: string; purpose: string; at: Date }): string {
  return `Kutip · ${p.exporterId} · ${p.purpose} · ${p.at.toISOString()}`;
}

export function verifyOwnerSignature(p: { wallet: string | undefined; message: string; signature: string; exporterId: string; purpose: string; now?: Date }): boolean {
  try {
    if (!p.wallet) return false;
    const parts = p.message.split(" · ");
    if (parts.length !== 4 || parts[0] !== "Kutip" || parts[1] !== p.exporterId || parts[2] !== p.purpose) return false;
    const at = Date.parse(parts[3]!);
    const now = (p.now ?? new Date()).getTime();
    if (!Number.isFinite(at) || now - at > STATEMENT_MAX_AGE_MS || at - now > 60_000) return false;
    const raw = bs58.decode(p.wallet);
    if (raw.length !== 32) return false;
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(raw)]), format: "der", type: "spki" });
    return verify(null, Buffer.from(new TextEncoder().encode(p.message)), key, Buffer.from(bs58.decode(p.signature)));
  } catch {
    return false;
  }
}
