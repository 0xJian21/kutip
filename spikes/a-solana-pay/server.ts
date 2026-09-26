// Spike A — Solana Pay *transaction request* server, gasless (fee payer sponsored).
// Throwaway. Run from repo root:  pnpm --filter @kutip/spikes exec tsx a-solana-pay/server.ts
// Findings + spec references: spikes/notes/a-solana-pay.md
//
// Env (repo-root .env): PORT, PUBLIC_URL (https tunnel), FEE_PAYER_SECRET (base58), SOLAMI_RPC_URL,
//   USDC_MINT, DEST_USDC_ATA (must already exist), AMOUNT_USDC (base units), MODE=usdc|jup-exactout,
//   TX_VERSION=legacy|v0 (usdc mode only; jup mode is always v0), CU_PRICE_MICROLAMPORTS,
//   JUP_BASE_URL (default https://lite-api.jup.ag), JUP_API_KEY (optional), JUP_MAX_ACCOUNTS, JUP_ONLY_DIRECT
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bs58 from 'bs58';
import QRCode from 'qrcode';
import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  MessageV0,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token';

process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));

const env = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') throw new Error(`missing env ${key}`);
  return v;
};

const MODE = env('MODE', 'usdc');
if (MODE !== 'usdc' && MODE !== 'jup-exactout') throw new Error(`MODE must be usdc|jup-exactout, got ${MODE}`);
const TX_VERSION = MODE === 'jup-exactout' ? 'v0' : env('TX_VERSION', 'legacy');
if (TX_VERSION !== 'legacy' && TX_VERSION !== 'v0') throw new Error(`TX_VERSION must be legacy|v0`);
const PORT = Number(env('PORT', '3000'));
const PUBLIC_URL = env('PUBLIC_URL').replace(/\/$/, '');
const USDC_MINT = new PublicKey(env('USDC_MINT', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'));
const DEST_USDC_ATA = new PublicKey(env('DEST_USDC_ATA'));
const AMOUNT = BigInt(env('AMOUNT_USDC', MODE === 'jup-exactout' ? '500000' : '100000')); // base units, 6 dp
if (AMOUNT <= 0n || AMOUNT > 1_000_000n) throw new Error(`AMOUNT_USDC ${AMOUNT} outside spike cap (0 < x <= 1 USDC)`);
const CU_PRICE = Number(env('CU_PRICE_MICROLAMPORTS', '10000')); // capped priority fee, paid by fee payer
const JUP_BASE = env('JUP_BASE_URL', 'https://lite-api.jup.ag').replace(/\/$/, '');
const JUP_API_KEY = process.env['JUP_API_KEY'];
const FEE_PAYER = Keypair.fromSecretKey(bs58.decode(env('FEE_PAYER_SECRET')));
const REFERENCE = Keypair.generate().publicKey; // one reference per server run; watch.ts polls it
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const MAX_TX_BYTES = 1232;
const connection = new Connection(env('SOLAMI_RPC_URL'), 'confirmed');

const fmtUsdc = (n: bigint) => `${n / 1_000_000n}.${(n % 1_000_000n).toString().padStart(6, '0')}`;

// ---------- startup checks (read-only RPC) ----------
const dest = await getAccount(connection, DEST_USDC_ATA);
if (!dest.mint.equals(USDC_MINT)) throw new Error(`DEST_USDC_ATA mint ${dest.mint.toBase58()} != USDC_MINT`);
const feePayerLamports = await connection.getBalance(FEE_PAYER.publicKey);

// Solana Pay URL. Spec: `solana:<link>`, link URL-encoded only if it has query params.
const link = new URL(`${PUBLIC_URL}/pay`);
const solanaUrl = 'solana:' + (link.search ? encodeURIComponent(link.toString()) : link.toString());
const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
await QRCode.toFile(here('./qr.png'), solanaUrl, { type: 'png', width: 512, margin: 2 });
writeFileSync(here('./.reference'), REFERENCE.toBase58());

console.log(`mode          ${MODE} (${TX_VERSION} tx)`);
console.log(`fee payer     ${FEE_PAYER.publicKey.toBase58()}  (${feePayerLamports / 1e9} SOL)`);
console.log(`dest USDC ATA ${DEST_USDC_ATA.toBase58()}  owner ${dest.owner.toBase58()}  balance ${fmtUsdc(dest.amount)}`);
console.log(`amount        ${fmtUsdc(AMOUNT)} USDC (${AMOUNT} base units)`);
console.log(`reference     ${REFERENCE.toBase58()}  (written to a-solana-pay/.reference)`);
console.log(`solana url    ${solanaUrl}`);
console.log(`qr png        ${here('./qr.png')}`);
console.log(await QRCode.toString(solanaUrl, { type: 'terminal', small: true }));

// ---------- instruction builders ----------
const memoIx = (text: string) =>
  // Memo program requires every *provided* account to be a signer, so the reference must not go here.
  new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(text, 'utf8') });

