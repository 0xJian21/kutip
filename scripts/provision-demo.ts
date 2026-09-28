/**
 * Provision the demo exporter on MAINNET (SPEC F1/F2): main treasury multisig +
 * one multisig per seeded buyer (owner = Privy wallet, agent = AGENT key with
 * Initiate + a USDC/Day spending limit to the treasury vault PDA), vault USDC
 * ATAs, addresses written back to the DB, and two live demo invoices.
 *
 *   pnpm --filter @kutip/scripts exec tsx provision-demo.ts --owner <privy wallet pubkey> [--cashout <pubkey>] [--yes]
 *
 * Idempotent: multisig PDAs derive from HMAC(FEE_PAYER secret, "<kind>:<id>:<owner>"),
 * so a re-run for the same owner skips every account that already exists and only
 * re-writes the DB rows; a new owner (e.g. the Privy wallet replacing a stand-in)
 * gets fresh multisigs. Spending-limit keys derive from the buyer multisig PDA.
 * Read-only phase first; nothing is written until the plan is confirmed.
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import { schema } from "@kutip/db";
import { createKeyFor, deriveAccounts, ensureAtas, keypairFromEnv, limitCreateKeyFor, provisionMultisig, spendingLimitPdaFor } from "@kutip/solana";
import { EXPORTER_ID, arg, chain, closePrompt, confirmOrAbort, db, env, sol } from "./_shared";

const DEMO_INVOICES = [
  { number: "INV-2026-0154", buyerId: "b_harbourline", description: "LIVE DEMO · teak side table sample (pay by wallet)", unitPriceUsdc: 1_000_000n },
  { number: "INV-2026-0155", buyerId: "b_meridian", description: "LIVE DEMO · brass drawer pulls, 10 pcs (pay by AP bot / x402)", unitPriceUsdc: 500_000n },
] as const;

// Rent (lamports) from the account sizes in Spike B; live numbers are printed from getMinimumBalanceForRentExemption.
const MULTISIG_BYTES = 8 + 32 + 32 + 2 + 4 + 8 + 8 + 1 + 32 + 1 + 4 + 2 * 33;
const SPENDING_LIMIT_BYTES = 8 + 32 + 32 + 1 + 32 + 8 + 1 + 8 + 8 + 1 + 4 + 1 * 32 + 4 + 1 * 32;
const ATA_BYTES = 165;

async function main() {
  const { connection, feePayer, agent, usdcMint } = chain();
  const { store, db: raw, close } = db();
  try {
    // ---------------- read-only phase ----------------
    const exporter = await store.getExporter(EXPORTER_ID);
    if (!exporter) throw new Error(`exporter ${EXPORTER_ID} not seeded; run pnpm --filter @kutip/db db:seed`);
    const [ownerRow] = await raw.select().from(schema.users).where(eq(schema.users.id, "usr_owner"));
    const ownerArg = arg("owner") ?? ownerRow?.walletPubkey ?? undefined;
    if (!ownerArg) throw new Error("pass --owner <Privy wallet pubkey> (from the onboarding sign-in step)");
    const owner = new PublicKey(ownerArg);
    if (!PublicKey.isOnCurve(owner.toBytes())) throw new Error("owner must be a wallet pubkey (on curve)");
    const cashOut = new PublicKey(arg("cashout") ?? keypairFromEnv("TEST_BUYER_SECRET").publicKey);
    const buyers = await store.listBuyers(EXPORTER_ID);
    const rulebook = await store.getRulebook(EXPORTER_ID);
    const limitUsdc = rulebook.treasury.agentDailyLimitUsdc;

    const treasuryCreateKey = createKeyFor(feePayer.secretKey, `treasury:${EXPORTER_ID}:${owner.toBase58()}`);
    const treasury = deriveAccounts(treasuryCreateKey.publicKey, usdcMint);
    const plan = buyers.map((b) => {
      const createKey = createKeyFor(feePayer.secretKey, `buyer:${b.id}:${owner.toBase58()}`);
      const accounts = deriveAccounts(createKey.publicKey, usdcMint);
      const limitCreateKey = limitCreateKeyFor(feePayer.secretKey, accounts.multisigPda).publicKey;
      return { buyer: b, createKey, limitCreateKey, ...accounts, spendingLimitPda: spendingLimitPdaFor(accounts.multisigPda, limitCreateKey) };
    });
    const exists = async (k: PublicKey) => (await connection.getAccountInfo(k)) !== null;
    const before = await connection.getBalance(feePayer.publicKey);
    const rent = async (bytes: number) => connection.getMinimumBalanceForRentExemption(bytes);
    const [msRent, slRent, ataRent] = [await rent(MULTISIG_BYTES), await rent(SPENDING_LIMIT_BYTES), await rent(ATA_BYTES)];

    console.log(`Kutip provisioning — ${exporter.name} (${EXPORTER_ID}), mainnet`);
    console.log(`  FEE_PAYER ${feePayer.publicKey.toBase58()}  balance ${sol(before)}`);
    console.log(`  OWNER     ${owner.toBase58()} (Privy wallet, all permissions)`);
    console.log(`  AGENT     ${agent.publicKey.toBase58()} (Initiate + spending limit USDC ${limitUsdc} / Day)`);
    console.log(`  cash-out whitelist → ${cashOut.toBase58()}`);
    const treasuryExists = await exists(treasury.multisigPda);
    console.log(`\n  treasury  ${treasury.multisigPda.toBase58()}  vault ${treasury.vaultPda.toBase58()}  ATA ${treasury.vaultAta.toBase58()}  ${treasuryExists ? "EXISTS" : "to create"}`);
    let buyersToCreate = 0;
    for (const p of plan) {
      const e = await exists(p.multisigPda);
      if (!e) buyersToCreate++;
      console.log(`  ${p.buyer.id.padEnd(14)} ${p.multisigPda.toBase58()}  vault ${p.vaultPda.toBase58()}  limit ${p.spendingLimitPda.toBase58()}  ${e ? "EXISTS" : "to create"}`);
    }
    const toCreate = buyersToCreate + (treasuryExists ? 0 : 1);
    const est = (treasuryExists ? 0 : msRent + ataRent) + buyersToCreate * (msRent + slRent + ataRent) + toCreate * 20_000;
    console.log(`\n  estimated spend: ${sol(est)} (multisig ${sol(msRent)}, spending limit ${sol(slRent)}, ATA ${sol(ataRent)} each + ≤0.00002 SOL fee per tx; ${toCreate} tx(s))`);
    if (toCreate === 0) console.log("  nothing to create on-chain; DB rows will be re-written");

    // ---------------- write phase (each step asks) ----------------
    const sigs: Record<string, string> = {};
    const t = await provisionMultisig({ connection, feePayer, createKey: treasuryCreateKey, owner, agent: agent.publicKey, usdcMint, label: "treasury", confirm: confirmOrAbort });
    if (t.signature) sigs.treasury = t.signature;
    console.log(`  treasury ${t.skipped ? "already provisioned" : "created " + t.signature}`);
    for (const p of plan) {
      const r = await provisionMultisig({
        connection, feePayer, createKey: p.createKey, owner, agent: agent.publicKey, usdcMint, label: p.buyer.id,
        spendingLimit: { createKey: p.limitCreateKey, amountUsdc: limitUsdc, treasury },
        confirm: confirmOrAbort,
      });
      if (r.signature) sigs[p.buyer.id] = r.signature;
      console.log(`  ${p.buyer.id} ${r.skipped ? "already provisioned" : "created " + r.signature}`);
    }
    const atas = await ensureAtas({ connection, feePayer, usdcMint, vaults: [{ label: "treasury", ...treasury }, ...plan.map((p) => ({ label: p.buyer.id, vaultPda: p.vaultPda, vaultAta: p.vaultAta }))], confirm: confirmOrAbort });
    if (atas.signature) sigs.atas = atas.signature;

    // DB write-back (idempotent updates; no prompt — off-chain)
    await store.updateTreasuryAccounts(EXPORTER_ID, { treasuryMultisig: treasury.multisigPda.toBase58(), treasuryVault: treasury.vaultPda.toBase58(), treasuryUsdcAta: treasury.vaultAta.toBase58() });
    for (const p of plan) {
      await store.updateBuyerAccounts(EXPORTER_ID, p.buyer.id, { multisig: p.multisigPda.toBase58(), vault: p.vaultPda.toBase58(), usdcAta: p.vaultAta.toBase58(), spendingLimitPda: p.spendingLimitPda.toBase58() });
    }
    await raw.update(schema.users).set({ walletPubkey: owner.toBase58() }).where(eq(schema.users.id, "usr_owner"));
    await raw.update(schema.exporters).set({ cashOutWhitelist: [{ label: "HATA USDC deposit (Solana) · Teratai Woodworks", address: cashOut.toBase58() }] }).where(eq(schema.exporters.id, EXPORTER_ID));
    console.log("  DB: treasury, buyers, owner wallet and cash-out whitelist written");

    // Live demo invoices (skip if their numbers exist)
    const existing = new Set((await store.listInvoices(EXPORTER_ID)).map((i) => i.number));
    for (const inv of DEMO_INVOICES) {
      if (existing.has(inv.number)) {
        console.log(`  invoice ${inv.number} exists`);
        continue;
      }
      const reference = Keypair.generate().publicKey.toBase58();
      const created = await store.createInvoice({
        exporterId: EXPORTER_ID, buyerId: inv.buyerId, number: inv.number,
        lineItems: [{ description: inv.description, quantity: 1, unitPriceUsdc: inv.unitPriceUsdc }],
        issuedAt: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
        referencePubkey: reference, status: "sent",
      });
      console.log(`  invoice ${created.number} ${created.id}: USDC ${created.amountUsdc} memo ${created.memoCode} reference ${reference} pay ${created.payUrl}`);
    }

    const after = await connection.getBalance(feePayer.publicKey);
    console.log(`\n  SOL spent: ${sol(before - after)} (${sol(before)} → ${sol(after)})`);
    console.log("  signatures:", JSON.stringify(sigs, null, 2));
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
