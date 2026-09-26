CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"reference_pubkey" text NOT NULL,
	"input_mint" text NOT NULL,
	"quoted_input" bigint NOT NULL,
	"quoted_out" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "promised_date" date;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_reference_pubkey_invoices_reference_pubkey_fk" FOREIGN KEY ("reference_pubkey") REFERENCES "public"."invoices"("reference_pubkey") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_reference_idx" ON "quotes" USING btree ("reference_pubkey","created_at");