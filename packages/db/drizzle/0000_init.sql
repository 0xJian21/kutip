CREATE TYPE "public"."agent_action_kind" AS ENUM('reminder', 'classify_reply', 'sweep', 'sweep_proposal', 'escalate', 'cash_out_alert', 'extract_invoice', 'cancel_reminders');--> statement-breakpoint
CREATE TYPE "public"."agent_action_status" AS ENUM('proposed', 'approved', 'executed', 'rejected', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."commitment" AS ENUM('processed', 'confirmed', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'seen', 'paid', 'settled', 'partially_paid', 'overdue', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."payment_via" AS ENUM('solana_pay', 'x402');--> statement-breakpoint
CREATE TYPE "public"."screening_result" AS ENUM('pass', 'flag');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"exporter_id" text NOT NULL,
	"buyer_id" text,
	"invoice_id" text,
	"kind" "agent_action_kind" NOT NULL,
	"input_summary" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"confidence" double precision NOT NULL,
	"rule_id" text NOT NULL,
	"status" "agent_action_status" NOT NULL,
	"tx_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" text PRIMARY KEY NOT NULL,
	"exporter_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"country" text NOT NULL,
	"country_name" text NOT NULL,
	"city" text NOT NULL,
	"timezone" text NOT NULL,
	"multisig" text NOT NULL,
	"vault" text NOT NULL,
	"usdc_ata" text NOT NULL,
	"spending_limit_pda" text,
	"vault_usdc_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exporters" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration_no" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"treasury_multisig" text NOT NULL,
	"treasury_vault" text NOT NULL,
	"treasury_usdc_ata" text NOT NULL,
	"treasury_usdc_balance" bigint DEFAULT 0 NOT NULL,
	"rulebook" jsonb NOT NULL,
	"cash_out_whitelist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exporters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"date" date PRIMARY KEY NOT NULL,
	"myr_per_usd" bigint NOT NULL,
	"avg_30d_myr_per_usd" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fx_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"exporter_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"number" text NOT NULL,
	"line_items" jsonb NOT NULL,
	"amount_usdc" bigint NOT NULL,
	"received_usdc" bigint DEFAULT 0 NOT NULL,
	"issued_at" date NOT NULL,
	"due_date" date NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"reference_pubkey" text NOT NULL,
	"memo_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	CONSTRAINT "invoices_reference_pubkey_unique" UNIQUE("reference_pubkey"),
	CONSTRAINT "invoices_memo_code_unique" UNIQUE("memo_code"),
	CONSTRAINT "invoices_exporter_number_uq" UNIQUE("exporter_id","number"),
	CONSTRAINT "invoices_amount_positive" CHECK ("invoices"."amount_usdc" > 0),
	CONSTRAINT "invoices_received_nonneg" CHECK ("invoices"."received_usdc" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"direction" "message_direction" NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"from" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"classification" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"signature" text NOT NULL,
	"payer" text NOT NULL,
	"mint" text DEFAULT 'USDC' NOT NULL,
	"amount" bigint NOT NULL,
	"input_mint" text,
	"input_amount" bigint,
	"quoted_input" bigint,
	"quoted_out" bigint,
	"commitment" "commitment" NOT NULL,
	"slot" bigint NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"via" "payment_via" NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "payments_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "screenings" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"invoice_id" text,
	"result" "screening_result" NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "screenings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sweeps" (
	"id" text PRIMARY KEY NOT NULL,
	"exporter_id" text NOT NULL,
	"buyer_ids" text[] NOT NULL,
	"amount_usdc" bigint DEFAULT 0 NOT NULL,
	"signature" text,
	"scheduled_for" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	CONSTRAINT "sweeps_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
ALTER TABLE "sweeps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"exporter_id" text NOT NULL,
	"name" text NOT NULL,
	"privy_user_id" text,
	"wallet_pubkey" text,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_privy_user_id_unique" UNIQUE("privy_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_exporter_id_exporters_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."exporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_exporter_id_exporters_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."exporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_exporter_id_exporters_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."exporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweeps" ADD CONSTRAINT "sweeps_exporter_id_exporters_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."exporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_exporter_id_exporters_id_fk" FOREIGN KEY ("exporter_id") REFERENCES "public"."exporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_actions_exporter_created_idx" ON "agent_actions" USING btree ("exporter_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_actions_buyer_idx" ON "agent_actions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "buyers_exporter_idx" ON "buyers" USING btree ("exporter_id");--> statement-breakpoint
CREATE INDEX "invoices_exporter_idx" ON "invoices" USING btree ("exporter_id");--> statement-breakpoint
CREATE INDEX "invoices_buyer_idx" ON "invoices" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "messages_invoice_idx" ON "messages" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "screenings_wallet_idx" ON "screenings" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "sweeps_exporter_idx" ON "sweeps" USING btree ("exporter_id");--> statement-breakpoint
CREATE INDEX "users_exporter_idx" ON "users" USING btree ("exporter_id");