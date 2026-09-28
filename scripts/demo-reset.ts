/**
 * Reset the shared Supabase to the known demo state (SPEC §7), in one command:
 *   1. re-seed the demo exporter (db:seed --reset),
 *   2. delete every "ZZ TEST …" exporter and its rows,
 *   3. re-attach the provisioned mainnet multisigs (owner = the Privy passkey wallet),
 *   4. create the live invoices with fresh reference keys: human pay USD 1, bot pay USD 0.50.
 *
 *   pnpm --filter @kutip/scripts exec tsx demo-reset.ts [--owner <privy wallet pubkey>] [--warm <wallet>,<wallet>] [--yes]
 *
 * Every seeded buyer's email becomes your inbox (--inbox, default: the first EMAIL_ALLOWLIST entry)
 * so reminders and receipts from COLLECTIONS=on land with you. Exact address, no +aliases: Resend's
 * test sender only delivers to the account's own address.
 *
 * --warm screens the buyer wallets you will pay from on stage (read-only RPC) so the first
 * pay-link POST reuses a fresh pass instead of a 12–37 s screen. Screenings survive the reset.
 *
 * Database only: no mainnet writes. The multisigs must already exist on-chain (provision-demo.ts);
 * the read-only phase checks every account and aborts if one is missing.
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import { eq, like } from "drizzle-orm";
import { createStore, deleteExporter, schema } from "@kutip/db";
// The seed lives with @kutip/db; its fixtures come from apps/web through the "@/" alias in scripts/tsconfig.json.
import { resetDemo, seedDemo } from "../packages/db/seed/demo";
import { createKeyFor, deriveAccounts, keypairFromEnv, limitCreateKeyFor, reusableScreening, screeningRpcFromConnection, screenWallet, spendingLimitPdaFor } from "@kutip/solana";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { EXPORTER_ID, YES, arg, chain, closePrompt, db } from "./_shared";

const LIVE_INVOICES = [
  { buyerId: "b_harbourline", description: "LIVE DEMO · teak side table sample (pay by wallet)", unitPriceUsdc: 1_000_000n, label: "human pay" },
  { buyerId: "b_meridian", description: "LIVE DEMO · brass drawer pulls, 10 pcs (pay by AP bot / x402)", unitPriceUsdc: 500_000n, label: "bot pay" },
] as const;

async function main() {
  const { connection, feePayer, usdcMint } = chain();
  const { store, db: raw, close } = db(); // `store` only reads (screenings); writes go through the transaction below
  try {
    // ---------------- read-only phase ----------------
    const [ownerRow] = await raw.select().from(schema.users).where(eq(schema.users.id, "usr_owner"));
    const ownerArg = arg("owner") ?? ownerRow?.walletPubkey ?? undefined;
    if (!ownerArg) throw new Error("pass --owner <Privy wallet pubkey> (usr_owner has no wallet in the DB)");
    const owner = new PublicKey(ownerArg);
    const cashOut = new PublicKey(arg("cashout") ?? keypairFromEnv("TEST_BUYER_SECRET").publicKey);
    const inbox = arg("inbox") ?? (process.env.EMAIL_ALLOWLIST ?? "").split(",")[0]?.trim();
    if (!inbox || !/^[^@+\s]+@[^@\s]+$/.test(inbox)) throw new Error("pass --inbox you@example.com (or set EMAIL_ALLOWLIST) for the demo buyers' emails");
    const warm = (arg("warm") ?? "").split(",").filter(Boolean).map((w) => new PublicKey(w));
    const zz = await raw.select({ id: schema.exporters.id, name: schema.exporters.name }).from(schema.exporters).where(like(schema.exporters.name, "ZZ TEST%"));

    // Buyer ids come from the seed, which step 1 recreates; derive their accounts the way provision-demo does.
    const buyerIds = ["b_harbourline", "b_meridian", "b_alrashid", "b_najd", "b_kobayashi"];
    const treasury = deriveAccounts(createKeyFor(feePayer.secretKey, `treasury:${EXPORTER_ID}:${owner.toBase58()}`).publicKey, usdcMint);
    const buyers = buyerIds.map((id) => {
      const accounts = deriveAccounts(createKeyFor(feePayer.secretKey, `buyer:${id}:${owner.toBase58()}`).publicKey, usdcMint);
      const limitKey = limitCreateKeyFor(feePayer.secretKey, accounts.multisigPda).publicKey;
      return { id, ...accounts, spendingLimitPda: spendingLimitPdaFor(accounts.multisigPda, limitKey) };
    });
    const keys = [treasury.multisigPda, treasury.vaultAta, ...buyers.flatMap((b) => [b.multisigPda, b.vaultAta, b.spendingLimitPda])];
    const infos = await connection.getMultipleAccountsInfo(keys);
    const missing = keys.filter((_, i) => !infos[i]);
    if (missing.length) throw new Error(`not provisioned on-chain for owner ${owner.toBase58()}: ${missing.map((k) => k.toBase58()).join(", ")}; run provision-demo.ts first`);

    console.log(`Kutip demo reset — ${EXPORTER_ID}, owner ${owner.toBase58()}`);
    console.log(`  1. re-seed ${EXPORTER_ID} (every invoice, payment, message and agent action under it is deleted)`);
    console.log(`  2. delete test exporters: ${zz.length ? zz.map((e) => `${e.name} (${e.id})`).join(", ") : "none (skip)"}`);
    console.log(`  3. re-attach treasury ${treasury.multisigPda.toBase58()} + ${buyers.length} buyer multisigs (all ${keys.length} accounts exist on-chain), cash-out → ${cashOut.toBase58()}`);
    console.log(`     every buyer's email → ${inbox}`);
    console.log(`  4. create ${LIVE_INVOICES.map((i) => `${i.label} USD ${Number(i.unitPriceUsdc) / 1e6} (${i.buyerId})`).join(", ")} with fresh reference keys`);
    if (warm.length) console.log(`  5. screen ${warm.map((w) => w.toBase58()).join(", ")} unless screened (pass) in the last 24 h`);

    if (!YES) {
      closePrompt(); // _shared's prompt says "mainnet"; this script only writes to the database
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const answer = stdin.isTTY ? await rl.question("  proceed? [y/N] ") : "n"; // no terminal = no; re-run with --yes
      rl.close();
      if (answer.trim() !== "y") {
        console.log("aborted; nothing written");
        process.exit(1);
      }
    }

    // ---------------- write phase (database only) ----------------
    // Steps 1–4 are one transaction (nested calls become savepoints): a failure leaves the previous demo state as it was.
    const lines: string[] = [];
    await raw.transaction(async (tx) => {
      const store = createStore(tx, { appUrl: process.env.APP_URL ?? "http://localhost:3000" });
      await resetDemo(tx);
      await seedDemo(tx);
      lines.push(`  1. ${EXPORTER_ID} re-seeded`);
      for (const e of zz) {
        await deleteExporter(tx, e.id);
        lines.push(`  2. deleted ${e.name} (${e.id})`);
      }
      await store.updateTreasuryAccounts(EXPORTER_ID, { treasuryMultisig: treasury.multisigPda.toBase58(), treasuryVault: treasury.vaultPda.toBase58(), treasuryUsdcAta: treasury.vaultAta.toBase58() });
      for (const b of buyers) {
        await store.updateBuyerAccounts(EXPORTER_ID, b.id, { multisig: b.multisigPda.toBase58(), vault: b.vaultPda.toBase58(), usdcAta: b.vaultAta.toBase58(), spendingLimitPda: b.spendingLimitPda.toBase58() });
        await tx.update(schema.buyers).set({ email: inbox }).where(eq(schema.buyers.id, b.id));
      }
      await tx.update(schema.users).set({ walletPubkey: owner.toBase58() }).where(eq(schema.users.id, "usr_owner"));
      // demo_funds: the seeded business numbers stay, the hero says "Live on Solana mainnet · demo funds" next to the real balance.
      await tx.update(schema.exporters).set({ cashOutWhitelist: [{ label: "HATA USDC deposit (Solana) · Teratai Woodworks", address: cashOut.toBase58() }], demoFunds: true }).where(eq(schema.exporters.id, EXPORTER_ID));
      lines.push(`  3. treasury, buyers, owner wallet and cash-out whitelist (HATA) attached, demo flag on; buyer emails → ${inbox}`);

      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      for (const inv of LIVE_INVOICES) {
        const reference = Keypair.generate().publicKey.toBase58();
        const created = await store.createInvoice({
          exporterId: EXPORTER_ID, buyerId: inv.buyerId, issuedAt: today, dueDate: due, referencePubkey: reference, status: "sent",
          lineItems: [{ description: inv.description, quantity: 1, unitPriceUsdc: inv.unitPriceUsdc }],
        });
        lines.push(`  4. ${inv.label}: ${created.number} ${created.id} USDC ${created.amountUsdc} memo ${created.memoCode} reference ${reference}\n       pay ${created.payUrl}`);
      }
    });
    for (const l of lines) console.log(l);

    for (const w of warm) {
      const wallet = w.toBase58();
      if (reusableScreening(await store.latestScreening(wallet), new Date())) {
        console.log(`  5. ${wallet} already screened (pass) in the last 24 h`);
        continue;
      }
      const t0 = Date.now();
      const r = await screenWallet(w, { rpc: screeningRpcFromConnection(connection) });
      await store.recordScreening({ wallet, result: r.result, reasons: r.reasons });
      console.log(`  5. ${wallet} screened: ${r.result} in ${Date.now() - t0} ms (${r.reasons.join("; ")})`);
    }
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
