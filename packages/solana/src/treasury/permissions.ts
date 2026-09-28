/**
 * Agent permissions on-chain (IMPROVEMENTS R4) and owner-side proposal decisions.
 *
 * The agent's daily cap lives in a Squads SpendingLimit on each buyer multisig.
 * SpendingLimit accounts are immutable, so a new cap = RemoveSpendingLimit +
 * AddSpendingLimit in one config transaction that the owner creates, approves and
 * executes with a single signature (threshold 1, no time lock; the buyer multisigs
 * are autonomous, so only members can change config, via proposals). Kutip's fee
 * payer pays the rent; the agent key never signs a permissions change.
 */
import { Connection, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { toSdkAmount } from "./config";
import { createKeyFor, spendingLimitAction, spendingLimitPdaFor } from "./provision";

/**
 * Create key for a re-issued spending limit. Provisioning uses `limit:<multisig>`;
 * every later cap gets `limit:<multisig>:<amount>` so its PDA never collides with
 * the account being closed in the same transaction. Deterministic, so re-applying
 * the same cap is a no-op the caller can detect (the PDA already exists).
 */
export function limitVersionKeyFor(secret: Uint8Array, multisigPda: PublicKey, amountUsdc: bigint) {
  return createKeyFor(secret, `limit:${multisigPda.toBase58()}:${amountUsdc}`);
}

export type NewLimit = {
  createKey: PublicKey;
  agent: PublicKey;
  usdcMint: PublicKey;
  amountUsdc: bigint;
  treasuryVaultPda: PublicKey;
  /** Only so a caller cannot confuse the two; never allowlisted. */
  treasuryVaultAta: PublicKey;
};

/**
 * configTransactionCreate([RemoveSpendingLimit?, AddSpendingLimit]) + proposalCreate +
 * proposalApprove + configTransactionExecute, all by `owner`. Returns the new limit's PDA.
 */
export function spendingLimitChangeInstructions(p: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  owner: PublicKey;
  rentPayer: PublicKey;
  currentLimitPda?: PublicKey;
  newLimit: NewLimit;
}): { ixs: TransactionInstruction[]; spendingLimitPda: PublicKey } {
  toSdkAmount(p.newLimit.amountUsdc, "spending limit"); // range check
  const add = spendingLimitAction({
    createKey: p.newLimit.createKey,
    agent: p.newLimit.agent,
    usdcMint: p.newLimit.usdcMint,
    amountUsdc: p.newLimit.amountUsdc,
    treasuryVaultPda: p.newLimit.treasuryVaultPda,
    treasuryVaultAta: p.newLimit.treasuryVaultAta,
  });
  const actions: multisig.types.ConfigAction[] = p.currentLimitPda ? [{ __kind: "RemoveSpendingLimit", spendingLimit: p.currentLimitPda }, add] : [add];
  const spendingLimitPda = spendingLimitPdaFor(p.multisigPda, p.newLimit.createKey);
  const common = { multisigPda: p.multisigPda, transactionIndex: p.transactionIndex };
  const ixs = [
    multisig.instructions.configTransactionCreate({ ...common, creator: p.owner, rentPayer: p.rentPayer, actions }),
    multisig.instructions.proposalCreate({ ...common, creator: p.owner, rentPayer: p.rentPayer }),
    multisig.instructions.proposalApprove({ ...common, member: p.owner }),
    multisig.instructions.configTransactionExecute({
      ...common,
      member: p.owner,
      rentPayer: p.rentPayer,
      spendingLimits: p.currentLimitPda ? [p.currentLimitPda, spendingLimitPda] : [spendingLimitPda],
    }),
  ];
  return { ixs, spendingLimitPda };
}

/** Owner rejects an Active proposal on-chain (FOLLOWUPS: "Reject = DB only" before this). */
export function rejectProposalInstructions(p: { multisigPda: PublicKey; transactionIndex: bigint; member: PublicKey }): TransactionInstruction[] {
  return [multisig.instructions.proposalReject({ multisigPda: p.multisigPda, transactionIndex: p.transactionIndex, member: p.member })];
}

export type SpendingLimitView = {
  pda: string;
  amountUsdc: bigint;
  remainingTodayUsdc: bigint;
  members: string[];
  destinations: string[];
};

/** The SpendingLimit account as stored, or null when it does not exist. */
export async function readSpendingLimit(connection: Connection, pda: PublicKey): Promise<SpendingLimitView | null> {
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  const [limit] = multisig.accounts.SpendingLimit.fromAccountInfo(info);
  return {
    pda: pda.toBase58(),
    amountUsdc: BigInt(limit.amount.toString()),
    remainingTodayUsdc: BigInt(limit.remainingAmount.toString()),
    members: limit.members.map((m) => m.toBase58()),
    destinations: limit.destinations.map((d) => d.toBase58()),
  };
}

/** Members and the next transaction index of a multisig (apps/web never imports @sqds/multisig directly). */
export async function readMultisig(connection: Connection, multisigPda: PublicKey): Promise<{ members: PublicKey[]; nextTransactionIndex: bigint }> {
  const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  return { members: ms.members.map((m) => m.key), nextTransactionIndex: BigInt(ms.transactionIndex.toString()) + 1n };
}
