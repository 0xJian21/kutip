/**
 * Drizzle schema. Mirrors docs/ARCHITECTURE.md "Data model", plus the fields
 * the UI needs (apps/web/lib/ui/types.ts).
 * Money is always Postgres bigint ↔ TS bigint, in base units (USDC 6dp, SOL 9dp).
 * JSON columns can't hold bigint, so bigints inside jsonb are stored as decimal strings.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const usdc = (name: string) => bigint(name, { mode: "bigint" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "seen",
  "paid",
  "settled",
  "partially_paid",
  "overdue",
  "disputed",
]);
export const commitment = pgEnum("commitment", ["processed", "confirmed", "finalized"]);
export const paymentVia = pgEnum("payment_via", ["solana_pay", "x402"]);
export const screeningResult = pgEnum("screening_result", ["pass", "flag"]);
export const agentActionStatus = pgEnum("agent_action_status", ["proposed", "approved", "executed", "rejected", "escalated"]);
export const agentActionKind = pgEnum("agent_action_kind", [
  "reminder",
  "classify_reply",
  "sweep",
  "sweep_proposal",
  "escalate",
  "cash_out_alert",
  "extract_invoice",
  "cancel_reminders",
]);
export const messageDirection = pgEnum("message_direction", ["out", "in"]);
export const userRole = pgEnum("user_role", ["owner", "admin"]);

/** Rulebook as stored: bigint fields are decimal strings. */
export type RulebookJson = {
  collections: {
    firstReminderDaysBeforeDue: number;
    maxMessagesPer48h: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    maxDiscountPctWithoutApproval: number;
    escalateAfterOverdueReminders: number;
    escalateOnDispute: boolean;
  };
  treasury: {
    acceptedTokens: Array<"USDC" | "SOL" | "USDT">;
    sweepDaily: boolean;
    sweepRandomised: boolean;
    agentDailyLimitUsdc: string;
    otherMovementsNeedApproval: boolean;
    cashOutAlertMarginBps: string;
  };
  /** Session 8b (E3). Absent on rows stored before it existed; read back with the defaults. */
  replies?: {
    remindersAndReceipts: "automatic" | "draft";
    buyerReplies: "draft" | "routine" | "off";
  };
};

export type LineItemJson = { description: string; quantity: number; unitPriceUsdc: string };

export const exporters = pgTable("exporters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  registrationNo: text("registration_no").notNull().default(""),
  city: text("city").notNull().default(""),
  /** Company profile (R1): shown on invoices, the pay page and receipts. */
  address: text("address").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  /** Public Supabase Storage URL of the uploaded logo. */
  logoUrl: text("logo_url"),
  /** Demo exporters run on real mainnet accounts with test-sized balances; the UI says so. */
  demoFunds: boolean("demo_funds").notNull().default(false),
  /** Last time the owner approved the agent's permissions with the passkey (R4); the signature is the proof. */
  agentPermissionsApprovedAt: ts("agent_permissions_approved_at"),
  agentPermissionsSignature: text("agent_permissions_signature"),
  treasuryMultisig: text("treasury_multisig").notNull(),
  treasuryVault: text("treasury_vault").notNull(),
  treasuryUsdcAta: text("treasury_usdc_ata").notNull(),
  /** Cached on-chain balance of the main treasury USDC ATA; the worker refreshes it. */
  treasuryUsdcBalance: usdc("treasury_usdc_balance").notNull().default(sql`0`),
  rulebook: jsonb("rulebook").$type<RulebookJson>().notNull(),
  /** Owner's own whitelisted DAX deposit addresses (cash-out). */
  cashOutWhitelist: jsonb("cash_out_whitelist").$type<Array<{ label: string; address: string }>>().notNull().default([]),
  createdAt: createdAt(),
}).enableRLS();

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    exporterId: text("exporter_id").notNull().references(() => exporters.id),
    name: text("name").notNull(),
    privyUserId: text("privy_user_id").unique(),
    walletPubkey: text("wallet_pubkey"),
    role: userRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("users_exporter_idx").on(t.exporterId)],
).enableRLS();

