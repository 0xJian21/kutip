-- Supabase Realtime Broadcast from DB triggers (DECISIONS "after the spikes" #5).
-- The anon key still reads no table: the browser only joins broadcast topics.
--   invoice:<invoice_id>  events "invoice" and "payment": status fields only (pay page + owner invoice page).
--                          Public topic; the unguessable invoice id is the same credential as the pay link.
--   owner:<exporter_id>   event "changed": {table, id, invoiceId} with no content; the owner UI refetches
--                          through its server routes. Public too (owners log in with Privy, not Supabase Auth).
-- Installed only where realtime.send exists (Supabase; tests stub it), so plain Postgres stays a no-op.

CREATE OR REPLACE FUNCTION public.kutip_iso(t timestamptz) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$ SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.kutip_broadcast() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  exporter text;
  invoice text;
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    exporter := NEW.exporter_id;
    invoice := NEW.id;
    PERFORM realtime.send(jsonb_build_object(
      'id', NEW.id, 'status', NEW.status,
      'amountUsdc', NEW.amount_usdc::text, 'receivedUsdc', NEW.received_usdc::text,
      'seenAt', public.kutip_iso(NEW.seen_at), 'paidAt', public.kutip_iso(NEW.paid_at), 'settledAt', public.kutip_iso(NEW.settled_at)
    ), 'invoice', 'invoice:' || NEW.id, false);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    SELECT i.exporter_id INTO exporter FROM public.invoices i WHERE i.id = NEW.invoice_id;
    invoice := NEW.invoice_id;
    PERFORM realtime.send(jsonb_build_object(
      'id', NEW.id, 'invoiceId', NEW.invoice_id, 'signature', NEW.signature, 'payer', NEW.payer,
      'amount', NEW.amount::text, 'inputMint', NEW.input_mint, 'inputAmount', NEW.input_amount::text,
      'quotedInput', NEW.quoted_input::text, 'quotedOut', NEW.quoted_out::text,
      'commitment', NEW.commitment, 'slot', NEW.slot, 'verified', NEW.verified, 'issues', NEW.issues, 'via', NEW.via,
      'observedAt', public.kutip_iso(NEW.observed_at), 'confirmedAt', public.kutip_iso(NEW.confirmed_at), 'finalizedAt', public.kutip_iso(NEW.finalized_at)
    ), 'payment', 'invoice:' || NEW.invoice_id, false);
  ELSIF TG_TABLE_NAME = 'agent_actions' THEN
    exporter := NEW.exporter_id;
    invoice := NEW.invoice_id;
  ELSIF TG_TABLE_NAME = 'buyers' THEN
    exporter := NEW.exporter_id;
  ELSIF TG_TABLE_NAME = 'exporters' THEN
    exporter := NEW.id;
  END IF;
  PERFORM realtime.send(jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id, 'invoiceId', invoice), 'changed', 'owner:' || exporter, false);
  RETURN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.invoices;
    CREATE TRIGGER kutip_broadcast AFTER INSERT OR UPDATE ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION public.kutip_broadcast();
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.payments;
    CREATE TRIGGER kutip_broadcast AFTER INSERT OR UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.kutip_broadcast();
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.agent_actions;
    CREATE TRIGGER kutip_broadcast AFTER INSERT OR UPDATE ON public.agent_actions
      FOR EACH ROW EXECUTE FUNCTION public.kutip_broadcast();
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.buyers;
    CREATE TRIGGER kutip_broadcast AFTER UPDATE OF vault_usdc_balance ON public.buyers
      FOR EACH ROW WHEN (OLD.vault_usdc_balance IS DISTINCT FROM NEW.vault_usdc_balance) EXECUTE FUNCTION public.kutip_broadcast();
    DROP TRIGGER IF EXISTS kutip_broadcast ON public.exporters;
    CREATE TRIGGER kutip_broadcast AFTER UPDATE OF treasury_usdc_balance ON public.exporters
      FOR EACH ROW WHEN (OLD.treasury_usdc_balance IS DISTINCT FROM NEW.treasury_usdc_balance) EXECUTE FUNCTION public.kutip_broadcast();
  END IF;
END $$;
