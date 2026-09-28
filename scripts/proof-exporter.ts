/**
 * Session 8b proofs on localhost: a throw-away exporter ("ZZ TEST …", deleted by
 * demo-reset) whose Squads accounts are the LEGACY ones owned by the localhost passkey
 * wallet (Session 5's first provisioning), so the owner can sign in locally, press
 * "Sweep now" (legacy buyer vault → legacy treasury) and "Cash out" (Touch ID) without
 * touching exp_teratai or the production passkey (which is bound to kutip-app.vercel.app).
 *
 *   pnpm --filter @kutip/scripts exec tsx proof-exporter.ts --owner <wallet> --privy <did:privy:…> [--yes]
 *
 * Database only: no mainnet writes. Read-only phase derives the legacy accounts from the
 * fee payer + owner (same derivation as provision-demo.ts), checks them on-chain and prints
 * balances; aborts if the treasury is missing. Skip-if-done: an exporter with this name and
 * treasury already exists → nothing written.
 */
import { DEFAULT_RULEBOOK } from "@kutip/agent";
import { schema } from "@kutip/db";
import { createKeyFor, deriveAccounts, limitCreateKeyFor, spendingLimitPdaFor } from "@kutip/solana";
import { getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { EXPORTER_ID, YES, arg, chain, closePrompt, db } from "./_shared";

const NAME = "ZZ TEST 8b proofs (legacy treasury)";
const BUYERS = [
  { id: "b_harbourline", name: "Harbourline Interiors Pty Ltd", contactName: "Claire Whitmore", country: "AU", countryName: "Australia", city: "Sydney", timezone: "Australia/Sydney" },
  { id: "b_meridian", name: "Meridian Hospitality Group LLC", contactName: "Devon Alvarez", country: "US", countryName: "United States", city: "Austin, Texas", timezone: "America/Chicago" },
];

async function main() {
  const { connection, feePayer, usdcMint } = chain();
  const { store, db: raw, close } = db();
  try {
    const owner = new PublicKey(arg("owner") ?? "");
    const privyUserId = arg("privy") ?? "";
    if (!privyUserId.startsWith("did:privy:")) throw new Error("pass --privy did:privy:…");
    const inbox = arg("inbox") ?? (process.env.EMAIL_ALLOWLIST ?? "").split(",")[0]?.trim() ?? "";

    // ---------------- read-only phase ----------------
    const treasury = deriveAccounts(createKeyFor(feePayer.secretKey, `treasury:${EXPORTER_ID}:${owner.toBase58()}`).publicKey, usdcMint);
    const buyers = BUYERS.map((b) => {
      const accounts = deriveAccounts(createKeyFor(feePayer.secretKey, `buyer:${b.id}:${owner.toBase58()}`).publicKey, usdcMint);
      return { ...b, ...accounts, spendingLimitPda: spendingLimitPdaFor(accounts.multisigPda, limitCreateKeyFor(feePayer.secretKey, accounts.multisigPda).publicKey) };
    });
    const bal = async (ata: PublicKey) => getAccount(connection, ata).then((a) => a.amount).catch(() => null);
    const tBal = await bal(treasury.vaultAta);
    if (!(await connection.getAccountInfo(treasury.multisigPda))) throw new Error(`no treasury multisig on-chain for owner ${owner.toBase58()} (${treasury.multisigPda.toBase58()})`);
    console.log(`legacy treasury ${treasury.multisigPda.toBase58()} vault ${treasury.vaultPda.toBase58()} USDC ${tBal ?? "no ATA"}`);
    for (const b of buyers) {
      const exists = Boolean(await connection.getAccountInfo(b.multisigPda));
      console.log(`  ${b.id}: multisig ${b.multisigPda.toBase58()} ${exists ? "" : "(MISSING) "}vault USDC ${(await bal(b.vaultAta)) ?? "no ATA"} limit ${b.spendingLimitPda.toBase58()}`);
    }
    const [existing] = await raw.select({ id: schema.exporters.id }).from(schema.exporters).where(eq(schema.exporters.name, NAME));
    if (existing) {
      console.log(`already set up as ${existing.id}; nothing to do`);
      return;
    }
    const [userTaken] = await raw.select({ id: schema.users.id, exporterId: schema.users.exporterId }).from(schema.users).where(eq(schema.users.privyUserId, privyUserId));
    if (userTaken) throw new Error(`${privyUserId} is already linked to ${userTaken.exporterId} (${userTaken.id})`);

    console.log(`plan (database only): exporter "${NAME}" demo_funds=true, owner user ${privyUserId} / ${owner.toBase58()}, ${buyers.length} buyers (email → ${inbox || "none"}), empty cash-out whitelist (add HATA/test address in the UI with Touch ID)`);
    if (!YES) {
      closePrompt();
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const answer = stdin.isTTY ? await rl.question("  proceed? [y/N] ") : "n";
      rl.close();
      if (answer.trim() !== "y") {
        console.log("aborted; nothing written");
        process.exit(1);
      }
    }

    // ---------------- write phase (database only) ----------------
    const e = await store.createExporter({
      name: NAME,
      registrationNo: "000000000000",
      city: "Muar, Johor",
      address: "Test exporter for Session 8b proofs",
      contactEmail: inbox,
      demoFunds: true,
      treasuryMultisig: treasury.multisigPda.toBase58(),
      treasuryVault: treasury.vaultPda.toBase58(),
      treasuryUsdcAta: treasury.vaultAta.toBase58(),
      rulebook: DEFAULT_RULEBOOK,
      cashOutWhitelist: [],
    });
    await store.createUser({ exporterId: e.id, name: "Farid Zulkifli (localhost passkey)", role: "owner", privyUserId, walletPubkey: owner.toBase58() });
    for (const b of buyers) {
      await store.createBuyer({
        exporterId: e.id,
        name: b.name,
        contactName: b.contactName,
        email: inbox,
        country: b.country,
        countryName: b.countryName,
        city: b.city,
        address: "",
        timezone: b.timezone,
        multisig: b.multisigPda.toBase58(),
        vault: b.vaultPda.toBase58(),
        usdcAta: b.vaultAta.toBase58(),
        spendingLimitPda: b.spendingLimitPda.toBase58(),
      });
    }
    await store.updateBalances(e.id, { treasuryUsdc: tBal ?? 0n, vaults: Object.fromEntries(await Promise.all(buyers.map(async (b) => [b.id, (await bal(b.vaultAta)) ?? 0n] as const))) });
    console.log(`created ${e.id}; sign in on localhost with the ${owner.toBase58()} passkey and you land in it. demo-reset deletes it (name starts with "ZZ TEST").`);
  } finally {
    closePrompt();
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
