"use server";

/**
 * Treasury and account server actions (Session 8b). Owner-only: every call checks the
 * session and scopes to its exporter. The preview/execute pairs are the functions
 * Session 8c's command bar calls too ("Sweep now", "Cash out RM 10k"): preview first,
 * show the card, then execute/propose after the owner confirms.
 */
import { refresh } from "next/cache";
import { sessionOrThrow } from "@/lib/server/auth";
import { completeOnboarding as completeOnboardingImpl } from "@/lib/server/onboarding";
import { store } from "@/lib/server/store";
import { uploadLogo } from "@/lib/server/storage";
import { validateCompany, type CompanyInput } from "@/lib/server/input";
import { addCashOutAddress, previewCashOut, proposeCashOut, removeCashOutAddress, whitelistStatement, type CashOutPreview, type CashOutProposal } from "@/lib/treasury/cashout";
import { buildLimitChangeTxs, permissionsStatement, readAgentPermissions, savePermissions, type LimitChangeTx, type PermissionsApproval, type PermissionsView } from "@/lib/treasury/permissions";
import type { AgentPermissions } from "@/lib/treasury/permissions-model";
import { executeSweep, previewSweep, type SweepExecution, type SweepPreview } from "@/lib/treasury/sweep";
import { ownerStatement } from "@/lib/server/owner-signature";
import { toResult, UserError } from "./result";

export type { AgentPermissions, CashOutPreview, CashOutProposal, LimitChangeTx, PermissionsView, SweepExecution, SweepPreview };

// ---- Sweep now (T2 + A2) ----

export async function sweepPreview() {
  return toResult(async () => previewSweep((await sessionOrThrow()).exporterId));
}

export async function sweepNow() {
  return toResult(async () => {
    const r = await executeSweep((await sessionOrThrow()).exporterId);
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
    const r = await proposeCashOut((await sessionOrThrow()).exporterId, input);
    refresh();
    return r;
  });
}

/** Statement the wallet signs before whitelisting; the server checks it against the session wallet. */
export async function whitelistStatementFor(address: string) {
  return toResult(async () => whitelistStatement((await sessionOrThrow()).exporterId, address));
}

export async function whitelistAdd(input: { label: string; address: string; message: string; signature: string }) {
  return toResult(async () => {
    const { exporterId, wallet } = await sessionOrThrow();
    const list = await addCashOutAddress({ exporterId, wallet, ...input });
    refresh();
    return list;
  });
}

export async function whitelistRemoveStatementFor(address: string) {
  return toResult(async () => ownerStatement({ exporterId: (await sessionOrThrow()).exporterId, purpose: `Remove cash-out address ${address}`, at: new Date() }));
}

export async function whitelistRemove(input: { address: string; message: string; signature: string }) {
  return toResult(async () => {
    const { exporterId, wallet } = await sessionOrThrow();
    const list = await removeCashOutAddress({ exporterId, wallet, ...input });
    refresh();
    return list;
  });
}

// ---- Agent permissions (R4) ----

export async function agentPermissions() {
  return toResult(async () => readAgentPermissions((await sessionOrThrow()).exporterId));
}

export async function permissionsStatementNow() {
  return toResult(async () => permissionsStatement((await sessionOrThrow()).exporterId));
}

/** Owner-signed config transactions that re-issue the on-chain daily cap on every out-of-sync buyer multisig. */
export async function permissionsLimitTxs(dailyCapUsdc: bigint) {
  return toResult(async () => buildLimitChangeTxs((await sessionOrThrow()).exporterId, dailyCapUsdc));
}

export async function permissionsSave(input: { permissions: AgentPermissions; approval: PermissionsApproval }) {
  return toResult(async () => {
    const { exporterId, wallet } = await sessionOrThrow();
    const r = await savePermissions({ exporterId, wallet, ...input });
    refresh();
    return r;
  });
}

// ---- Company profile + logo (R1) ----

export async function companyProfileSave(input: Partial<CompanyInput>) {
  return toResult(async () => {
    const { exporterId } = await sessionOrThrow();
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
    const { exporterId } = await sessionOrThrow();
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
    return { logoUrl: await uploadLogo(`signup-${privyUserId.replace(/[^a-z0-9]/gi, "").slice(-24)}`, file) };
  });
}
