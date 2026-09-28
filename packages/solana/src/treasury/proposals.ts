/**
 * Proposals (SPEC F7 "anything else"): the agent (Initiate only) creates a vault
 * transaction + proposal on the treasury multisig; the owner approves and executes
 * with one signature from the Privy wallet. Kutip's fee payer pays the fee.
 */
import type { createStore } from "@kutip/db";
import { TOKEN_PROGRAM_ID, createTransferCheckedInstruction, getAssociatedTokenAddressSync, transferCheckedInstructionData } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount, type TransactionInstruction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { assertFeePayerAbsent } from "../shared/audit";
import { USDC_DECIMALS, VAULT_INDEX, toSdkAmount } from "./config";
import type { MultisigAccounts } from "./provision";
import { buildV0, sendV0 } from "./rpc";

/** The inner transaction the vault will execute: USDC transferChecked to `destinationOwner`'s ATA. */
export function transferMessage(p: { vault: MultisigAccounts; destinationOwner: PublicKey; usdcMint: PublicKey; amountUsdc: bigint; blockhash: string }): TransactionMessage {
  const amount = toSdkAmount(p.amountUsdc, "transfer amount");
  const destinationAta = getAssociatedTokenAddressSync(p.usdcMint, p.destinationOwner, true);
  return new TransactionMessage({
    payerKey: p.vault.vaultPda,
    recentBlockhash: p.blockhash,
    instructions: [createTransferCheckedInstruction(p.vault.vaultAta, p.usdcMint, destinationAta, p.vault.vaultPda, amount, USDC_DECIMALS)],
  });
}

export function proposalInstructions(p: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  rentPayer: PublicKey;
  message: TransactionMessage;
  memo?: string;
}): TransactionInstruction[] {
  const common = { multisigPda: p.multisigPda, transactionIndex: p.transactionIndex, creator: p.creator, rentPayer: p.rentPayer };
  return [
    multisig.instructions.vaultTransactionCreate({ ...common, vaultIndex: VAULT_INDEX, ephemeralSigners: 0, transactionMessage: p.message, memo: p.memo }),
    multisig.instructions.proposalCreate(common),
  ];
}

export type UsdcTransfer = { destinationAta: string; amountUsdc: bigint };

/** Reads a single SPL transferChecked out of a stored VaultTransactionMessage; null for anything else. */
export function decodeUsdcTransfer(m: multisig.generated.VaultTransactionMessage): UsdcTransfer | null {
  if (m.instructions.length !== 1) return null;
  const ix = m.instructions[0]!;
  const program = m.accountKeys[ix.programIdIndex];
  if (!program?.equals(TOKEN_PROGRAM_ID)) return null;
  const data = Buffer.from(ix.data);
  if (data.length !== transferCheckedInstructionData.span || data[0] !== 12 /* TokenInstruction.TransferChecked */) return null;
  const { amount } = transferCheckedInstructionData.decode(data);
  const destination = m.accountKeys[ix.accountIndexes[2]!];
  if (!destination) return null;
  return { destinationAta: destination.toBase58(), amountUsdc: amount };
}

export type ProposalView = {
  transactionIndex: string;
  status: multisig.generated.ProposalStatus["__kind"];
  statusAt: string; // ISO
  creator: string;
  transfer: UsdcTransfer | null;
  approvedBy: string[];
};

/** Every proposal on a multisig, newest first (indexes 1..transactionIndex). */
export async function listProposals(connection: Connection, multisigPda: PublicKey): Promise<ProposalView[]> {
  const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const last = BigInt(ms.transactionIndex.toString());
  const out: ProposalView[] = [];
  for (let i = last; i >= 1n; i--) {
    const [proposalPda] = multisig.getProposalPda({ multisigPda, transactionIndex: i });
    const [transactionPda] = multisig.getTransactionPda({ multisigPda, index: i });
    const [proposalInfo, txInfo] = await connection.getMultipleAccountsInfo([proposalPda, transactionPda]);
    if (!proposalInfo || !txInfo) continue; // closed (rent reclaimed) or a config tx without a proposal yet
    const [proposal] = multisig.accounts.Proposal.fromAccountInfo(proposalInfo);
    let transfer: UsdcTransfer | null = null;
    let creator = "";
    try {
      const [vaultTx] = multisig.accounts.VaultTransaction.fromAccountInfo(txInfo);
      transfer = decodeUsdcTransfer(vaultTx.message);
      creator = vaultTx.creator.toBase58();
    } catch {
      /* a ConfigTransaction, not a vault transaction */
    }
    out.push({
      transactionIndex: i.toString(),
      status: proposal.status.__kind,
      statusAt: "timestamp" in proposal.status ? new Date(Number(proposal.status.timestamp.toString()) * 1000).toISOString() : "",
      creator,
      transfer,
      approvedBy: proposal.approved.map((k) => k.toBase58()),
    });
  }
  return out;
}

