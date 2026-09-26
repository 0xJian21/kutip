// Spike B — Squads v4 spending-limit sweep on MAINNET.
//
// Run:  pnpm --filter @kutip/spikes exec tsx b-squads/run.ts [--yes]   (--yes skips the per-write prompt)
// Env:  repo-root .env (SOLAMI_RPC_URL, FEE_PAYER_SECRET, AGENT_SECRET, TEST_BUYER_SECRET, USDC_MINT)
//
// Every mainnet write prints what it is about to do and waits for `y`.
// Progress is saved to state.json after each step so the script can be re-run and resume.
//
// Verified against @sqds/multisig 2.1.4 / Squads-Protocol/v4 main (see ../notes/b-squads.md).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  TransactionMessage,
  VersionedTransaction,
  type Signer,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as multisig from "@sqds/multisig";
import bs58 from "bs58";

const { Permission, Permissions, Period } = multisig.types;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HERE = import.meta.dirname;
process.loadEnvFile(join(HERE, "..", "..", ".env"));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

// Solami's WS lives at /ws/sol, not at the RPC path web3.js would guess (which 405s).
const RPC_URL = env("SOLAMI_RPC_URL");
const WS_URL = RPC_URL.replace(/^http/, "ws").replace("/sol", "/ws/sol");
const connection = new Connection(RPC_URL, { commitment: "confirmed", wsEndpoint: WS_URL });
const USDC = new PublicKey(env("USDC_MINT"));
const USDC_DECIMALS = 6;

const FEE_PAYER = Keypair.fromSecretKey(bs58.decode(env("FEE_PAYER_SECRET")));
const AGENT = Keypair.fromSecretKey(bs58.decode(env("AGENT_SECRET")));
const OWNER = Keypair.fromSecretKey(bs58.decode(env("TEST_BUYER_SECRET"))); // stands in for the Privy owner

const VAULT_INDEX = 0;
const LIMIT_AMOUNT = 1_000_000n; // 1 USDC per Day
const FUND_AMOUNT = 500_000n; // 0.5 USDC into the buyer vault
const SWEEP_AMOUNT = 500_000n; // 0.5 USDC agent sweep
const CU_PRICE_MICRO_LAMPORTS = 50_000; // cap (D4). 200k CU * 50k µL = 0.00001 SOL
const CU_LIMIT = 200_000;

// ---------------------------------------------------------------------------
// State (resumable). Contains only public keys + signatures, never secrets.
// ---------------------------------------------------------------------------

type State = {
  balancesBefore?: Record<string, string>; // lamports as string
  buyer?: { createKey: string; multisigPda: string; vaultPda: string; vaultAta: string; sig: string };
  treasury?: { createKey: string; multisigPda: string; vaultPda: string; vaultAta: string; sig: string };
  atasSig?: string;
  spendingLimit?: {
    createKey: string;
    pda: string;
    transactionIndex: string;
    createProposeApproveSig: string;
    executeSig?: string;
  };
  fundSig?: string;
  sweepSig?: string;
  negative?: { destination: string; errorName: string; errorCode: string; logs: string[] };
  balancesAfter?: Record<string, string>;
};

const STATE_PATH = join(HERE, "state.json");
const state: State = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : {};
function save() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: stdin, output: stdout });

async function confirmOrAbort(what: string[]) {
  console.log("\n  ABOUT TO WRITE TO MAINNET:");
  for (const line of what) console.log("    " + line);
  // --yes: the user already confirmed the printed plan out-of-band (the Claude Code shell has no TTY).
  const answer = process.argv.includes("--yes") ? "y" : await rl.question("  proceed? [y/N] ");
  if (answer.trim() !== "y") {
    console.log("aborted by user; state.json kept, re-run to resume");
    process.exit(1);
  }
}

const sol = (lamports: number | bigint) => `${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`;

async function rent(bytes: number) {
  return connection.getMinimumBalanceForRentExemption(bytes);
}

// Builds a v0 tx with a CU cap, signs, sends with preflight, confirms.
async function send(ixs: TransactionInstruction[], signers: Signer[]): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: FEE_PAYER.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE_MICRO_LAMPORTS }),
      ...ixs,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign(signers);
  const sig = await connection.sendTransaction(tx);
  await confirmByPolling(sig, lastValidBlockHeight);
  console.log(`  ok  https://solscan.io/tx/${sig}`);
  return sig;
}