const cuIxs = (units: number) => [
  ComputeBudgetProgram.setComputeUnitLimit({ units }),
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: CU_PRICE }),
];

async function buildUsdc(buyer: PublicKey): Promise<{ ixs: TransactionInstruction[]; luts: AddressLookupTableAccount[] }> {
  const buyerAta = getAssociatedTokenAddressSync(USDC_MINT, buyer);
  const acct = await getAccount(connection, buyerAta).catch(() => null);
  if (!acct) throw new Error(`buyer has no USDC ATA (${buyerAta.toBase58()}); we never create ATAs`);
  if (acct.amount < AMOUNT) throw new Error(`buyer USDC balance ${fmtUsdc(acct.amount)} < ${fmtUsdc(AMOUNT)}`);

  const transfer = createTransferCheckedInstruction(buyerAta, USDC_MINT, DEST_USDC_ATA, buyer, AMOUNT, 6);
  // Solana Pay reference convention: read-only, non-signer key appended to the transfer instruction.
  transfer.keys.push({ pubkey: REFERENCE, isSigner: false, isWritable: false });
  return { ixs: [...cuIxs(30_000), transfer, memoIx('k_test01')], luts: [] };
}

type JupIx = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };
type JupSwapIxs = {
  error?: string;
  computeBudgetInstructions: JupIx[];
  setupInstructions: JupIx[];
  swapInstruction: JupIx;
  cleanupInstruction: JupIx | null;
  otherInstructions: JupIx[];
  addressLookupTableAddresses: string[];
  computeUnitLimit?: number;
  simulationError?: unknown;
};
const toIx = (ix: JupIx) =>
  new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(ix.data, 'base64'),
  });