/**
 * The owner is a full member of their multisig and can create vault transactions directly on-chain.
 * Execute passes every inner account through, and a key's signer flag is per transaction, so an inner
 * instruction naming the fee payer would spend with its signature. Only execute what Kutip's agent
 * built: one USDC transferChecked out of the treasury vault ATA, with no fee-payer account.
 */
export function assertApprovableTransfer(tx: { creator: PublicKey; message: multisig.generated.VaultTransactionMessage }, expect: { agent: PublicKey; feePayer: PublicKey; vaultAta: PublicKey }): void {
  if (!tx.creator.equals(expect.agent)) throw new Error("only proposals created by Kutip's agent can be approved here");
  if (tx.message.accountKeys.some((k) => k.equals(expect.feePayer))) throw new Error("proposal references the fee payer; refusing to sign");
  if (tx.message.addressTableLookups.length > 0 || !decodeUsdcTransfer(tx.message)) throw new Error("proposal is not a single USDC transfer");
  const ix = tx.message.instructions[0]!;
  const source = tx.message.accountKeys[ix.accountIndexes[0]!];
  if (!source?.equals(expect.vaultAta)) throw new Error("proposal does not move USDC out of the treasury vault");
}

/** proposalApprove + vaultTransactionExecute for the owner, in one transaction (threshold 1, no time lock). */
export async function approveExecuteInstructions(p: {
  connection: Connection;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  expect: { agent: PublicKey; feePayer: PublicKey; vaultAta: PublicKey };
}): Promise<{ ixs: TransactionInstruction[]; lookupTables: AddressLookupTableAccount[] }> {
  const [transactionPda] = multisig.getTransactionPda({ multisigPda: p.multisigPda, index: p.transactionIndex });
  assertApprovableTransfer(await multisig.accounts.VaultTransaction.fromAccountAddress(p.connection, transactionPda), p.expect);
  const approve = multisig.instructions.proposalApprove({ multisigPda: p.multisigPda, transactionIndex: p.transactionIndex, member: p.member });
  const { instruction, lookupTableAccounts } = await multisig.instructions.vaultTransactionExecute({ connection: p.connection, multisigPda: p.multisigPda, transactionIndex: p.transactionIndex, member: p.member });
  return { ixs: [approve, instruction], lookupTables: lookupTableAccounts };
}

/**
 * A v0 transaction with Kutip's fee payer as payer, already signed by it. The
 * owner adds the second signature client-side (Privy signTransaction) and posts
 * the fully-signed bytes back to be sent. The fee-payer signature covers the
 * message, so the client cannot alter it.
 */
export async function buildOwnerTx(p: {
  connection: Connection;
  feePayer: Keypair;
  ixs: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[];
  /** Squads config transactions (spending-limit re-issue) name the fee payer as rent payer; nothing else may. */
  feePayerPaysSquadsRent?: boolean;
}): Promise<{ base64: string; lastValidBlockHeight: number }> {
  // D4: the fee payer signs first, so any instruction that names it could spend with its signature.
  assertFeePayerAbsent(p.feePayerPaysSquadsRent ? p.ixs.filter((ix) => !ix.programId.equals(multisig.PROGRAM_ID)) : p.ixs, p.feePayer.publicKey);
  const { tx, lastValidBlockHeight } = await buildV0(p.connection, p.feePayer.publicKey, p.ixs, p.lookupTables ?? []);
  tx.sign([p.feePayer]);
  return { base64: Buffer.from(tx.serialize()).toString("base64"), lastValidBlockHeight };
}

