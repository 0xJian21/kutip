/**
 * The owner's session cookie: a small HMAC-signed payload minted once a Privy
 * access token has been verified server-side (lib/server/auth.ts). Pure, so it is testable.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * `wallet` is only ever the exporter's registered owner wallet (users.wallet_pubkey, role owner)
 * when the Privy account holds it; `role` "demo" = DEMO_FALLBACK visitor, read-only.
 */
export type SessionRole = "owner" | "admin" | "demo";
export type Session = { exporterId: string; privyUserId: string; role?: SessionRole; wallet?: string };

export const SESSION_TTL_MS = 12 * 3_600_000;

const mac = (body: string, key: string) => createHmac("sha256", key).update(body).digest("base64url");

export function signSession(s: Session, key: string, now: Date = new Date()): string {
  const body = Buffer.from(JSON.stringify({ ...s, exp: now.getTime() + SESSION_TTL_MS })).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

export function verifySession(token: string | undefined, key: string, now: Date = new Date()): Session | null {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = Buffer.from(mac(body, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Session & { exp: number };
    if (typeof p.exp !== "number" || p.exp < now.getTime() || !p.exporterId || !p.privyUserId) return null;
    const role = p.role === "owner" || p.role === "admin" || p.role === "demo" ? p.role : undefined;
    return { exporterId: p.exporterId, privyUserId: p.privyUserId, ...(role ? { role } : {}), ...(p.wallet ? { wallet: p.wallet } : {}) };
  } catch {
    return null;
  }
}