async function buildJupExactOut(buyer: PublicKey): Promise<{ ixs: TransactionInstruction[]; luts: AddressLookupTableAccount[] }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (JUP_API_KEY) headers['x-api-key'] = JUP_API_KEY;

  // Swap API v1 is the only Jupiter API with ExactOut (v2 /swap/v2/build is ExactIn-only). See notes.
  const qs = new URLSearchParams({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT.toBase58(),
    amount: AMOUNT.toString(), // ExactOut: amount = exact *output* in USDC base units
    swapMode: 'ExactOut',
    slippageBps: '50',
    maxAccounts: env('JUP_MAX_ACCOUNTS', '24'),
    restrictIntermediateTokens: 'true',
    onlyDirectRoutes: env('JUP_ONLY_DIRECT', 'false'),
  });
  const quoteRes = await fetch(`${JUP_BASE}/swap/v1/quote?${qs}`, { headers });
  const quote = (await quoteRes.json()) as { error?: string; inAmount: string; outAmount: string; routePlan: { swapInfo: { label: string } }[] };
  if (!quoteRes.ok || quote.error) throw new Error(`jup quote HTTP ${quoteRes.status}: ${quote.error ?? 'unknown'}`);
  console.log(`  jup quote: ${Number(quote.inAmount) / 1e9} SOL -> ${fmtUsdc(BigInt(quote.outAmount))} USDC via ${quote.routePlan.map((r) => r.swapInfo.label).join(' > ')}`);

  const swapRes = await fetch(`${JUP_BASE}/swap/v1/swap-instructions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: buyer.toBase58(),
      destinationTokenAccount: DEST_USDC_ATA.toBase58(), // Jupiter assumes it is initialised -> no ATA creation
      trackingAccount: REFERENCE.toBase58(), // Jupiter appends this as a read-only key on the swap ix (our Solana Pay reference)
      wrapAndUnwrapSol: true, // buyer pays SOL: temp wSOL account, rent-funded by buyer, closed by cleanup ix
      dynamicComputeUnitLimit: true,
      // NOT passing `payer`: it would make the fee payer the rent payer of setup ATAs (violates DECISIONS D4).
    }),
  });
  const s = (await swapRes.json()) as JupSwapIxs;
  if (!swapRes.ok || s.error) throw new Error(`jup swap-instructions HTTP ${swapRes.status}: ${s.error ?? 'unknown'}`);
  if (s.simulationError) console.log('  jup simulationError:', JSON.stringify(s.simulationError));

  // Our own ComputeBudget ixs (capped price) instead of Jupiter's computeBudgetInstructions.
  const ixs = [
    ...cuIxs(s.computeUnitLimit ?? 400_000),
    ...s.setupInstructions.map(toIx),
    toIx(s.swapInstruction),
    ...(s.cleanupInstruction ? [toIx(s.cleanupInstruction)] : []),
    ...s.otherInstructions.map(toIx),
    memoIx('k_test01'),
  ];
  if (!ixs.some((ix) => ix.keys.some((k) => k.pubkey.equals(REFERENCE)))) {
    // Fallback: ComputeBudget program is a runtime no-op and ignores extra accounts.
    console.log('  trackingAccount not present in Jupiter ixs; pinning reference to the CU-limit ix');
    ixs[0]!.keys.push({ pubkey: REFERENCE, isSigner: false, isWritable: false });
  }

  const luts: AddressLookupTableAccount[] = [];
  for (const addr of s.addressLookupTableAddresses) {
    const { value } = await connection.getAddressLookupTable(new PublicKey(addr));
    if (value) luts.push(value);
  }
  return { ixs, luts };
}

// ---------- audit + compile ----------
function auditIxs(ixs: TransactionInstruction[]): void {
  ixs.forEach((ix, i) => {
    const keys = ix.keys.map((k) => `${k.pubkey.toBase58().slice(0, 6)}${k.isSigner ? 'S' : ''}${k.isWritable ? 'W' : ''}`);
    console.log(`  ix[${i}] ${ix.programId.toBase58()} data=${ix.data.length}B keys[${keys.length}]: ${keys.join(' ')}`);
    if (ix.programId.equals(FEE_PAYER.publicKey) || ix.keys.some((k) => k.pubkey.equals(FEE_PAYER.publicKey))) {
      throw new Error(`fee payer appears in ix[${i}] accounts — refusing to sign (DECISIONS D4)`);
    }
  });
  const signers = new Set(ixs.flatMap((ix) => ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58())));
  console.log(`  instruction signers: ${[...signers].join(', ')}  (fee payer only signs as payer)`);
}

async function compileAndSign(ixs: TransactionInstruction[], luts: AddressLookupTableAccount[]): Promise<Uint8Array> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  if (TX_VERSION === 'legacy') {
    const tx = new Transaction({ feePayer: FEE_PAYER.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
    tx.partialSign(FEE_PAYER);
    // requireAllSignatures:false -> buyer's slot stays empty; fee payer's signature is still verified.
    return tx.serialize({ requireAllSignatures: false });
  }
  const msg = new TransactionMessage({ payerKey: FEE_PAYER.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(luts);
  const tx = new VersionedTransaction(msg);
  tx.sign([FEE_PAYER]); // partial: other signature slots remain zeroed
  return tx.serialize();
}

function describeSerialized(bytes: Uint8Array): string {
  if (TX_VERSION === 'legacy') {
    const t = Transaction.from(bytes);
    const signed = t.signatures.filter((s) => s.signature).map((s) => s.publicKey.toBase58().slice(0, 6));
    return `legacy requiredSigs=${t.signatures.length} signed=[${signed.join(',')}] feePayer=${t.feePayer?.toBase58().slice(0, 6)}`;
  }
  const t = VersionedTransaction.deserialize(bytes);
  const m = t.message as MessageV0;
  const keys = m.staticAccountKeys;
  const signed = t.signatures.map((s, i) => (s.some((b) => b !== 0) ? keys[i]!.toBase58().slice(0, 6) : null)).filter(Boolean);
  return `v0 requiredSigs=${m.header.numRequiredSignatures} signed=[${signed.join(',')}] feePayer=${keys[0]!.toBase58().slice(0, 6)} static=${keys.length} luts=${m.addressTableLookups.length}`;
}

// ---------- http ----------
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#14F195"/><text x="32" y="42" font-size="28" text-anchor="middle" font-family="sans-serif" fill="#000">K</text></svg>`;

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', PUBLIC_URL);
    console.log(`\n${new Date().toISOString()} ${req.method} ${url.pathname}  ua="${req.headers['user-agent'] ?? '-'}"`);
    // Spec is silent on CORS; harmless for native wallets, needed if a browser extension fetches directly.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Accept-Encoding');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (url.pathname === '/icon.svg') return void res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(ICON_SVG);
    if (url.pathname !== '/pay') return json(res, 404, { message: 'not found' });

    if (req.method === 'GET') return json(res, 200, { label: 'Kutip spike A', icon: `${PUBLIC_URL}/icon.svg` });

    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as { account?: string };
        if (!body.account) throw new Error('body.account missing');
        const buyer = new PublicKey(body.account);
        console.log(`  buyer ${buyer.toBase58()}`);
        const { ixs, luts } = MODE === 'usdc' ? await buildUsdc(buyer) : await buildJupExactOut(buyer);
        auditIxs(ixs);
        const bytes = await compileAndSign(ixs, luts);
        console.log(`  tx ${bytes.length}/${MAX_TX_BYTES} bytes  ${describeSerialized(bytes)}`);
        if (bytes.length > MAX_TX_BYTES) throw new Error(`tx too large: ${bytes.length} > ${MAX_TX_BYTES}`);
        return json(res, 200, {
          transaction: Buffer.from(bytes).toString('base64'),
          message: `Kutip test: ${fmtUsdc(AMOUNT)} USDC (network fee sponsored)`,
        });
      } catch (e) {
        console.error('  POST failed:', (e as Error).message);
        return json(res, 400, { message: (e as Error).message });
      }
    }
    return json(res, 405, { message: 'method not allowed' });
  })
  .listen(PORT, () => console.log(`\nlistening on :${PORT}  ->  ${PUBLIC_URL}/pay`));
