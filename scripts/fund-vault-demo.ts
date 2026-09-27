/**
 * MAINNET test funding: move USDC from TEST_BUYER's ATA into one buyer vault so
 * the sweep has something to move (stands in for a real buyer payment).
 *
 *   pnpm --filter @kutip/scripts exec tsx fund-vault-demo.ts --buyer b_harbourline --amount 500000 [--yes]
 *
 * Skips when the vault already holds at least --amount.
 */
import { keypairFromEnv, sendV0 } from "@kutip/solana";
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { EXPORTER_ID, arg, chain, closePrompt, confirmOrAbort, db } from "./_shared";

async function main() {
  const { connection, feePayer, usdcMint } = chain();
  const { store, close } = db();
  try {
    const amount = BigInt(arg("amount") ?? "0");
    if (amount <= 0n || amount > 1_000_000n) throw new Error("--amount must be 1..1000000 base units (≤ 1 USDC for tests)");
    const buyerId = arg("buyer") ?? "b_harbourline";
    const buyer = (await store.listBuyers(EXPORTER_ID)).find((b) => b.id === buyerId);
    if (!buyer) throw new Error(`buyer ${buyerId} not found`);
    const vaultAta = new PublicKey(buyer.usdcAta);
    const payer = keypairFromEnv("TEST_BUYER_SECRET");
    const from = getAssociatedTokenAddressSync(usdcMint, payer.publicKey);
    const have = (await getAccount(connection, from)).amount;
    const vaultHas = await getAccount(connection, vaultAta).then((a) => a.amount).catch(() => 0n);
    console.log(`  TEST_BUYER ${payer.publicKey.toBase58()} USDC ${have}; ${buyerId} vault ATA ${vaultAta.toBase58()} holds ${vaultHas}`);
    if (vaultHas >= amount) {
      console.log("  already funded; nothing to do");
      return;
    }
    if (have < amount) throw new Error(`TEST_BUYER has ${have} base units, need ${amount}`);
    await confirmOrAbort([
      `transferChecked ${amount} USDC base units`,
      `  from ${from.toBase58()} (TEST_BUYER's USDC ATA, authority TEST_BUYER)`,
      `  to   ${vaultAta.toBase58()} (${buyerId} vault ATA, owner ${buyer.vault})`,
      `  fee payer FEE_PAYER ${feePayer.publicKey.toBase58()}; cost = tx fee only`,
    ]);
    const sig = await sendV0(connection, feePayer, [createTransferCheckedInstruction(from, usdcMint, vaultAta, payer.publicKey, amount, 6)], [payer]);
    console.log(`  funded: https://solscan.io/tx/${sig}`);
    await store.updateBalances(EXPORTER_ID, { vaults: { [buyerId]: vaultHas + amount } });
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
