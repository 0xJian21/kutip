ALTER TABLE "agent_actions" ADD COLUMN "proposal_index" bigint;--> statement-breakpoint
ALTER TABLE "buyers" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "contact_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "demo_funds" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "agent_permissions_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "agent_permissions_signature" text;--> statement-breakpoint
-- Rulebooks stored before the "Replies" section existed get the defaults (@kutip/agent DEFAULT_REPLIES).
UPDATE "exporters" SET "rulebook" = "rulebook" || '{"replies":{"remindersAndReceipts":"automatic","buyerReplies":"draft"}}'::jsonb WHERE NOT ("rulebook" ? 'replies');
