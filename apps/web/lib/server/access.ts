/**
 * Access rules for owner actions. Pure, so they are testable; auth.ts and the routes apply them.
 */
import { parseRulebook } from "@kutip/agent";
import { UserError } from "../data/result";
import type { Rulebook } from "@/lib/ui/types";

/** A verified Privy user without a Kutip user is refused, unless the demo fallback is explicitly on (DEMO_FALLBACK=1). */
export function exporterForSignIn(user: { exporterId: string } | null, opts: { demoFallback?: string }): string {
  if (user) return user.exporterId;
  if (opts.demoFallback) return opts.demoFallback;
  throw new UserError("This sign-in isn't linked to a Kutip account. Ask the owner to add you.");
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