/** Parses an owner-signed transaction and checks both signatures are present before it is sent. */
export function parseSignedOwnerTx(base64: string, feePayer: PublicKey, owner: PublicKey): VersionedTransaction {
  const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
  const keys = tx.message.staticAccountKeys;
  const signed = (k: PublicKey) => {
    const i = keys.findIndex((x) => x.equals(k));
    return i >= 0 && i < tx.message.header.numRequiredSignatures && tx.signatures[i]!.some((b) => b !== 0);
  };
  if (!keys[0]?.equals(feePayer)) throw new Error("fee payer is not this transaction's payer");
  if (!signed(feePayer)) throw new Error("fee payer signature missing");
  if (!signed(owner)) throw new Error("owner signature missing");
  return tx;
}

// ---------------------------------------------------------------------------
// Runner: the agent proposes a USDC move out of the treasury (e.g. cash-out).
// ---------------------------------------------------------------------------

type Store = ReturnType<typeof createStore>;
export type ProposalStore = Pick<Store, "getExporter" | "getTreasury" | "recordAgentAction">;

export async function createTransferProposal(d: {
  connection: Connection;
  feePayer: Keypair;
  agent: Keypair;
  usdcMint: PublicKey;
  store: ProposalStore;
  exporterId: string;
  destinationOwner: PublicKey;
  amountUsdc: bigint;
  memo: string;
  confirm?: (lines: string[]) => Promise<void>;
}): Promise<{ transactionIndex: bigint; signature: string; actionId: string }> {
  const exporter = await d.store.getExporter(d.exporterId);
  if (!exporter) throw new Error(`exporter not found: ${d.exporterId}`);
  const treasury = await d.store.getTreasury(d.exporterId);
  const whitelisted = treasury.cashOut.whitelisted.find((w) => w.address === d.destinationOwner.toBase58());
  if (!whitelisted) throw new Error("destination is not on the owner's cash-out whitelist");
  const vault: MultisigAccounts = {
    multisigPda: new PublicKey(exporter.treasuryMultisig),
    vaultPda: new PublicKey(exporter.treasuryVault),
    vaultAta: new PublicKey(exporter.treasuryUsdcAta),
  };
  const ms = await multisig.accounts.Multisig.fromAccountAddress(d.connection, vault.multisigPda);
  const transactionIndex = BigInt(ms.transactionIndex.toString()) + 1n;
  const { blockhash } = await d.connection.getLatestBlockhash();
  const message = transferMessage({ vault, destinationOwner: d.destinationOwner, usdcMint: d.usdcMint, amountUsdc: d.amountUsdc, blockhash });
  const ixs = proposalInstructions({ multisigPda: vault.multisigPda, transactionIndex, creator: d.agent.publicKey, rentPayer: d.feePayer.publicKey, message, memo: d.memo });
  if (d.confirm) {
    await d.confirm([
      `proposal #${transactionIndex} on treasury multisig ${vault.multisigPda.toBase58()}`,
      `  transferChecked ${d.amountUsdc} USDC base units: ${vault.vaultAta.toBase58()} → ATA of ${d.destinationOwner.toBase58()} (${whitelisted.label})`,
      `  creator AGENT ${d.agent.publicKey.toBase58()} (Initiate), rent payer FEE_PAYER ${d.feePayer.publicKey.toBase58()} (vault tx + proposal rent, reclaimable after execution)`,
    ]);
  }
  const signature = await sendV0(d.connection, d.feePayer, ixs, [d.agent]);
  const action = await d.store.recordAgentAction({
    exporterId: d.exporterId,
    kind: "cash_out_alert",
    inputSummary: `proposal #${transactionIndex}: USDC ${d.amountUsdc} to ${whitelisted.label}`,
    decision: `Proposed moving USDC ${formatUsdc(d.amountUsdc)} from the treasury to ${whitelisted.label}`,
    reason: "Any movement other than the daily sweep needs the owner's approval",
    confidence: 1,
    ruleId: "T4",
    status: "proposed",
    txSignature: signature,
    proposalIndex: transactionIndex,
  });
  return { transactionIndex, signature, actionId: action.id };
}

const formatUsdc = (base: bigint) => `${base / 1_000_000n}.${(base % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "") || "0"}`;
