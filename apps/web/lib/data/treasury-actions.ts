"use server";

/**
 * Treasury and account server actions (Session 8b). Owner-only: every call checks the
 * session and scopes to its exporter. The preview/execute pairs are the functions
 * Session 8c's command bar calls too ("Sweep now", "Cash out RM 10k"): preview first,
 * show the card, then execute/propose after the owner confirms.
 */
import { refresh } from "next/cache";
import { ownerSessionOrThrow, sessionOrThrow, writeSessionOrThrow } from "@/lib/server/auth";
import { completeOnboarding as completeOnboardingImpl } from "@/lib/server/onboarding";
import { store } from "@/lib/server/store";
import { uploadLogo } from "@/lib/server/storage";
import { signupFolder, validateCompany, type CompanyInput } from "@/lib/server/input";
import { addCashOutAddress, previewCashOut, proposeCashOut, REMOVE_PURPOSE, removeCashOutAddress, WHITELIST_PURPOSE, whitelistStatement, type CashOutPreview, type CashOutProposal } from "@/lib/treasury/cashout";
import { buildLimitChangeTxs, permissionsStatement, readAgentPermissions, savePermissions, type LimitChangeTx, type PermissionsApproval, type PermissionsView } from "@/lib/treasury/permissions";
import type { AgentPermissions } from "@/lib/treasury/permissions-model";
import { executeSweep, previewSweep, type SweepExecution, type SweepPreview } from "@/lib/treasury/sweep";
import { toResult, UserError } from "./result";

export type { AgentPermissions, CashOutPreview, CashOutProposal, LimitChangeTx, PermissionsView, SweepExecution, SweepPreview };

// ---- Sweep now (T2 + A2) ----

export async function sweepPreview() {
  return toResult(async () => previewSweep((await sessionOrThrow()).exporterId));
}

/** Sweeps only the buyer accounts the owner ticked. The server re-checks each one (T2 cap, destination = treasury). */
export async function sweepNow(input: { buyerIds: string[] }) {
  return toResult(async () => {
    const { exporterId } = await ownerSessionOrThrow();
    const ids = input?.buyerIds;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string" || id.length > 64)) throw new UserError("That selection of buyer accounts isn't valid. Close the dialog and try again.");
    const r = await executeSweep(exporterId, [...new Set(ids)]);
    refresh();
    return r;
  });
}

// ---- Cash out to ringgit (T4) ----

export async function cashOutPreview(input: { amountUsdc: bigint; destination?: string }) {
  return toResult(async () => previewCashOut((await sessionOrThrow()).exporterId, input));
}

/** The agent creates the proposal; the client then approves it with useApproveProposal (Touch ID). */
export async function cashOutPropose(input: { amountUsdc: bigint; destination: string }) {
  return toResult(async () => {
    const r = await proposeCashOut((await ownerSessionOrThrow()).exporterId, input);
    refresh();
    return r;
  });
}

/** Statement (+ unsendable transaction) the wallet signs before whitelisting; the server checks it against the session wallet. */
/** The browser's Privy wallet must be the session's owner wallet, or the signature can never verify: say so up front. */
function assertSameWallet(session: { wallet: string }, browserWallet: string | undefined): void {
  if (browserWallet && browserWallet !== session.wallet) {
    throw new UserError(`This tab is signed into Privy as a different account (wallet ${browserWallet.slice(0, 4)}…${browserWallet.slice(-4)}). Sign out and sign in again with the passkey that owns this treasury (wallet ${session.wallet.slice(0, 4)}…${session.wallet.slice(-4)}).`);
  }
}

export async function whitelistStatementFor(address: string, browserWallet?: string) {
  return toResult(async () => {
    const s = await ownerSessionOrThrow();
    assertSameWallet(s, browserWallet);
    return whitelistStatement(s.exporterId, s.wallet, WHITELIST_PURPOSE(address));
  });
}

