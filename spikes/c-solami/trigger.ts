// Spike C — trigger: a Kutip-shaped USDC payment on MAINNET so listen.ts has something to catch.
//
//   0.1 USDC transferChecked  TEST_BUYER ATA → destination ATA
//   + fresh random reference pubkey appended to the transfer as a read-only key
//   + Memo "k_test01"
//   fee payer = FEE_PAYER (sponsored, D4)
//
// Usage:
//   pnpm --filter @kutip/spikes exec tsx c-solami/trigger.ts --to-ata <destAta>     [--amount 100000] [--memo k_test01]
//   pnpm --filter @kutip/spikes exec tsx c-solami/trigger.ts --to-owner <destOwner> [--amount 100000] [--memo k_test01]
//
// Prints the reference pubkey FIRST so you can start listen.ts with it, then waits for `y` before sending.
// Env (repo-root .env): SOLAMI_RPC_URL (+ SOLAMI_API_KEY if the URL has no api_key), FEE_PAYER_SECRET, TEST_BUYER_SECRET, USDC_MINT.

import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  /* .env optional */
}

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const USDC_MINT = new PublicKey(process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const MAX_AMOUNT = 1_000_000n; // 1 USDC — CLAUDE.md mainnet cap for test txs

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
function rpcUrl(): string {
  const u = new URL(env("SOLAMI_RPC_URL"));
  if (!u.searchParams.has("api_key") && process.env.SOLAMI_API_KEY) u.searchParams.set("api_key", process.env.SOLAMI_API_KEY);
  return u.toString();
}

async function main() {
  const amount = BigInt(arg("--amount") ?? "100000");
  const memo = arg("--memo") ?? "k_test01";
  if (amount <= 0n || amount > MAX_AMOUNT) throw new Error(`amount must be 1..${MAX_AMOUNT} base units`);

  const feePayer = Keypair.fromSecretKey(bs58.decode(env("FEE_PAYER_SECRET")));
  const buyer = Keypair.fromSecretKey(bs58.decode(env("TEST_BUYER_SECRET")));
  // --reference lets the caller pre-generate the key and start listen.ts before this script runs.
  const reference = arg("--reference") ? new PublicKey(arg("--reference")!) : Keypair.generate().publicKey;

  const toAta = arg("--to-ata");
  const toOwner = arg("--to-owner");
  if (!toAta && !toOwner) throw new Error("need --to-ata <pubkey> or --to-owner <pubkey>");
  const destAta = toAta ? new PublicKey(toAta) : getAssociatedTokenAddressSync(USDC_MINT, new PublicKey(toOwner!), true);
  const buyerAta = getAssociatedTokenAddressSync(USDC_MINT, buyer.publicKey);

  // Reference first, so the listener can be started before we send.
  console.log(`reference pubkey : ${reference.toBase58()}`);
  console.log(`destination ATA  : ${destAta.toBase58()}`);
  console.log(`start listener   : pnpm --filter @kutip/spikes exec tsx c-solami/listen.ts ${reference.toBase58()} ${destAta.toBase58()}\n`);

  const connection = new Connection(rpcUrl(), "confirmed");

  // Read-only preflight. Never create ATAs inside a payment (D4) — abort if anything is missing.
  const [buyerAcc, destAcc, payerLamports] = await Promise.all([
    getAccount(connection, buyerAta),
    getAccount(connection, destAta),
    connection.getBalance(feePayer.publicKey),
  ]);
  if (!buyerAcc.mint.equals(USDC_MINT)) throw new Error("buyer ATA is not USDC");
  if (!destAcc.mint.equals(USDC_MINT)) throw new Error("destination ATA is not USDC");
  if (buyerAcc.amount < amount) throw new Error(`buyer ATA has ${buyerAcc.amount} < ${amount}`);
  if (payerLamports < 1_000_000) throw new Error(`fee payer has ${payerLamports} lamports (< 0.001 SOL)`);

  const transfer = createTransferCheckedInstruction(buyerAta, USDC_MINT, destAta, buyer.publicKey, amount, 6);
  transfer.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    transfer,
    new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo, "utf8") }),
  ];

  console.log("About to send on MAINNET:");
  console.log(`  ${amount} USDC base units (${Number(amount) / 1e6} USDC)  ${buyerAta.toBase58()} → ${destAta.toBase58()}`);
  console.log(`  buyer/owner ${buyer.publicKey.toBase58()}   dest owner ${destAcc.owner.toBase58()}`);
  console.log(`  fee payer   ${feePayer.publicKey.toBase58()}   memo "${memo}"   reference ${reference.toBase58()}`);
  console.log(`  rpc         ${new URL(rpcUrl()).host}`);
  // --yes: plan already confirmed out-of-band (no TTY in the Claude Code shell).
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = process.argv.includes("--yes") ? "y" : await rl.question("Send? [y/N] ");
  rl.close();
  if (answer.trim().toLowerCase() !== "y") return console.log("aborted");

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: blockhash, instructions }).compileToV0Message(),
  );
  tx.sign([feePayer, buyer]);

  const slotAtSend = await connection.getSlot("processed");
  const tSent = Date.now();
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: "processed", maxRetries: 3 });
  console.log(`\n[${new Date(tSent).toISOString()}] sent   sig=${sig} slotAtSend=${slotAtSend}`);

  let tProcessed: number | undefined, tConfirmed: number | undefined, tFinalized: number | undefined, slotLanded: number | undefined;
  while (tFinalized === undefined) {
    await new Promise((r) => setTimeout(r, 200));
    const now = Date.now();
    const st = (await connection.getSignatureStatuses([sig])).value[0];
    if (st?.err) throw new Error(`tx failed on-chain: ${JSON.stringify(st.err)}`);
    if (st) {
      slotLanded ??= st.slot;
      if (tProcessed === undefined) tProcessed = now;
      if (tConfirmed === undefined && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) {
        tConfirmed = now;
        console.log(`[${new Date(now).toISOString()}] confirmed  +${now - tSent}ms  slot=${st.slot}`);
      }
      if (st.confirmationStatus === "finalized") tFinalized = now;
    } else if (now - tSent > 5_000 && (await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) {
      throw new Error("blockhash expired before the tx landed");
    }
  }

  console.table([
    {
      signature: sig,
      slotAtSend,
      slotLanded,
      "slots elapsed": slotLanded !== undefined ? slotLanded - slotAtSend : "",
      t_sent: new Date(tSent).toISOString(),
      "→processed ms": tProcessed! - tSent,
      "→confirmed ms": tConfirmed! - tSent,
      "→finalized ms": tFinalized - tSent,
    },
  ]);
  console.log(`reference ${reference.toBase58()}\nhttps://solscan.io/tx/${sig}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
