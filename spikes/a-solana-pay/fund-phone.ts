// Spike A helper: fund the phone wallet that will scan the QR (it needs USDC for MODE=usdc and SOL for MODE=jup-exactout).
// One mainnet tx: create the phone's USDC ATA (payer FEE_PAYER) + transferChecked USDC from TEST_BUYER + SOL from FEE_PAYER.
// Run:  pnpm --filter @kutip/spikes exec tsx a-solana-pay/fund-phone.ts <phonePubkey> [--usdc 300000] [--lamports 5000000] [--yes]
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline/promises';
import bs58 from 'bs58';
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';

process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1]! : d; };
const phone = new PublicKey(process.argv[2]!);
const usdc = BigInt(arg('--usdc', '300000'));
const lamports = Number(arg('--lamports', '5000000'));
if (usdc > 1_000_000n || lamports > 10_000_000) throw new Error('over spike caps (1 USDC / 0.01 SOL)');

const USDC = new PublicKey(process.env.USDC_MINT!);
const connection = new Connection(process.env.SOLAMI_RPC_URL!, 'confirmed');
const feePayer = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET!));
const buyer = Keypair.fromSecretKey(bs58.decode(process.env.TEST_BUYER_SECRET!));
const fromAta = getAssociatedTokenAddressSync(USDC, buyer.publicKey);
const phoneAta = getAssociatedTokenAddressSync(USDC, phone);

// read-only phase
const have = (await getAccount(connection, fromAta)).amount;
if (have < usdc) throw new Error(`TEST_BUYER has ${have} USDC base units < ${usdc}`);
const phoneAtaExists = await getAccount(connection, phoneAta).then(() => true, () => false);
console.log(`ABOUT TO WRITE TO MAINNET:\n  ${phoneAtaExists ? '(ATA exists)' : `create USDC ATA ${phoneAta.toBase58()} for ${phone.toBase58()} (rent ~0.002 SOL, payer FEE_PAYER)`}`);
console.log(`  transferChecked ${usdc} USDC base units  ${fromAta.toBase58()} → ${phoneAta.toBase58()} (authority TEST_BUYER)`);
console.log(`  ${lamports} lamports  FEE_PAYER → ${phone.toBase58()}`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ans = process.argv.includes('--yes') ? 'y' : await rl.question('proceed? [y/N] ');
rl.close();
if (ans.trim() !== 'y') process.exit(1);

const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
const ixs = [
  ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
  ...(phoneAtaExists ? [] : [createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, phoneAta, phone, USDC)]),
  ...(usdc > 0n ? [createTransferCheckedInstruction(fromAta, USDC, phoneAta, buyer.publicKey, usdc, 6)] : []),
  SystemProgram.transfer({ fromPubkey: feePayer.publicKey, toPubkey: phone, lamports }),
];
const tx = new VersionedTransaction(new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
tx.sign(usdc > 0n ? [feePayer, buyer] : [feePayer]);
const sig = await connection.sendTransaction(tx);
console.log(`sent ${sig}`);
for (;;) {
  const st = (await connection.getSignatureStatuses([sig])).value[0];
  if (st?.err) throw new Error(`failed: ${JSON.stringify(st.err)}`);
  if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') break;
  if ((await connection.getBlockHeight()) > lastValidBlockHeight) throw new Error('expired; check Solscan');
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(`confirmed  https://solscan.io/tx/${sig}`);
console.log(`phone USDC ATA balance: ${(await getAccount(connection, phoneAta)).amount}  SOL: ${(await connection.getBalance(phone)) / 1e9}`);
