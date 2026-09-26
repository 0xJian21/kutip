/**
 * MAINNET proof of the daily sweep: buyer vaults → treasury via the agent's
 * spending limit, only where @kutip/agent treasuryMove says `autonomous`.
 *
 *   pnpm --filter @kutip/scripts exec tsx sweep-demo.ts [--yes]
 *
 * Read-only phase prints the plan (on-chain balances + limits); nothing is sent
 * until confirmed. Records the sweep with recordSweep + an agent action.
 * The worker (Session 4) calls the same runSweep at randomSweepTime().
 */
import { runSweep } from "@kutip/solana";
import { EXPORTER_ID, chain, closePrompt, confirmOrAbort, db, sol } from "./_shared";

async function main() {
  const { connection, feePayer, agent, usdcMint } = chain();
  const { store, close } = db();
  try {
    const before = await connection.getBalance(feePayer.publicKey);
    const result = await runSweep({ connection, feePayer, agent, usdcMint, store, exporterId: EXPORTER_ID, confirm: confirmOrAbort });
    for (const s of result.sweeps) console.log(`  sweep ${s.id}: ${s.buyerIds.join(", ")} → ${s.amountUsdc} base units  https://solscan.io/tx/${s.signature}`);
    for (const s of result.plan.skipped) console.log(`  skipped ${s.buyerId}: ${s.mode} — ${s.reason}`);
    if (result.sweeps.length === 0) console.log("  nothing swept");
    const after = await connection.getBalance(feePayer.publicKey);
    console.log(`  SOL spent: ${sol(before - after)}`);
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
