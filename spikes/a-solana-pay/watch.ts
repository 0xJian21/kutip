// Spike A watcher — polls getSignaturesForAddress(reference) every 2s and reports who paid.
// Run: pnpm --filter @kutip/spikes exec tsx a-solana-pay/watch.ts [REFERENCE_PUBKEY]
// Without an argument it reads a-solana-pay/.reference written by server.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Connection, PublicKey, type VersionedTransactionResponse } from '@solana/web3.js';

process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));

const rpc = process.env['SOLAMI_RPC_URL'];
if (!rpc) throw new Error('missing env SOLAMI_RPC_URL');
const refArg = process.argv[2] ?? readFileSync(fileURLToPath(new URL('./.reference', import.meta.url)), 'utf8').trim();
const reference = new PublicKey(refArg);
const destAta = process.env['DEST_USDC_ATA'];
const LIGHTHOUSE_PROGRAM = 'L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95'; // Phantom's guard program, if it got appended
const connection = new Connection(rpc, 'confirmed');
type TokenBalances = NonNullable<VersionedTransactionResponse['meta']>['preTokenBalances'];
const seen = new Set<string>();

function report(signature: string, tx: VersionedTransactionResponse): void {
  const msg = tx.transaction.message;
  const meta = tx.meta;
  // Runtime account ordering: static keys, then LUT-loaded writable, then LUT-loaded readonly.
  const allKeys = [...msg.staticAccountKeys, ...(meta?.loadedAddresses?.writable ?? []), ...(meta?.loadedAddresses?.readonly ?? [])];
  const feePayer = msg.staticAccountKeys[0]!;
  const buyerIdx = 1; // second required signer (fee payer + buyer expected)
  const buyer = msg.staticAccountKeys[buyerIdx];
  const lamportDelta = (i: number) => (meta ? meta.postBalances[i]! - meta.preBalances[i]! : NaN);
  const programs = msg.compiledInstructions.map((ix) => allKeys[ix.programIdIndex]?.toBase58() ?? '?');
  const tokenBal = (arr: TokenBalances) => arr?.find((b) => allKeys[b.accountIndex]?.toBase58() === destAta)?.uiTokenAmount.amount;

  console.log(`\n${new Date().toISOString()} ${signature}`);
  console.log(`  slot ${tx.slot} version ${tx.version ?? 'legacy'} err ${JSON.stringify(meta?.err ?? null)}`);
  console.log(`  required signers ${msg.header.numRequiredSignatures}  fee ${meta?.fee} lamports paid by ${feePayer.toBase58()}`);
  console.log(`  fee payer SOL delta ${lamportDelta(0)}`);
  if (buyer) {
    const d = lamportDelta(buyerIdx);
    console.log(`  buyer ${buyer.toBase58()} SOL delta ${d}  -> ${d === 0 ? 'buyer paid 0 SOL' : 'buyer SOL changed (expected only in jup-exactout mode)'}`);
  }
  if (destAta && meta) console.log(`  dest USDC ${tokenBal(meta.preTokenBalances)} -> ${tokenBal(meta.postTokenBalances)}`);
  console.log(`  programs: ${programs.map((p) => (p === LIGHTHOUSE_PROGRAM ? `${p} (LIGHTHOUSE appended by wallet!)` : p)).join(', ')}`);
}

console.log(`watching reference ${reference.toBase58()} every 2s (ctrl-c to stop)`);
for (;;) {
  const sigs = await connection.getSignaturesForAddress(reference, { limit: 10 }, 'confirmed').catch((e: Error) => {
    console.error('rpc error:', e.message);
    return [];
  });
  for (const s of sigs.reverse()) {
    if (seen.has(s.signature)) continue;
    const tx = await connection.getTransaction(s.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) continue;
    seen.add(s.signature);
    report(s.signature, tx);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
