-- owner:<exporter_id> is a public topic with a guessable name, and an invoice id is the pay-link credential.
-- The "changed" event now carries only the table name; the owner UI refetches through its server routes.
CREATE OR REPLACE FUNCTION public.kutip_broadcast() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  exporter text;
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    exporter := NEW.exporter_id;
    PERFORM realtime.send(jsonb_build_object(
      'id', NEW.id, 'status', NEW.status,
      'amountUsdc', NEW.amount_usdc::text, 'receivedUsdc', NEW.received_usdc::text,
      'seenAt', public.kutip_iso(NEW.seen_at), 'paidAt', public.kutip_iso(NEW.paid_at), 'settledAt', public.kutip_iso(NEW.settled_at)
    ), 'invoice', 'invoice:' || NEW.id, false);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    SELECT i.exporter_id INTO exporter FROM public.invoices i WHERE i.id = NEW.invoice_id;
    PERFORM realtime.send(jsonb_build_object(
      'id', NEW.id, 'invoiceId', NEW.invoice_id, 'signature', NEW.signature, 'payer', NEW.payer,
      'amount', NEW.amount::text, 'inputMint', NEW.input_mint, 'inputAmount', NEW.input_amount::text,
      'quotedInput', NEW.quoted_input::text, 'quotedOut', NEW.quoted_out::text,
      'commitment', NEW.commitment, 'slot', NEW.slot, 'verified', NEW.verified, 'issues', NEW.issues, 'via', NEW.via,
      'observedAt', public.kutip_iso(NEW.observed_at), 'confirmedAt', public.kutip_iso(NEW.confirmed_at), 'finalizedAt', public.kutip_iso(NEW.finalized_at)
    ), 'payment', 'invoice:' || NEW.invoice_id, false);
  ELSIF TG_TABLE_NAME = 'agent_actions' THEN
    exporter := NEW.exporter_id;
  ELSIF TG_TABLE_NAME = 'buyers' THEN
    exporter := NEW.exporter_id;
  ELSIF TG_TABLE_NAME = 'exporters' THEN
    exporter := NEW.id;
  END IF;
  PERFORM realtime.send(jsonb_build_object('table', TG_TABLE_NAME), 'changed', 'owner:' || exporter, false);
  RETURN NULL;
END $$;