export const buyers = pgTable(
  "buyers",
  {
    id: text("id").primaryKey(),
    exporterId: text("exporter_id").notNull().references(() => exporters.id),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    country: text("country").notNull(), // ISO 3166-1 alpha-2
    countryName: text("country_name").notNull(),
    city: text("city").notNull(),
    /** Billing address for the invoice document ("Billed to"). */
    address: text("address").notNull().default(""),
    timezone: text("timezone").notNull(), // IANA
    multisig: text("multisig").notNull(),
    vault: text("vault").notNull(),
    usdcAta: text("usdc_ata").notNull(),
    spendingLimitPda: text("spending_limit_pda"),
    /** Cached on-chain balance of this buyer's vault USDC ATA; the worker refreshes it. */
    vaultUsdcBalance: usdc("vault_usdc_balance").notNull().default(sql`0`),
    createdAt: createdAt(),
  },
  (t) => [index("buyers_exporter_idx").on(t.exporterId)],
).enableRLS();

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    exporterId: text("exporter_id").notNull().references(() => exporters.id),
    buyerId: text("buyer_id").notNull().references(() => buyers.id),
    number: text("number").notNull(), // off-chain only
    lineItems: jsonb("line_items").$type<LineItemJson[]>().notNull(),
    amountUsdc: usdc("amount_usdc").notNull(),
    receivedUsdc: usdc("received_usdc").notNull().default(sql`0`),
    issuedAt: date("issued_at", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    referencePubkey: text("reference_pubkey").notNull().unique(),
    memoCode: text("memo_code").notNull().unique(),
    createdAt: createdAt(),
    sentAt: ts("sent_at"),
    seenAt: ts("seen_at"),
    paidAt: ts("paid_at"),
    settledAt: ts("settled_at"),
    /** Date the buyer promised to pay (C5); reminders pause until the day after. */
    promisedDate: date("promised_date", { mode: "string" }),
  },
  (t) => [
    unique("invoices_exporter_number_uq").on(t.exporterId, t.number),
    index("invoices_exporter_idx").on(t.exporterId),
    index("invoices_buyer_idx").on(t.buyerId),
    check("invoices_amount_positive", sql`${t.amountUsdc} > 0`),
    check("invoices_received_nonneg", sql`${t.receivedUsdc} >= 0`),
  ],
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),
    signature: text("signature").notNull().unique(),
    payer: text("payer").notNull(),
    /** Token the vault received. Always "USDC" (look-alike mints are rejected upstream). */
    mint: text("mint").notNull().default("USDC"),
    amount: usdc("amount").notNull(),
    /** Token the buyer paid with when it was a swap: "SOL" | "USDT". */
    inputMint: text("input_mint"),
    inputAmount: bigint("input_amount", { mode: "bigint" }), // lamports or USDT base units
    quotedInput: bigint("quoted_input", { mode: "bigint" }),
    quotedOut: bigint("quoted_out", { mode: "bigint" }),
    commitment: commitment("commitment").notNull(),
    slot: bigint("slot", { mode: "number" }).notNull(),
    verified: boolean("verified").notNull().default(false),
    issues: jsonb("issues").$type<string[]>().notNull().default([]),
    via: paymentVia("via").notNull(),
    observedAt: ts("observed_at").notNull(),
    confirmedAt: ts("confirmed_at"),
    finalizedAt: ts("finalized_at"),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
).enableRLS();

/** Jupiter ExactOut quote taken when the swap tx was built (Session 3); the execution receipt compares against it. */
export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    referencePubkey: text("reference_pubkey").notNull().references(() => invoices.referencePubkey),
    /** Token the buyer pays with: "SOL" | "USDT". */
    inputMint: text("input_mint").notNull(),
    quotedInput: bigint("quoted_input", { mode: "bigint" }).notNull(), // lamports or USDT base units
    quotedOut: usdc("quoted_out").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quotes_reference_idx").on(t.referencePubkey, t.createdAt)],
).enableRLS();

export const screenings = pgTable(
  "screenings",
  {
    id: text("id").primaryKey(),
    wallet: text("wallet").notNull(),
    invoiceId: text("invoice_id").references(() => invoices.id),
    result: screeningResult("result").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("screenings_wallet_idx").on(t.wallet)],
).enableRLS();

export const agentActions = pgTable(
  "agent_actions",
  {
    id: text("id").primaryKey(),
    exporterId: text("exporter_id").notNull().references(() => exporters.id),
    buyerId: text("buyer_id").references(() => buyers.id),
    invoiceId: text("invoice_id").references(() => invoices.id),
    kind: agentActionKind("kind").notNull(),
    inputSummary: text("input_summary").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    confidence: doublePrecision("confidence").notNull(), // 0..1, display only
    ruleId: text("rule_id").notNull(),
    status: agentActionStatus("status").notNull(),
    txSignature: text("tx_signature"),
    /** Squads proposal (transaction index on the treasury multisig) behind a proposed action. */
    proposalIndex: bigint("proposal_index", { mode: "bigint" }),
    createdAt: createdAt(),
  },
  (t) => [index("agent_actions_exporter_created_idx").on(t.exporterId, t.createdAt), index("agent_actions_buyer_idx").on(t.buyerId)],
).enableRLS();

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull().references(() => invoices.id),
    direction: messageDirection("direction").notNull(),
    channel: text("channel").notNull().default("email"),
    from: text("from").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    classification: jsonb("classification").$type<{ intent: string; confidence: number }>(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_invoice_idx").on(t.invoiceId)],
).enableRLS();

export const sweeps = pgTable(
  "sweeps",
  {
    id: text("id").primaryKey(),
    exporterId: text("exporter_id").notNull().references(() => exporters.id),
    buyerIds: text("buyer_ids").array().notNull(),
    amountUsdc: usdc("amount_usdc").notNull().default(sql`0`),
    signature: text("signature").unique(),
    scheduledFor: ts("scheduled_for").notNull(),
    executedAt: ts("executed_at"),
  },
  (t) => [index("sweeps_exporter_idx").on(t.exporterId)],
).enableRLS();

/** BNM reference rate, MYR per USD with 4 decimals (42150 = 4.2150). One row per published date. */
export const fxRates = pgTable("fx_rates", {
  date: date("date", { mode: "string" }).primaryKey(),
  myrPerUsd: bigint("myr_per_usd", { mode: "bigint" }).notNull(),
  /** 30-day average as of this date, same units; computed by whoever records the rate. */
  avg30dMyrPerUsd: bigint("avg_30d_myr_per_usd", { mode: "bigint" }).notNull(),
}).enableRLS();
