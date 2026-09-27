/**
 * One-shot live proof for the worker (MAINNET). Two steps so the Realtime watcher can join the topic first:
 *   tsx --env-file=../../.env scripts/pay-test-invoice.ts create            → new 0.10 USDC invoice, fresh reference (DB write only)
 *   tsx --env-file=../../.env scripts/pay-test-invoice.ts pay <invoiceId>   → read-only plan; add --yes to send
 * Invoice lives under the "ZZ TEST Session 3 Payments" exporter, buyer = Spike B's vault. TEST_BUYER pays,
 * FEE_PAYER sponsors the fee (D4). Skips if the invoice already has a payment.
 */
import { connect, createStore } from "@kutip/db";
import * as schema from "@kutip/db/src/schema";
import { createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { eq, like } from "drizzle-orm";
import { loadConfig } from "../src/config";

const AMOUNT = 100_000n; // 0.10 USDC (user cap for this run: ≤ 0.1 USDC)
const VAULT_ATA = "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS";
const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const cfg = loadConfig();
const { db, close } = connect(cfg.databaseUrl, { max: 1 });
const store = createStore(db, { appUrl: cfg.appUrl });
const [cmd, invoiceArg] = process.argv.slice(2);

try {
  const [exporter] = await db.select().from(schema.exporters).where(like(schema.exporters.name, "ZZ TEST Session 3%"));
  const [buyer] = exporter ? await db.select().from(schema.buyers).where(eq(schema.buyers.usdcAta, VAULT_ATA)) : [];
  if (!exporter || !buyer || buyer.exporterId !== exporter.id) throw new Error("test exporter / Spike B buyer not found");

  if (cmd === "create") {
    const today = new Date().toISOString().slice(0, 10);
    const inv = await store.createInvoice({
      exporterId: exporter.id, buyerId: buyer.id, issuedAt: today, dueDate: today, status: "sent",
      referencePubkey: Keypair.generate().publicKey.toBase58(),
      lineItems: [{ description: "Session 4 worker proof", quantity: 1, unitPriceUsdc: AMOUNT }],
    });
    console.log(`created ${inv.id} ${inv.number} amount ${inv.amountUsdc} memo ${inv.memoCode} reference ${inv.referencePubkey}`);
    console.log(`exporter ${exporter.id}`);
  } else if (cmd === "pay" && invoiceArg) {
    const detail = await store.getInvoice(exporter.id, invoiceArg);
    if (!detail) throw new Error(`invoice ${invoiceArg} not found under the test exporter`);
    const { invoice } = detail;
    if (detail.payments.length) {
      console.log(`skip: ${invoice.id} already has payment ${detail.payments[0]!.signature} (${invoice.status})`);
    } else {
      const feePayer = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_SECRET!));
      const payer = Keypair.fromSecretKey(bs58.decode(process.env.TEST_BUYER_SECRET!));
      const usdc = new PublicKey(cfg.usdcMint);
      const from = getAssociatedTokenAddressSync(usdc, payer.publicKey);
      const to = new PublicKey(VAULT_ATA);
      const connection = new Connection(cfg.rpcUrl, "confirmed");
      const [fromAcc, toAcc, feeLamports] = await Promise.all([getAccount(connection, from), getAccount(connection, to), connection.getBalance(feePayer.publicKey)]);
      if (invoice.amountUsdc !== AMOUNT) throw new Error(`invoice amount ${invoice.amountUsdc} is not the capped ${AMOUNT}`);
      if (!toAcc.mint.equals(usdc) || toAcc.owner.toBase58() !== buyer.vault) throw new Error("vault ATA is not the buyer vault's USDC account");
      if (fromAcc.amount < AMOUNT) throw new Error(`TEST_BUYER holds ${fromAcc.amount} < ${AMOUNT}`);
      if (feeLamports < 1_000_000) throw new Error(`fee payer has ${feeLamports} lamports`);

      console.log(`MAINNET plan: ${AMOUNT} USDC base units (0.10 USDC)`);
      console.log(`  from TEST_BUYER ${payer.publicKey.toBase58()} (holds ${fromAcc.amount})`);
      console.log(`  to   vault ATA ${VAULT_ATA} (owner ${buyer.vault})`);
      console.log(`  fee payer ${feePayer.publicKey.toBase58()} (${feeLamports} lamports; ~10k lamports fee)`);
      console.log(`  memo ${invoice.memoCode}, reference ${invoice.referencePubkey} (invoice ${invoice.id} ${invoice.number})`);
      if (!process.argv.includes("--yes")) {
        console.log("read-only: re-run with --yes to send");
      } else {
        const transfer = createTransferCheckedInstruction(from, usdc, to, payer.publicKey, AMOUNT, 6);
        transfer.keys.push({ pubkey: new PublicKey(invoice.referencePubkey), isSigner: false, isWritable: false });
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const tx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: feePayer.publicKey,
            recentBlockhash: blockhash,
            instructions: [
              ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }),
              ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
              transfer,
              new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(invoice.memoCode, "utf8") }),
            ],
          }).compileToV0Message(),
        );
        tx.sign([feePayer, payer]);
        const sentAt = Date.now();
        const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
        console.log(`${new Date(sentAt).toISOString()} sent ${sig}\nhttps://solscan.io/tx/${sig}`);
      }
    }
  } else {
    console.log("usage: pay-test-invoice.ts create | pay <invoiceId> [--yes]");
  }
} finally {
  await close();
}
