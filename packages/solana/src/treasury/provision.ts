/**
 * Squads v4 provisioning (SPEC F1/F2, DECISIONS D1/D3, post-spike decision #6).
 * Pure builders here are unit-tested; `provisionMultisig` / `ensureSpendingLimit`
 * talk to the chain and are exercised by scripts/provision-demo.ts on mainnet.
 */
import { createHmac } from "node:crypto";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { VAULT_INDEX, toSdkAmount } from "./config";
import { sendV0 } from "./rpc";

const { Permission, Permissions, Period } = multisig.types;
type Member = multisig.types.Member;
type ConfigAction = multisig.types.ConfigAction;

/**
 * Deterministic create key: HMAC(secret, label) as an ed25519 seed. The multisig
 * PDA is derived from it, so re-running provisioning finds the same accounts and
 * skips what already exists. The secret keeps the PDA unguessable (the create
 * key must sign at creation, which is what stops front-running).
 */
export function createKeyFor(secret: Uint8Array, label: string): Keypair {
  const seed = createHmac("sha256", Buffer.from(secret)).update(`kutip:${label}`).digest();
  return Keypair.fromSeed(seed.subarray(0, 32));
}

/** Owner = all permissions; agent = Initiate only (can propose, never vote or execute). */
export function multisigMembers({ owner, agent }: { owner: PublicKey; agent: PublicKey }): Member[] {
  return [
    { key: owner, permissions: Permissions.all() },
    { key: agent, permissions: Permissions.fromPermissions([Permission.Initiate]) },
  ];
}

export type MultisigAccounts = { multisigPda: PublicKey; vaultPda: PublicKey; vaultAta: PublicKey };

export function deriveAccounts(createKey: PublicKey, usdcMint: PublicKey): MultisigAccounts {
  const [multisigPda] = multisig.getMultisigPda({ createKey });
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX });
  return { multisigPda, vaultPda, vaultAta: vaultAtaOf(vaultPda, usdcMint) };
}

