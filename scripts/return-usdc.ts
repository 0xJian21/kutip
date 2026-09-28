/**
 * MAINNET: move USDC out of TEST_BUYER's wallet to an owner wallet (e.g. after a rehearsal cash-out
 * landed on TEST_BUYER, the default cash-out whitelist entry of demo-reset).
 *
 *   pnpm --filter @kutip/scripts exec tsx return-usdc.ts --to <owner pubkey> --amount <base units> [--yes]
 *
 * Read-only phase first (balances, destination ATA must already exist: never creates one); skips when
 * TEST_BUYER holds less than --amount, so a re-run after it landed does nothing.
 */
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import { confirmByPolling, keypairFromEnv } from "@kutip/solana";
import { arg, chain, closePrompt, confirmOrAbort } from "./_shared";

async function main() {
  const { connection, usdcMint } = chain();
  const from = keypairFromEnv("TEST_BUYER_SECRET");
  const to = new PublicKey(arg("to") ?? "");
  const amount = BigInt(arg("amount") ?? "0");
  if (amount <= 0n) throw new Error("--amount must be positive (base units, 6 decimals)");

  // ---------------- read-only phase ----------------
  const source = getAssociatedTokenAddressSync(usdcMint, from.publicKey);
  const dest = getAssociatedTokenAddressSync(usdcMint, to);
  const have = (await getAccount(connection, source)).amount;
  await getAccount(connection, dest); // throws if the destination has no USDC account: we never create one
  if (have < amount) {
    console.log(`TEST_BUYER holds ${have} < ${amount}; nothing to do (already moved?)`);
    return;
  }
  await confirmOrAbort([`transferChecked ${amount} USDC base units: TEST_BUYER ${from.publicKey.toBase58()} → ${to.toBase58()} (ATA ${dest.toBase58()})`, "fee paid by TEST_BUYER (~0.000005 SOL)"]);

  // ---------------- write ----------------
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: from.publicKey, blockhash, lastValidBlockHeight }).add(createTransferCheckedInstruction(source, usdcMint, dest, from.publicKey, amount, 6));
  tx.sign(from);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await confirmByPolling(connection, sig, lastValidBlockHeight); // no WebSocket: Solami's WS hung confirmTransaction (2026-09-29)
  console.log(`moved ${amount}: ${sig}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closePrompt());
