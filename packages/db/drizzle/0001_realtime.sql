-- Supabase Realtime: stream changes on invoices, payments, agent_actions.
-- Guarded so it is a no-op on plain Postgres (PGlite in tests) where the publication doesn't exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agent_actions') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_actions;
    END IF;
  END IF;
END $$;
