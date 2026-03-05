-- Enable realtime on app_updates so gestionnaires receive publication events
ALTER TABLE public.app_updates REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_updates;
  END IF;
END $$;
