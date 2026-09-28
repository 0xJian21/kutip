import "server-only";
import { buildOwnerTx, limitPdaForBuyer, limitVersionKeyFor, parseSignedOwnerTx, readMultisig, readSpendingLimit, sendSigned, spendingLimitChangeInstructions, spendingLimitPdaFor, type SpendingLimitView } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { UserError } from "@/lib/data/result";
import { validateRulebook } from "@/lib/server/access";
import { ownerStatement, verifyOwnerSignature } from "@/lib/server/owner-signature";
import { applyPermissions, permissionsOf, type AgentPermissions } from "./permissions-model";
import { PERMISSIONS_PURPOSE, permissionsPurpose } from "./permissions-purpose";
import { agentPubkey, treasuryContext } from "./server";

export { applyPermissions, PERMISSIONS_PURPOSE, permissionsOf, type AgentPermissions };

/**
 * Agent permissions (IMPROVEMENTS R4): what the agent may do on its own, approved
 * once by the owner with the passkey. The daily sweep cap is enforced on-chain by a
 * SpendingLimit on every buyer multisig; changing it re-issues those limits in config
 * transactions the owner signs. Everything else (destination = treasury, replies mode,
 * discount limit) lives in the rulebook and is approved by signing a statement.
 */

export type BuyerLimitView = { buyerId: string; buyerName: string; multisig: string; limit: SpendingLimitView | null; matchesCap: boolean; provisioned: boolean };

export type PermissionsView = {
  permissions: AgentPermissions;
  treasuryVault: string;
  agentKey: string;
  approvedAt?: string;
  buyers: BuyerLimitView[];
  /** Buyer multisigs whose on-chain cap differs from the rulebook (needs a signed change). */
  outOfSync: number;
};

export async function readAgentPermissions(exporterId: string): Promise<PermissionsView> {
  const { connection, feePayer, store } = treasuryContext();
  const [exporter, buyers, accounts, rulebook] = await Promise.all([store.getExporter(exporterId), store.listBuyers(exporterId), store.listBuyerAccounts(exporterId), store.getRulebook(exporterId)]);
  if (!exporter) throw new Error(`exporter not found: ${exporterId}`);
  const cap = rulebook.treasury.agentDailyLimitUsdc;
  const views: BuyerLimitView[] = [];
  for (const a of accounts) {
    const name = buyers.find((b) => b.id === a.id)?.name ?? a.id;
    let multisigPda: PublicKey;
    try {
      multisigPda = new PublicKey(a.multisig);
    } catch {
      views.push({ buyerId: a.id, buyerName: name, multisig: a.multisig, limit: null, matchesCap: false, provisioned: false });
      continue;
    }
    const limit = await readSpendingLimit(connection, limitPdaForBuyer({ multisigPda, spendingLimitPda: a.spendingLimitPda, secret: feePayer.secretKey }));
    views.push({ buyerId: a.id, buyerName: name, multisig: a.multisig, limit, matchesCap: limit !== null && limit.amountUsdc === cap, provisioned: true });
  }
  return {
    permissions: permissionsOf(rulebook),
    treasuryVault: exporter.treasuryVault,
    agentKey: agentPubkey().toBase58(),
    approvedAt: exporter.permissionsApprovedAt,
    buyers: views,
    outOfSync: views.filter((v) => v.provisioned && !v.matchesCap).length,
  };
}

export type LimitChangeTx = { buyerId: string; buyerName: string; multisig: string; transactionIndex: string; spendingLimitPda: string; transaction: string };

/**
 * One owner-signed config transaction per provisioned buyer multisig whose on-chain cap
 * differs from `dailyCapUsdc`. Fee payer already signed; the owner signs client-side.
 */
