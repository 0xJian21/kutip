import "server-only";
import { cashOutAlert, formatUsdc } from "@kutip/agent";
import { createTransferProposal, PublicKey } from "@kutip/solana";
import { UserError } from "@/lib/data/result";
import { ownerStatement, verifyOwnerSignature } from "@/lib/server/owner-signature";
import { toMyr, type BnmRate } from "@/lib/ui/money";
import { agentKeypair, pubkey, treasuryContext } from "./server";

/**
 * Cash out to ringgit (IMPROVEMENTS T4). Kutip never touches MYR: the owner sends
 * USDC from the treasury to their own deposit address at an SC-registered exchange
 * (HATA lists USDC on Solana), sells there and withdraws to their bank. The agent
 * proposes; the owner approves + executes with the passkey (useApproveProposal).
 * Exposed for the treasury page and Session 8c's command bar.
 */

/** Indicative exchange fee on the USDC → MYR sale, basis points (HATA taker fee is about 0.25%). */
export const CASH_OUT_FEE_BPS = BigInt(process.env.CASHOUT_FEE_BPS ?? "25");
/** Rent for the vault transaction + proposal accounts, paid by Kutip, reclaimable after execution. */
export const PROPOSAL_RENT_LAMPORTS = 4_099_000n;

export const MYRC_OPTION = { label: "MYRC ringgit stablecoin", address: "", enabled: false, note: "When BNM approves" } as const;

export type CashOutPreview = {
  amountUsdc: bigint;
  rate: BnmRate;
  grossMyrSen: bigint;
  feeBps: bigint;
  feeMyrSen: bigint;
  netMyrSen: bigint;
  destination: { label: string; address: string } | null;
  whitelisted: Array<{ label: string; address: string }>;
  myrc: typeof MYRC_OPTION;
  treasuryBalanceUsdc: bigint;
  treasuryVault: string;
  rentLamports: bigint;
  feePaidByKutip: true;
  rule: { id: "T4"; reason: string };
  timing: { aboveBps: bigint; marginBps: bigint; good: boolean; reason: string };
  ok: boolean;
  problem?: string;
};

export async function previewCashOut(exporterId: string, input: { amountUsdc: bigint; destination?: string }): Promise<CashOutPreview> {
  const { store } = treasuryContext();
  const [t, rulebook] = await Promise.all([store.getTreasury(exporterId), store.getRulebook(exporterId)]);
  const rate = t.cashOut.currentRate;
  const grossMyrSen = toMyr(input.amountUsdc, rate);
  const feeMyrSen = (grossMyrSen * CASH_OUT_FEE_BPS + 5_000n) / 10_000n;
  const destination = t.cashOut.whitelisted.find((w) => w.address === (input.destination ?? t.cashOut.whitelisted[0]?.address)) ?? null;
  const alert = cashOutAlert({ myrPerUsd: rate.myrPerUsd, avg30dMyrPerUsd: t.cashOut.thirtyDayAvg.myrPerUsd, rulebook });
  const aboveBps = ((rate.myrPerUsd - t.cashOut.thirtyDayAvg.myrPerUsd) * 10_000n) / t.cashOut.thirtyDayAvg.myrPerUsd;
  const problem =
    input.amountUsdc <= 0n
      ? "Enter an amount above 0"
      : input.amountUsdc > t.mainBalanceUsdc
        ? `Your treasury holds USD ${formatUsdc(t.mainBalanceUsdc)}`
        : !destination
          ? "Whitelist your exchange deposit address first"
          : undefined;
  return {
    amountUsdc: input.amountUsdc,
    rate,
    grossMyrSen,
    feeBps: CASH_OUT_FEE_BPS,
    feeMyrSen,
    netMyrSen: grossMyrSen - feeMyrSen,
    destination,
    whitelisted: t.cashOut.whitelisted,
    myrc: MYRC_OPTION,
    treasuryBalanceUsdc: t.mainBalanceUsdc,
    treasuryVault: t.mainVault,
    rentLamports: PROPOSAL_RENT_LAMPORTS,
    feePaidByKutip: true,
    rule: { id: "T4", reason: "Any movement other than the daily sweep needs your approval with Touch ID" },
    timing: { aboveBps, marginBps: rulebook.treasury.cashOutAlertMarginBps, good: alert.allowed, reason: alert.reason },
    ok: !problem,
    problem,
  };
}

export type CashOutProposal = { transactionIndex: string; actionId: string; signature: string; destination: { label: string; address: string }; amountUsdc: bigint };

/** The agent creates the Squads proposal (Initiate only); nothing moves until the owner approves. */
export async function proposeCashOut(exporterId: string, input: { amountUsdc: bigint; destination: string }): Promise<CashOutProposal> {
  const preview = await previewCashOut(exporterId, input);
  if (!preview.ok || !preview.destination) throw new UserError(preview.problem ?? "Cannot cash out right now");
  const { connection, feePayer, usdcMint, store } = treasuryContext();
  const agent = agentKeypair();
  const r = await createTransferProposal({
    connection,
    feePayer,
    agent,
    usdcMint,
    store,
    exporterId,
    destinationOwner: new PublicKey(preview.destination.address),
    amountUsdc: input.amountUsdc,
    memo: "k_cashout",
  });
  return { transactionIndex: r.transactionIndex.toString(), actionId: r.actionId, signature: r.signature, destination: preview.destination, amountUsdc: input.amountUsdc };
}

export const WHITELIST_PURPOSE = (address: string) => `Whitelist cash-out address ${address}`;

/** Owner adds their own exchange deposit address, signed with the passkey wallet (a statement, not a transaction). */
export async function addCashOutAddress(p: { exporterId: string; wallet?: string; label: string; address: string; message: string; signature: string }): Promise<Array<{ label: string; address: string }>> {
  const address = pubkey(p.address, "Deposit address").toBase58();
  const label = p.label.trim().slice(0, 80);
  if (!label) throw new UserError("Give the address a label, e.g. HATA USDC deposit");
  if (!verifyOwnerSignature({ wallet: p.wallet, message: p.message, signature: p.signature, exporterId: p.exporterId, purpose: WHITELIST_PURPOSE(address) })) {
    throw new UserError("That approval didn't come from your signed-in passkey wallet. Try again.");
  }
  const { store } = treasuryContext();
  const t = await store.getTreasury(p.exporterId);
  if (t.cashOut.whitelisted.some((w) => w.address === address)) return t.cashOut.whitelisted;
  const next = [{ label, address }, ...t.cashOut.whitelisted];
  await store.setCashOutWhitelist(p.exporterId, next);
  return next;
}

export async function removeCashOutAddress(p: { exporterId: string; wallet?: string; address: string; message: string; signature: string }): Promise<Array<{ label: string; address: string }>> {
  if (!verifyOwnerSignature({ wallet: p.wallet, message: p.message, signature: p.signature, exporterId: p.exporterId, purpose: `Remove cash-out address ${p.address}` })) {
    throw new UserError("That approval didn't come from your signed-in passkey wallet. Try again.");
  }
  const { store } = treasuryContext();
  const t = await store.getTreasury(p.exporterId);
  const next = t.cashOut.whitelisted.filter((w) => w.address !== p.address);
  await store.setCashOutWhitelist(p.exporterId, next);
  return next;
}

/** The statement the client asks the wallet to sign for a whitelist change. */
export function whitelistStatement(exporterId: string, address: string, at = new Date()): string {
  return ownerStatement({ exporterId, purpose: WHITELIST_PURPOSE(address), at });
}
