/**
 * MAINNET: the agent proposes a USDC move from the treasury vault to the owner's
 * whitelisted cash-out address (SPEC F7). The owner approves + executes from the
 * app (app/(dev)/treasury-test) with the Privy passkey wallet.
 *
 *   pnpm --filter @kutip/scripts exec tsx propose-cashout.ts --amount <USDC base units> [--to <whitelisted pubkey>] [--yes]
 */
import { createTransferProposal } from "@kutip/solana";
import { PublicKey } from "@solana/web3.js";
import { EXPORTER_ID, arg, chain, closePrompt, confirmOrAbort, db, sol } from "./_shared";

async function main() {
  const { connection, feePayer, agent, usdcMint } = chain();
  const { store, close } = db();
  try {
    const amountUsdc = BigInt(arg("amount") ?? "0");
    if (amountUsdc <= 0n || amountUsdc > 1_000_000n) throw new Error("--amount must be 1..1000000 base units (≤ 1 USDC for tests)");
    const treasury = await store.getTreasury(EXPORTER_ID);
    const to = arg("to") ?? treasury.cashOut.whitelisted[0]?.address;
    if (!to) throw new Error("no whitelisted cash-out address; run provision-demo.ts first");
    console.log(`  treasury vault ${treasury.mainVault}, cached balance ${treasury.mainBalanceUsdc}; whitelisted: ${treasury.cashOut.whitelisted.map((w) => `${w.label} ${w.address}`).join("; ")}`);
    const before = await connection.getBalance(feePayer.publicKey);
    const r = await createTransferProposal({ connection, feePayer, agent, usdcMint, store, exporterId: EXPORTER_ID, destinationOwner: new PublicKey(to), amountUsdc, memo: "k_cashout", confirm: confirmOrAbort });
    console.log(`  proposal #${r.transactionIndex} created: https://solscan.io/tx/${r.signature}  agent action ${r.actionId}`);
    console.log(`  SOL spent: ${sol(before - (await connection.getBalance(feePayer.publicKey)))} (vault tx + proposal rent, reclaimable after execution)`);
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