export async function buildLimitChangeTxs(exporterId: string, dailyCapUsdc: bigint): Promise<LimitChangeTx[]> {
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const [exporter, accounts, buyers] = await Promise.all([store.getExporter(exporterId), store.listBuyerAccounts(exporterId), store.listBuyers(exporterId)]);
  if (!exporter) throw new Error(`exporter not found: ${exporterId}`);
  const out: LimitChangeTx[] = [];
  const treasuryVaultPda = new PublicKey(exporter.treasuryVault);
  const treasuryVaultAta = new PublicKey(exporter.treasuryUsdcAta);
  for (const a of accounts) {
    let multisigPda: PublicKey;
    try {
      multisigPda = new PublicKey(a.multisig);
    } catch {
      continue;
    }
    const currentPda = limitPdaForBuyer({ multisigPda, spendingLimitPda: a.spendingLimitPda, secret: feePayer.secretKey });
    const current = await readSpendingLimit(connection, currentPda);
    if (current && current.amountUsdc === dailyCapUsdc) continue;
    const ms = await readMultisig(connection, multisigPda);
    const owner = ms.members.find((m) => !m.equals(agentPubkey()));
    if (!owner) throw new Error(`no owner member on ${a.multisig}`);
    const createKey = limitVersionKeyFor(feePayer.secretKey, multisigPda, dailyCapUsdc).publicKey;
    if (await connection.getAccountInfo(spendingLimitPdaFor(multisigPda, createKey))) throw new Error(`limit for ${dailyCapUsdc} already exists on ${a.multisig}; re-run the read`);
    const transactionIndex = ms.nextTransactionIndex;
    const { ixs, spendingLimitPda } = spendingLimitChangeInstructions({
      multisigPda,
      transactionIndex,
      owner,
      rentPayer: feePayer.publicKey,
      currentLimitPda: current ? currentPda : undefined,
      newLimit: { createKey, agent: agentPubkey(), usdcMint, amountUsdc: dailyCapUsdc, treasuryVaultPda, treasuryVaultAta },
    });
    const built = await buildOwnerTx({ connection, feePayer, ixs });
    out.push({ buyerId: a.id, buyerName: buyers.find((b) => b.id === a.id)?.name ?? a.id, multisig: a.multisig, transactionIndex: transactionIndex.toString(), spendingLimitPda: spendingLimitPda.toBase58(), transaction: built.base64 });
  }
  return out;
}

export type PermissionsApproval =
  | { kind: "statement"; message: string; signature: string }
  | { kind: "transactions"; signed: Array<{ buyerId: string; spendingLimitPda: string; signedTransaction: string }>; message: string; signature: string };

/**
 * Persist the permissions the owner just approved. With signed config transactions,
 * each one is sent and the buyer's new SpendingLimit PDA stored; the statement
 * signature is the approval record either way.
 */
export async function savePermissions(p: { exporterId: string; wallet?: string; permissions: AgentPermissions; approval: PermissionsApproval }): Promise<{ signatures: string[]; approvedAt: string }> {
  // The purpose carries a digest of the permissions, so the signature covers exactly what is applied below.
  if (!verifyOwnerSignature({ wallet: p.wallet, message: p.approval.message, signature: p.approval.signature, exporterId: p.exporterId, purpose: permissionsPurpose(p.permissions) })) {
    throw new UserError("That approval didn't come from your signed-in passkey wallet. Try again.");
  }
  const { connection, feePayer, store } = treasuryContext();
  const rulebook = validateRulebook(applyPermissions(await store.getRulebook(p.exporterId), p.permissions));
  const signatures: string[] = [];
  if (p.approval.kind === "transactions") {
    const owner = new PublicKey(p.wallet!);
    for (const t of p.approval.signed) {
      const tx = parseSignedOwnerTx(t.signedTransaction, feePayer.publicKey, owner);
      const sig = await sendSigned(connection, tx);
      await store.setBuyerSpendingLimit(p.exporterId, t.buyerId, t.spendingLimitPda);
      signatures.push(sig);
    }
  }
  await store.updateRulebook(p.exporterId, rulebook);
  const at = new Date();
  await store.recordPermissionsApproval(p.exporterId, { wallet: p.wallet!, signature: p.approval.signature, at });
  await store.recordAgentAction({
    exporterId: p.exporterId,
    kind: "sweep_proposal",
    inputSummary: `permissions: cap USD ${p.permissions.dailyCapUsdc / 1_000_000n}/day, replies ${p.permissions.buyerReplies}, discount ${p.permissions.maxDiscountPct}%`,
    decision: signatures.length ? `You approved the agent's permissions with Touch ID and re-issued the on-chain daily cap on ${signatures.length} buyer account(s)` : "You approved the agent's permissions with Touch ID",
    reason: "Agent permissions are set by the owner; the daily cap is enforced on-chain by Squads spending limits",
    confidence: 1,
    ruleId: "T2",
    status: "executed",
    txSignature: signatures[0],
    at,
  });
  return { signatures, approvedAt: at.toISOString() };
}

export function permissionsStatement(exporterId: string, permissions: AgentPermissions, at = new Date()): string {
  return ownerStatement({ exporterId, purpose: permissionsPurpose(permissions), at });
}