// Poll getSignatureStatuses instead of confirmTransaction: no WebSocket dependency.
async function confirmByPolling(sig: string, lastValidBlockHeight: number) {
  for (;;) {
    const st = (await connection.getSignatureStatuses([sig])).value[0];
    if (st?.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(st.err)}`);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    if ((await connection.getBlockHeight()) > lastValidBlockHeight) {
      throw new Error(`tx ${sig} not confirmed before block height ${lastValidBlockHeight}; check Solscan before re-running`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function balances(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, kp] of [
    ["FEE_PAYER", FEE_PAYER],
    ["OWNER(TEST_BUYER)", OWNER],
    ["AGENT", AGENT],
  ] as const) {
    out[name] = String(await connection.getBalance(kp.publicKey));
  }
  return out;
}

async function usdcBalance(ata: PublicKey): Promise<bigint> {
  try {
    return (await getAccount(connection, ata)).amount;
  } catch {
    return 0n;
  }
}

const vaultAtaOf = (vaultPda: PublicKey) =>
  getAssociatedTokenAddressSync(USDC, vaultPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

// Account sizes from programs/squads_multisig_program/src/state/*.rs (for rent estimates).
const MULTISIG_SIZE = (members: number) => 8 + 32 + 32 + 2 + 4 + 8 + 8 + 1 + 32 + 1 + 4 + members * 33;
const PROPOSAL_SIZE = (members: number) => 8 + 32 + 8 + 1 + 8 + 1 + 3 * (4 + members * 32);
const SPENDING_LIMIT_SIZE = (members: number, dests: number) =>
  8 + 32 + 32 + 1 + 32 + 8 + 1 + 8 + 8 + 1 + 4 + members * 32 + 4 + dests * 32;
// ConfigTransaction with one AddSpendingLimit action:
const CONFIG_TX_SIZE = (members: number, dests: number) =>
  8 + 32 + 32 + 8 + 1 + 4 + (1 + 32 + 1 + 32 + 8 + 1 + (4 + members * 32) + (4 + dests * 32));
const ATA_SIZE = 165;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function createMultisig(label: "buyer" | "treasury", treasury: PublicKey, creationFee: bigint) {
  if (state[label]) {
    console.log(`  already done: ${label} multisig ${state[label]!.multisigPda}`);
    return;
  }
  const createKey = Keypair.generate(); // ephemeral; only needed as a signer at creation
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX });
  const vaultAta = vaultAtaOf(vaultPda);
  const members = [
    { key: OWNER.publicKey, permissions: Permissions.all() },
    { key: AGENT.publicKey, permissions: Permissions.fromPermissions([Permission.Initiate]) },
  ];
  const rentLamports = await rent(MULTISIG_SIZE(members.length));

  await confirmOrAbort([
    `multisigCreateV2 (${label})`,
    `  multisigPda   ${multisigPda.toBase58()}`,
    `  createKey     ${createKey.publicKey.toBase58()} (ephemeral signer)`,
    `  creator/payer ${FEE_PAYER.publicKey.toBase58()} (pays rent + creation fee)`,
    `  members       OWNER ${OWNER.publicKey.toBase58()} = all; AGENT ${AGENT.publicKey.toBase58()} = Initiate`,
    `  threshold 1, timeLock 0, configAuthority null (autonomous), rentCollector ${FEE_PAYER.publicKey.toBase58()}`,
    `  vault[0]      ${vaultPda.toBase58()}  (USDC ATA ${vaultAta.toBase58()})`,
    `  est. cost     rent ${sol(rentLamports)} + creation fee ${sol(creationFee)} + tx fee`,
  ]);

  const ix = multisig.instructions.multisigCreateV2({
    treasury,
    createKey: createKey.publicKey,
    creator: FEE_PAYER.publicKey,
    multisigPda,
    configAuthority: null,
    threshold: 1,
    members,
    timeLock: 0,
    rentCollector: FEE_PAYER.publicKey,
    memo: `k_spikeB_${label}`,
  });
  const sig = await send([ix], [FEE_PAYER, createKey]);
  state[label] = {
    createKey: createKey.publicKey.toBase58(),
    multisigPda: multisigPda.toBase58(),
    vaultPda: vaultPda.toBase58(),
    vaultAta: vaultAta.toBase58(),
    sig,
  };
  save();
}

async function main() {
  console.log("Spike B — Squads v4 spending-limit sweep (mainnet)");
  console.log(`  program   ${multisig.PROGRAM_ID.toBase58()}`);
  console.log(`  FEE_PAYER ${FEE_PAYER.publicKey.toBase58()}`);
  console.log(`  OWNER     ${OWNER.publicKey.toBase58()} (TEST_BUYER)`);
  console.log(`  AGENT     ${AGENT.publicKey.toBase58()}`);

  // STEP 0 — read ProgramConfig + balances (read-only)
  console.log("\nSTEP 0  ProgramConfig + balances");
  const [programConfigPda] = multisig.getProgramConfigPda({});
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda);
  const creationFee = BigInt(programConfig.multisigCreationFee.toString());
  console.log(`  programConfig        ${programConfigPda.toBase58()}`);
  console.log(`  treasury             ${programConfig.treasury.toBase58()}`);
  console.log(`  multisigCreationFee  ${sol(creationFee)} (${creationFee} lamports)`);
  if (!state.balancesBefore) {
    state.balancesBefore = await balances();
    save();
  }
  for (const [k, v] of Object.entries(state.balancesBefore)) console.log(`  ${k.padEnd(18)} ${sol(BigInt(v))}`);
  const ownerUsdcAta = getAssociatedTokenAddressSync(USDC, OWNER.publicKey);
  console.log(`  OWNER USDC ATA       ${ownerUsdcAta.toBase58()} = ${await usdcBalance(ownerUsdcAta)} base units`);

  // STEP 1 / 2 — create multisigs
  console.log("\nSTEP 1  create buyer multisig");
  await createMultisig("buyer", programConfig.treasury, creationFee);
  console.log("\nSTEP 2  create treasury multisig");
  await createMultisig("treasury", programConfig.treasury, creationFee);

  const buyer = {
    multisigPda: new PublicKey(state.buyer!.multisigPda),
    vaultPda: new PublicKey(state.buyer!.vaultPda),
    vaultAta: new PublicKey(state.buyer!.vaultAta),
  };
  const treasury = {
    multisigPda: new PublicKey(state.treasury!.multisigPda),
    vaultPda: new PublicKey(state.treasury!.vaultPda),
    vaultAta: new PublicKey(state.treasury!.vaultAta),
  };

  // STEP 3 — pre-create vault USDC ATAs (idempotent)
  console.log("\nSTEP 3  create vault USDC ATAs");
  if (state.atasSig) {
    console.log(`  already done: ${state.atasSig}`);
  } else {
    const ataRent = await rent(ATA_SIZE);
    await confirmOrAbort([
      `createAssociatedTokenAccountIdempotent x2, payer ${FEE_PAYER.publicKey.toBase58()}`,
      `  buyer vault ATA     ${buyer.vaultAta.toBase58()} (owner ${buyer.vaultPda.toBase58()})`,
      `  treasury vault ATA  ${treasury.vaultAta.toBase58()} (owner ${treasury.vaultPda.toBase58()})`,
      `  est. cost           2 x ${sol(ataRent)} + tx fee`,
    ]);
    state.atasSig = await send(
      [
        createAssociatedTokenAccountIdempotentInstruction(FEE_PAYER.publicKey, buyer.vaultAta, buyer.vaultPda, USDC),
        createAssociatedTokenAccountIdempotentInstruction(
          FEE_PAYER.publicKey,
          treasury.vaultAta,
          treasury.vaultPda,
          USDC,
        ),
      ],
      [FEE_PAYER],
    );
    save();
  }

  // STEP 4 — add spending limit via config tx → proposal → approve → execute
  console.log("\nSTEP 4  add spending limit on buyer multisig");
  if (!state.spendingLimit) {
    const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, buyer.multisigPda);
    const transactionIndex = BigInt(ms.transactionIndex.toString()) + 1n;
    const slCreateKey = Keypair.generate().publicKey; // just a seed, never signs
    const [spendingLimitPda] = multisig.getSpendingLimitPda({ multisigPda: buyer.multisigPda, createKey: slCreateKey });
    const [proposalPda] = multisig.getProposalPda({ multisigPda: buyer.multisigPda, transactionIndex });
    const [transactionPda] = multisig.getTransactionPda({ multisigPda: buyer.multisigPda, index: transactionIndex });
    const cfgRent = await rent(CONFIG_TX_SIZE(1, 1));
    const propRent = await rent(PROPOSAL_SIZE(2));

    await confirmOrAbort([
      `configTransactionCreate + proposalCreate + proposalApprove (one tx) on ${buyer.multisigPda.toBase58()}`,
      `  transactionIndex   ${transactionIndex}`,
      `  transaction PDA    ${transactionPda.toBase58()}`,
      `  proposal PDA       ${proposalPda.toBase58()}`,
      `  action             AddSpendingLimit { createKey ${slCreateKey.toBase58()}, vaultIndex ${VAULT_INDEX},`,
      `                       mint USDC, amount ${LIMIT_AMOUNT} (1 USDC), period Day,`,
      `                       members [AGENT ${AGENT.publicKey.toBase58()}],`,
      `                       destinations [treasury VAULT PDA ${treasury.vaultPda.toBase58()}] }`,
      `  NOTE: destinations hold the destination OWNER (vault PDA), not the ATA — see notes/b-squads.md`,
      `  creator/voter      OWNER ${OWNER.publicKey.toBase58()}; rent payer FEE_PAYER`,
      `  est. cost          config tx rent ${sol(cfgRent)} + proposal rent ${sol(propRent)} + tx fee (reclaimable via rentCollector)`,
    ]);

    // beet.bignum is number | BN; the SDK does not take bigint. 1_000_000 is well inside safe-integer range.
    if (LIMIT_AMOUNT > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("amount too large for SDK number");
    const createProposeApproveSig = await send(
      [
        multisig.instructions.configTransactionCreate({
          multisigPda: buyer.multisigPda,
          transactionIndex,
          creator: OWNER.publicKey,
          rentPayer: FEE_PAYER.publicKey,
          actions: [
            {
              __kind: "AddSpendingLimit",
              createKey: slCreateKey,
              vaultIndex: VAULT_INDEX,
              mint: USDC,
              amount: Number(LIMIT_AMOUNT),
              period: Period.Day,
              members: [AGENT.publicKey],
              destinations: [treasury.vaultPda],
            },
          ],
          memo: "k_spikeB_limit",
        }),
        multisig.instructions.proposalCreate({
          multisigPda: buyer.multisigPda,
          transactionIndex,
          creator: OWNER.publicKey,
          rentPayer: FEE_PAYER.publicKey,
        }),
        multisig.instructions.proposalApprove({
          multisigPda: buyer.multisigPda,
          transactionIndex,
          member: OWNER.publicKey,
        }),
      ],
      [FEE_PAYER, OWNER],
    );
    state.spendingLimit = {
      createKey: slCreateKey.toBase58(),
      pda: spendingLimitPda.toBase58(),
      transactionIndex: transactionIndex.toString(),
      createProposeApproveSig,
    };
    save();
  } else {
    console.log(`  already done: create+propose+approve ${state.spendingLimit.createProposeApproveSig}`);
  }

  const spendingLimitPda = new PublicKey(state.spendingLimit.pda);
  if (!state.spendingLimit.executeSig) {
    const transactionIndex = BigInt(state.spendingLimit.transactionIndex);
    const slRent = await rent(SPENDING_LIMIT_SIZE(1, 1));
    await confirmOrAbort([
      `configTransactionExecute on ${buyer.multisigPda.toBase58()} index ${transactionIndex}`,
      `  executor          OWNER ${OWNER.publicKey.toBase58()} (needs Execute permission)`,
      `  rentPayer         FEE_PAYER (pays SpendingLimit account rent)`,
      `  spendingLimit PDA ${spendingLimitPda.toBase58()} (passed as remaining account)`,
      `  est. cost         ${sol(slRent)} + tx fee`,
    ]);
    state.spendingLimit.executeSig = await send(
      [
        multisig.instructions.configTransactionExecute({
          multisigPda: buyer.multisigPda,
          transactionIndex,
          member: OWNER.publicKey,
          rentPayer: FEE_PAYER.publicKey,
          spendingLimits: [spendingLimitPda],
        }),
      ],
      [FEE_PAYER, OWNER],
    );
    save();
  } else {
    console.log(`  already done: execute ${state.spendingLimit.executeSig}`);
  }
  const sl = await multisig.accounts.SpendingLimit.fromAccountAddress(connection, spendingLimitPda);
  console.log(
    `  on-chain SpendingLimit: amount ${sl.amount} remaining ${sl.remainingAmount} period ${Period[sl.period]} ` +
      `members [${sl.members.map((m) => m.toBase58()).join(", ")}] destinations [${sl.destinations.map((d) => d.toBase58()).join(", ")}]`,
  );

  // STEP 5 — fund buyer vault with 0.5 USDC from OWNER's own USDC ATA
  console.log("\nSTEP 5  fund buyer vault 0.5 USDC");
  if (state.fundSig) {
    console.log(`  already done: ${state.fundSig}`);
  } else {
    const have = await usdcBalance(ownerUsdcAta);
    if (have < FUND_AMOUNT) throw new Error(`OWNER USDC ATA has ${have}, need ${FUND_AMOUNT}`);
    await confirmOrAbort([
      `transferChecked ${FUND_AMOUNT} USDC base units (0.5 USDC)`,
      `  from  ${ownerUsdcAta.toBase58()} (OWNER's USDC ATA, authority OWNER)`,
      `  to    ${buyer.vaultAta.toBase58()} (buyer vault ATA)`,
      `  est. cost  tx fee only`,
    ]);
    state.fundSig = await send(
      [createTransferCheckedInstruction(ownerUsdcAta, USDC, buyer.vaultAta, OWNER.publicKey, FUND_AMOUNT, USDC_DECIMALS)],
      [FEE_PAYER, OWNER],
    );
    save();
  }
  console.log(`  buyer vault ATA balance: ${await usdcBalance(buyer.vaultAta)}`);

  // STEP 6 — AGENT sweeps via spendingLimitUse to the treasury vault
  console.log("\nSTEP 6  agent spendingLimitUse → treasury vault ATA");
  if (state.sweepSig) {
    console.log(`  already done: ${state.sweepSig}`);
  } else {
    await confirmOrAbort([
      `spendingLimitUse ${SWEEP_AMOUNT} USDC base units (0.5 USDC)`,
      `  member (signer)  AGENT ${AGENT.publicKey.toBase58()}`,
      `  spendingLimit    ${spendingLimitPda.toBase58()}`,
      `  vault ATA        ${buyer.vaultAta.toBase58()}`,
      `  destination      ${treasury.vaultPda.toBase58()} (OWNER of the destination ATA; SDK derives ATA ${treasury.vaultAta.toBase58()})`,
      `  est. cost        tx fee only (fee payer FEE_PAYER)`,
    ]);
    state.sweepSig = await send(
      [
        multisig.instructions.spendingLimitUse({
          multisigPda: buyer.multisigPda,
          member: AGENT.publicKey,
          spendingLimit: spendingLimitPda,
          mint: USDC,
          vaultIndex: VAULT_INDEX,
          amount: Number(SWEEP_AMOUNT),
          decimals: USDC_DECIMALS,
          destination: treasury.vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          memo: "k_spikeB_sweep",
        }),
      ],
      [FEE_PAYER, AGENT],
    );
    save();
  }
  console.log(`  buyer vault ATA:    ${await usdcBalance(buyer.vaultAta)}`);
  console.log(`  treasury vault ATA: ${await usdcBalance(treasury.vaultAta)}`);

  // STEP 7 — negative test: AGENT tries to send to a non-allowlisted destination.
  // Destination = OWNER wallet: it has a USDC ATA, so the Anchor account constraints pass and we
  // reach the program's `destinations.contains(destination)` check. (A destination with no ATA
  // fails earlier with Anchor AccountNotInitialized 3012, which would not prove the allowlist.)
  console.log("\nSTEP 7  negative test: spendingLimitUse to OWNER wallet (not in allowlist)");
  if (state.negative) {
    console.log(`  already done: ${state.negative.errorName} (${state.negative.errorCode})`);
  } else {
    // 0.1 USDC would still be inside the remaining daily limit (1 - 0.5), so the only reason to fail is the destination.
    const amount = 100_000n;
    await confirmOrAbort([
      `spendingLimitUse ${amount} base units → destination OWNER ${OWNER.publicKey.toBase58()} (NOT allowlisted)`,
      `  expected: preflight simulation fails with Squads error InvalidDestination (0x1789 / 6025); no fee charged`,
    ]);
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = multisig.transactions.spendingLimitUse({
      blockhash,
      feePayer: FEE_PAYER.publicKey,
      multisigPda: buyer.multisigPda,
      member: AGENT.publicKey,
      spendingLimit: spendingLimitPda,
      mint: USDC,
      vaultIndex: VAULT_INDEX,
      amount: Number(amount),
      decimals: USDC_DECIMALS,
      destination: OWNER.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
    tx.sign([FEE_PAYER, AGENT]);
    try {
      const sig = await connection.sendTransaction(tx); // preflight on: rejected before landing
      throw new Error(`NEGATIVE TEST FAILED: transfer to non-allowlisted destination went through: ${sig}`);
    } catch (err) {
      if (!(err instanceof SendTransactionError)) throw err;
      const logs = err.logs ?? (await err.getLogs(connection));
      let errorName = "unknown";
      let errorCode = "unknown";
      try {
        multisig.errors.translateAndThrowAnchorError({ ...err, logs });
      } catch (translated) {
        errorName = (translated as Error).name;
      }
      const m = logs.join("\n").match(/custom program error: (0x[0-9a-f]+)/i);
      if (m?.[1]) errorCode = `${m[1]} (${parseInt(m[1], 16)})`;
      console.log(`  rejected as expected: ${errorName} ${errorCode}`);
      for (const l of logs) console.log("    " + l);
      state.negative = { destination: OWNER.publicKey.toBase58(), errorName, errorCode, logs };
      save();
      if (errorName !== "InvalidDestination") console.log("  WARNING: expected InvalidDestination — inspect logs above");
    }
  }

  // STEP 8 — balances after + total SOL spent
  console.log("\nSTEP 8  summary");
  state.balancesAfter = await balances();
  save();
  let total = 0n;
  for (const k of Object.keys(state.balancesAfter)) {
    const before = BigInt(state.balancesBefore![k] ?? "0");
    const after = BigInt(state.balancesAfter[k]!);
    total += before - after;
    console.log(`  ${k.padEnd(18)} ${sol(before)} → ${sol(after)}  (spent ${sol(before - after)})`);
  }
  console.log(`  TOTAL SOL spent (rent + fees + creation fee): ${sol(total)}`);
  console.log("\n  addresses");
  console.log(`    buyer multisig      ${state.buyer!.multisigPda}`);
  console.log(`    buyer vault / ATA   ${state.buyer!.vaultPda} / ${state.buyer!.vaultAta}`);
  console.log(`    treasury multisig   ${state.treasury!.multisigPda}`);
  console.log(`    treasury vault/ATA  ${state.treasury!.vaultPda} / ${state.treasury!.vaultAta}`);
  console.log(`    spending limit PDA  ${state.spendingLimit!.pda}`);
  console.log("  signatures");
  console.log(`    buyer create        ${state.buyer!.sig}`);
  console.log(`    treasury create     ${state.treasury!.sig}`);
  console.log(`    ATAs                ${state.atasSig}`);
  console.log(`    limit create+vote   ${state.spendingLimit!.createProposeApproveSig}`);
  console.log(`    limit execute       ${state.spendingLimit!.executeSig}`);
  console.log(`    fund vault          ${state.fundSig}`);
  console.log(`    agent sweep         ${state.sweepSig}`);
  console.log(`    negative test       ${state.negative!.errorName} ${state.negative!.errorCode} (not landed)`);
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
