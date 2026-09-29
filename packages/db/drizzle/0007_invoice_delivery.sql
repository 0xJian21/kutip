ALTER TABLE "invoices" ADD COLUMN "send_to" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "send_cc" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "to_address" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "delivery" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_delivery_valid" CHECK ("messages"."delivery" is null or "messages"."delivery" in ('sent', 'recorded', 'skipped', 'failed'));