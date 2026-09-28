/**
 * The purpose line the owner signs when approving agent permissions binds the exact
 * values shown under "What you are approving": a digest of the permissions goes into
 * the statement, and the server recomputes it from the payload it applies. Server-only
 * by usage (node:crypto); the client fetches the statement from a server action.
 */
import { createHash } from "node:crypto";
import type { AgentPermissions } from "./permissions-model";

export const PERMISSIONS_PURPOSE = "Approve agent permissions";

export function permissionsDigest(p: AgentPermissions): string {
  const canonical = JSON.stringify({
    dailyCapUsdc: p.dailyCapUsdc.toString(),
    destination: p.destination,
    buyerReplies: p.buyerReplies,
    remindersAndReceipts: p.remindersAndReceipts,
    maxDiscountPct: p.maxDiscountPct,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function permissionsPurpose(p: AgentPermissions): string {
  return `${PERMISSIONS_PURPOSE} · ${permissionsDigest(p)}`;
}
