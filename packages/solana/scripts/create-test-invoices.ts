// Session 3 mainnet proof: a clearly named TEST exporter + buyer (Spike B's live Squads vault) + small invoices.
// Never touches the seeded demo rows. Read-only phase first; skips if the test exporter already exists.
// Run: pnpm --filter @kutip/solana test-invoices [--yes]
import { connect, createStore } from "@kutip/db";
import { newReferenceKey } from "../src/shared/keys";

const TEST_EXPORTER = "ZZ TEST Session 3 Payments (not a demo row)";
const SPIKE_B = {
  treasuryMultisig: "HWBKQncjh9b95jiRsP9Ypy6RSinQYgjUzditxEW9G1ur",
  treasuryVault: "2HYRBK6y9ibDM3cdRVpdrmhZoDqTEqiQaC8hq4uUzSuM",
  treasuryUsdcAta: "6b85KZmzapHBE2pQtEnMywor9yXedsLp2yJH7T16vmdB",
  buyerMultisig: "J9k4BTxAE9d4iapnJo9AsCrVKhrQ9qYKpXe5aM49zzcR",
  buyerVault: "4knsrLskrCc1KBmQ5baYEBkaXmK73izrA7TNgvqiYDte",
  buyerUsdcAta: "FQ1kmSvQqNzdqaKspuaY4XL7D53ZUFQGoPyzRL1WdATS",
};
const INVOICES = ["phantom-usdc", "phantom-sol", "solflare-usdc", "solflare-sol", "x402-bot"];
const AMOUNT = 100_000n; // 0.10 USDC each, ≤ 1 USDC total cap

const url = process.env["DATABASE_URL"];
const appUrl = process.env["APP_URL"] ?? "http://localhost:3000";
if (!url) throw new Error("missing DATABASE_URL");
const { db, close } = connect(url, { max: 1 });
const store = createStore(db, { appUrl });

try {
  // read-only phase
  const existing = await db.query.exporters.findFirst({ where: (t, { eq }) => eq(t.name, TEST_EXPORTER) });
  if (existing) {
    const invoices = await store.listInvoices(existing.id, { status: "all" });
    console.log(`test exporter exists (${existing.id}); ${invoices.length} invoices:`);
    for (const i of invoices) console.log(`  ${i.id}  ${i.number}  ${i.status.padEnd(8)}  ${i.lineItems[0]?.description}  ref ${i.referencePubkey}  memo ${i.memoCode}`);
    process.exit(0);
  }
  console.log(`plan: create exporter "${TEST_EXPORTER}", 1 buyer on Spike B vault ${SPIKE_B.buyerVault} (ATA ${SPIKE_B.buyerUsdcAta}), ${INVOICES.length} × 0.10 USDC invoices`);
  if (!process.argv.includes("--yes")) {
    console.log("dry run; pass --yes to write");
    process.exit(0);
  }
  const exporter = await store.createExporter({
    name: TEST_EXPORTER,
    city: "Muar",
    treasuryMultisig: SPIKE_B.treasuryMultisig,
    treasuryVault: SPIKE_B.treasuryVault,
    treasuryUsdcAta: SPIKE_B.treasuryUsdcAta,
    rulebook: {
      collections: { firstReminderDaysBeforeDue: 3, maxMessagesPer48h: 1, quietHoursStart: 18, quietHoursEnd: 9, maxDiscountPctWithoutApproval: 2, escalateAfterOverdueReminders: 2, escalateOnDispute: true },
      treasury: { acceptedTokens: ["USDC", "SOL", "USDT"], sweepDaily: true, sweepRandomised: true, agentDailyLimitUsdc: 5_000_000_000n, otherMovementsNeedApproval: true, cashOutAlertMarginBps: 50n },
    },
  });
  const buyer = await store.createBuyer({
    exporterId: exporter.id,
    name: "ZZ TEST Buyer (Spike B vault)",
    contactName: "Test",
    email: "test@example.invalid",
    country: "AU",
    countryName: "Australia",
    city: "Sydney",
    timezone: "Australia/Sydney",
    multisig: SPIKE_B.buyerMultisig,
    vault: SPIKE_B.buyerVault,
    usdcAta: SPIKE_B.buyerUsdcAta,
  });
  const today = new Date().toISOString().slice(0, 10);
  for (const label of INVOICES) {
    const inv = await store.createInvoice({
      exporterId: exporter.id,
      buyerId: buyer.id,
      lineItems: [{ description: `Session 3 test payment (${label})`, quantity: 1, unitPriceUsdc: AMOUNT }],
      issuedAt: today,
      dueDate: today,
      referencePubkey: newReferenceKey(),
      status: "sent",
    });
    console.log(`  ${label.padEnd(14)} ${inv.id}  ${inv.number}  ref ${inv.referencePubkey}  memo ${inv.memoCode}\n    pay  ${appUrl}/pay/${inv.id}\n    x402 ${appUrl}/api/x402/invoice/${inv.id}`);
  }
} finally {
  await close();
}
