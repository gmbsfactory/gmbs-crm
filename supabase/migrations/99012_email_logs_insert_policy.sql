-- Migration: Add INSERT RLS policy for email_logs
-- Permet aux utilisateurs authentifiés d'insérer des logs email depuis l'API

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_logs'
      AND policyname = 'email_logs_insert_authenticated'
  ) THEN
    CREATE POLICY email_logs_insert_authenticated
      ON public.email_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
