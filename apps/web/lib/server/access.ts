/**
 * Access rules for owner actions. Pure, so they are testable; auth.ts and the routes apply them.
 */
import { parseRulebook } from "@kutip/agent";
import { UserError } from "../data/result";
import type { Session } from "./session-token";
import type { Rulebook } from "@/lib/ui/types";

type SignedInUser = { userId: string; exporterId: string; role: "owner" | "admin"; walletPubkey?: string };

/**
 * The session a verified Privy identity gets. The wallet on the session is the exporter's
 * registered owner wallet, and only when the Privy account actually holds that key; admins
 * and DEMO_FALLBACK visitors get no wallet, so nothing that needs the owner's signature can
 * be done from their sessions (security review, Session 8b).
 */
export function sessionFor(p: { user: SignedInUser | null; demoExporterId?: string; privyUserId: string; wallets: string[] }): Session {
  if (!p.user) {
    if (!p.demoExporterId) throw new UserError("This sign-in isn't linked to a Kutip account. Ask the owner to add you.");
    return { exporterId: p.demoExporterId, privyUserId: p.privyUserId, role: "demo" };
  }
  const ownerWallet = p.user.role === "owner" && p.user.walletPubkey && p.wallets.includes(p.user.walletPubkey) ? p.user.walletPubkey : undefined;
  return { exporterId: p.user.exporterId, privyUserId: p.privyUserId, role: p.user.role, ...(ownerWallet ? { wallet: ownerWallet } : {}) };
}

/** Kutip's fee payer only co-signs an approval for the signed-in owner's own wallet. */
export function assertApprover(requested: string, sessionWallet: string | undefined): void {
  if (!sessionWallet || requested !== sessionWallet) throw new UserError("Approvals must be signed by your signed-in wallet");
}

/** Server-side rulebook check: bigint types, ranges and known keys only (never trust the client's object). */
export function validateRulebook(input: Rulebook): Rulebook {
  const r = parseRulebook(input);
  if (!r.treasury.acceptedTokens.includes("USDC")) throw new UserError("USDC must stay an accepted token");
  return r;
}

/** Post-sign-in redirect target: same-origin paths only. */
export function safeNext(next: unknown): string | undefined {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || /[\\]|%5c/i.test(next)) return undefined;
  const url = new URL(next, "https://kutip.invalid");
  return url.origin === "https://kutip.invalid" ? `${url.pathname}${url.search}${url.hash}` : undefined;
}
