ALTER TYPE "public"."agent_action_kind" ADD VALUE 'reply';--> statement-breakpoint
ALTER TABLE "agent_actions" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "exporters" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "status" text DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "in_reply_to" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_status_valid" CHECK ("messages"."status" in ('draft', 'sent', 'discarded'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_valid" CHECK ("messages"."channel" in ('email', 'pay_page', 'logged'));--> statement-breakpoint
-- Buyer messages (IMPROVEMENTS E2/M1). Same content-free rule as 0004: the pay page and the owner inbox
-- hear "something changed" and refetch through the server, which decides what each side may see.
--   invoice:<invoice_id>  event "message": {} (the pay-page thread refetches; drafts never reach it)
--   owner:<exporter_id>   event "changed": {table: "messages"}
CREATE OR REPLACE FUNCTION public.kutip_broadcast_message() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  exporter text;
BEGIN
  SELECT i.exporter_id INTO exporter FROM public.invoices i WHERE i.id = NEW.invoice_id;
  PERFORM realtime.send('{}'::jsonb, 'message', 'invoice:' || NEW.invoice_id, false);
  PERFORM realtime.send(jsonb_build_object('table', 'messages'), 'changed', 'owner:' || exporter, false);
  RETURN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.messages;
    CREATE TRIGGER kutip_broadcast AFTER INSERT OR UPDATE ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.kutip_broadcast_message();
  END IF;
END $$;
