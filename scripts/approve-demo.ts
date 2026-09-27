/**
 * MAINNET: approve + execute a treasury proposal as the OWNER through the same
 * API routes the app uses (build → sign → submit). Signs with a local owner key
 * (TEST_BUYER stands in for the Privy wallet when passkeys are not enabled);
 * with Privy the signature comes from useApproveProposal instead.
 *
 *   pnpm --filter @kutip/scripts exec tsx approve-demo.ts --index <n> [--app http://localhost:3100] [--owner-env TEST_BUYER_SECRET] [--yes]
 */
import { keypairFromEnv } from "@kutip/solana";
import { VersionedTransaction } from "@solana/web3.js";
import { arg, closePrompt, confirmOrAbort } from "./_shared";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${url}: ${data.error ?? res.status}`);
  return data;
}

async function main() {
  const index = arg("index");
  if (!index) throw new Error("--index <proposal transaction index> is required");
  const app = arg("app") ?? "http://localhost:3100";
  const owner = keypairFromEnv(arg("owner-env") ?? "TEST_BUYER_SECRET");
  const list = await fetch(`${app}/api/treasury/proposals`).then((r) => r.json() as Promise<{ multisig: string; proposals: Array<{ transactionIndex: string; status: string; transfer: { destinationAta: string; amountUsdc: string } | null }> }>);
  const p = list.proposals.find((x) => x.transactionIndex === index);
  if (!p) throw new Error(`proposal #${index} not found on ${list.multisig}`);
  console.log(`  proposal #${index} on ${list.multisig}: status ${p.status}, transfer ${p.transfer ? `${p.transfer.amountUsdc} → ${p.transfer.destinationAta}` : "n/a"}`);
  if (p.status !== "Active") throw new Error(`proposal is ${p.status}, not Active`);
  const built = await post<{ transaction: string }>(`${app}/api/treasury/proposals/${index}/approve`, { owner: owner.publicKey.toBase58() });
  const tx = VersionedTransaction.deserialize(Buffer.from(built.transaction, "base64"));
  await confirmOrAbort([
    `proposalApprove + vaultTransactionExecute #${index} as OWNER ${owner.publicKey.toBase58()}`,
    `  message signers: ${tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures).map((k) => k.toBase58()).join(", ")}`,
    `  fee paid by the first signer (Kutip fee payer, already signed); executes the USDC transfer above`,
  ]);
  tx.sign([owner]);
  const { signature } = await post<{ signature: string }>(`${app}/api/treasury/proposals/${index}/submit`, {
    owner: owner.publicKey.toBase58(),
    signedTransaction: Buffer.from(tx.serialize()).toString("base64"),
  });
  console.log(`  executed: https://solscan.io/tx/${signature}`);
  closePrompt();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