export const vaultAtaOf = (owner: PublicKey, usdcMint: PublicKey) =>
  getAssociatedTokenAddressSync(usdcMint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

/**
 * AddSpendingLimit for a buyer multisig. `destinations` holds the destination
 * OWNER: the treasury vault PDA, never its USDC ATA (Spike B; decision #6).
 */
export function spendingLimitAction(p: {
  createKey: PublicKey;
  agent: PublicKey;
  usdcMint: PublicKey;
  amountUsdc: bigint;
  treasuryVaultPda: PublicKey;
  /** Only here so a caller cannot confuse the two; it is never allowlisted. */
  treasuryVaultAta: PublicKey;
}): ConfigAction {
  if (p.treasuryVaultPda.equals(p.treasuryVaultAta)) throw new Error("treasury vault PDA and ATA must differ");
  return {
    __kind: "AddSpendingLimit",
    createKey: p.createKey,
    vaultIndex: VAULT_INDEX,
    mint: p.usdcMint,
    amount: toSdkAmount(p.amountUsdc, "spending limit"),
    period: Period.Day,
    members: [p.agent],
    destinations: [p.treasuryVaultPda],
  };
}

export type SpendingLimitSpec = { createKey: PublicKey; amountUsdc: bigint; treasury: MultisigAccounts };

/**
 * One transaction per multisig, signed by the fee payer + create key only:
 *   1. multisigCreateV2 — controlled by the fee payer just for this tx (so no owner
 *      signature / proposal round-trip is needed for the spending limit),
 *   2. multisigAddSpendingLimit (buyers only),
 *   3. multisigSetConfigAuthority → default pubkey = autonomous; from here only the
 *      members (owner) can change config, via proposals,
 *   4. the vault's USDC ATA (D4: pre-created, never inside a payment).
 * The owner's Privy wallet never signs during provisioning.
 */
export function provisionInstructions(p: {
  feePayer: PublicKey;
  owner: PublicKey;
  agent: PublicKey;
  usdcMint: PublicKey;
  createKey: PublicKey;
  /** ProgramConfig.treasury (protocol fee account), read on-chain by the caller. */
  programTreasury: PublicKey;
  spendingLimit?: SpendingLimitSpec;
}): TransactionInstruction[] {
  const { multisigPda, vaultPda, vaultAta } = deriveAccounts(p.createKey, p.usdcMint);
  const controlled = p.spendingLimit !== undefined;
  const ixs: TransactionInstruction[] = [
    multisig.instructions.multisigCreateV2({
      treasury: p.programTreasury,
      createKey: p.createKey,
      creator: p.feePayer,
      multisigPda,
      configAuthority: controlled ? p.feePayer : null,
      threshold: 1,
      members: multisigMembers({ owner: p.owner, agent: p.agent }),
      timeLock: 0,
      rentCollector: p.feePayer,
    }),
  ];
  if (p.spendingLimit) {
    const action = spendingLimitAction({
      createKey: p.spendingLimit.createKey,
      agent: p.agent,
      usdcMint: p.usdcMint,
      amountUsdc: p.spendingLimit.amountUsdc,
      treasuryVaultPda: p.spendingLimit.treasury.vaultPda,
      treasuryVaultAta: p.spendingLimit.treasury.vaultAta,
    });
    if (action.__kind !== "AddSpendingLimit") throw new Error("unreachable");
    const [spendingLimit] = multisig.getSpendingLimitPda({ multisigPda, createKey: action.createKey });
    ixs.push(
      multisig.instructions.multisigAddSpendingLimit({
        multisigPda,
        configAuthority: p.feePayer,
        rentPayer: p.feePayer,
        spendingLimit,
        createKey: action.createKey,
        vaultIndex: action.vaultIndex,
        mint: action.mint,
        amount: p.spendingLimit.amountUsdc,
        period: action.period,
        members: action.members,
        destinations: action.destinations,
      }),
      multisig.instructions.multisigSetConfigAuthority({ multisigPda, configAuthority: p.feePayer, newConfigAuthority: PublicKey.default }),
    );
  }
  ixs.push(createAssociatedTokenAccountIdempotentInstruction(p.feePayer, vaultAta, vaultPda, p.usdcMint));
  return ixs;
}

export function spendingLimitPdaFor(multisigPda: PublicKey, createKey: PublicKey): PublicKey {
  return multisig.getSpendingLimitPda({ multisigPda, createKey })[0];
}

// ---------------------------------------------------------------------------
// Chain-touching steps. Idempotent: read first, return `skipped` when the account
// already exists. `confirm` gets the plan before any write and must resolve (or
// throw to abort).
// ---------------------------------------------------------------------------

export type Confirm = (lines: string[]) => Promise<void>;
export type StepResult = { signature?: string; skipped: boolean };

export async function provisionMultisig(p: {
  connection: Connection;
  feePayer: Keypair;
  createKey: Keypair;
  owner: PublicKey;
  agent: PublicKey;
  usdcMint: PublicKey;
  label: string;
  spendingLimit?: SpendingLimitSpec;
  confirm: Confirm;
}): Promise<StepResult & MultisigAccounts & { spendingLimitPda?: PublicKey }> {
  const accounts = deriveAccounts(p.createKey.publicKey, p.usdcMint);
  const spendingLimitPda = p.spendingLimit ? spendingLimitPdaFor(accounts.multisigPda, p.spendingLimit.createKey) : undefined;
  if (await p.connection.getAccountInfo(accounts.multisigPda)) return { ...accounts, spendingLimitPda, skipped: true };

  const [programConfigPda] = multisig.getProgramConfigPda({});
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(p.connection, programConfigPda);
  const creationFee = BigInt(programConfig.multisigCreationFee.toString());
  const ixs = provisionInstructions({
    feePayer: p.feePayer.publicKey,
    owner: p.owner,
    agent: p.agent,
    usdcMint: p.usdcMint,
    createKey: p.createKey.publicKey,
    programTreasury: programConfig.treasury,
    spendingLimit: p.spendingLimit,
  });
  await p.confirm([
    `provision ${p.label}: multisig ${accounts.multisigPda.toBase58()} (${ixs.length} ixs, one tx)`,
    `  members: owner ${p.owner.toBase58()} = all; agent ${p.agent.toBase58()} = Initiate; threshold 1; final config authority = none (autonomous)`,
    `  creator/rent payer ${p.feePayer.publicKey.toBase58()}, creation fee ${creationFee} lamports`,
    `  vault[0] ${accounts.vaultPda.toBase58()}  USDC ATA ${accounts.vaultAta.toBase58()} (created)`,
    ...(p.spendingLimit
      ? [
          `  spending limit ${spendingLimitPda!.toBase58()}: USDC ${p.spendingLimit.amountUsdc} base units / Day, members [agent],`,
          `    destinations [treasury VAULT PDA ${p.spendingLimit.treasury.vaultPda.toBase58()}]`,
        ]
      : []),
  ]);
  const signature = await sendV0(p.connection, p.feePayer, ixs, [p.createKey]);
  return { ...accounts, spendingLimitPda, signature, skipped: false };
}

/** Safety net for partially provisioned accounts: create any vault USDC ATA that is missing. */
export async function ensureAtas(p: {
  connection: Connection;
  feePayer: Keypair;
  usdcMint: PublicKey;
  vaults: Array<{ label: string; vaultPda: PublicKey; vaultAta: PublicKey }>;
  confirm: Confirm;
}): Promise<StepResult> {
  const infos = await p.connection.getMultipleAccountsInfo(p.vaults.map((v) => v.vaultAta));
  const missing = p.vaults.filter((_, i) => !infos[i]);
  if (missing.length === 0) return { skipped: true };
  await p.confirm([
    `createAssociatedTokenAccountIdempotent x${missing.length}, payer ${p.feePayer.publicKey.toBase58()}`,
    ...missing.map((v) => `  ${v.label}: ATA ${v.vaultAta.toBase58()} (owner ${v.vaultPda.toBase58()})`),
  ]);
  const ixs = missing.map((v) => createAssociatedTokenAccountIdempotentInstruction(p.feePayer.publicKey, v.vaultAta, v.vaultPda, p.usdcMint));
  return { signature: await sendV0(p.connection, p.feePayer, ixs, []), skipped: false };
}