export async function whitelistAdd(input: { label: string; address: string; signedTransaction: string }) {
  return toResult(async () => {
    const { exporterId, wallet } = await ownerSessionOrThrow();
    const list = await addCashOutAddress({ exporterId, wallet, ...input });
    refresh();
    return list;
  });
}

export async function whitelistRemoveStatementFor(address: string, browserWallet?: string) {
  return toResult(async () => {
    const s = await ownerSessionOrThrow();
    assertSameWallet(s, browserWallet);
    return whitelistStatement(s.exporterId, s.wallet, REMOVE_PURPOSE(address));
  });
}

export async function whitelistRemove(input: { address: string; signedTransaction: string }) {
  return toResult(async () => {
    const { exporterId, wallet } = await ownerSessionOrThrow();
    const list = await removeCashOutAddress({ exporterId, wallet, ...input });
    refresh();
    return list;
  });
}

// ---- Agent permissions (R4) ----

export async function agentPermissions() {
  return toResult(async () => readAgentPermissions((await sessionOrThrow()).exporterId));
}

/** The statement binds the exact permissions being approved (a digest is in the purpose line). */
export async function permissionsStatementNow(permissions: AgentPermissions, browserWallet?: string) {
  return toResult(async () => {
    const s = await ownerSessionOrThrow();
    assertSameWallet(s, browserWallet);
    return permissionsStatement(s.exporterId, s.wallet, permissions);
  });
}

/** Owner-signed config transactions that re-issue the on-chain daily cap on every out-of-sync buyer multisig. */
export async function permissionsLimitTxs(dailyCapUsdc: bigint) {
  return toResult(async () => buildLimitChangeTxs((await ownerSessionOrThrow()).exporterId, dailyCapUsdc));
}

export async function permissionsSave(input: { permissions: AgentPermissions; approval: PermissionsApproval }) {
  return toResult(async () => {
    const { exporterId, wallet } = await ownerSessionOrThrow();
    const r = await savePermissions({ exporterId, wallet, ...input });
    refresh();
    return r;
  });
}

// ---- Company profile + logo (R1) ----

export async function companyProfileSave(input: Partial<CompanyInput>) {
  return toResult(async () => {
    const { exporterId } = await writeSessionOrThrow();
    const current = await store().getExporter(exporterId);
    if (!current) throw new UserError("Your company could not be found");
    const c = validateCompany({
      name: input.name ?? current.name,
      registrationNo: input.registrationNo ?? current.registrationNo,
      city: input.city ?? current.city,
      address: input.address ?? current.address,
      contactEmail: input.contactEmail ?? current.contactEmail,
      ownerName: current.ownerName || "owner",
    });
    const e = await store().updateExporterProfile(exporterId, { name: c.name, registrationNo: c.registrationNo, city: c.city, address: c.address, contactEmail: c.contactEmail });
    refresh();
    return e;
  });
}

/** FormData with a `logo` file. Stores it and points exporters.logo_url at it. */
export async function logoUpload(form: FormData) {
  return toResult(async () => {
    const { exporterId } = await writeSessionOrThrow();
    const file = form.get("logo");
    if (!(file instanceof File)) throw new UserError("Choose an image file");
    const url = await uploadLogo(exporterId, file);
    await store().updateExporterProfile(exporterId, { logoUrl: url });
    refresh();
    return { logoUrl: url };
  });
}

/** Onboarding step 2 → 3: the company is real, its treasury is on Solana, the session starts. */
export async function completeOnboarding(accessToken: string, company: CompanyInput) {
  return toResult(() => completeOnboardingImpl(accessToken, company));
}

/** Onboarding logo before the exporter exists: upload under a temporary key the completeOnboarding call then adopts. */
export async function logoUploadForSignup(accessToken: string, form: FormData) {
  return toResult(async () => {
    const { verifyPrivyToken } = await import("@/lib/server/auth");
    const { privyUserId } = await verifyPrivyToken(accessToken);
    const file = form.get("logo");
    if (!(file instanceof File)) throw new UserError("Choose an image file");
    return { logoUrl: await uploadLogo(signupFolder(privyUserId), file) };
  });
}
