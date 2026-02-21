-- Migration: Add smtp_message_id to email_logs
-- Permet de tracer le message ID retourné par le serveur SMTP (Gmail)

ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS smtp_message_id text;

-- Index pour rechercher par message ID SMTP
CREATE INDEX IF NOT EXISTS idx_email_logs_smtp_message_id
  ON public.email_logs (smtp_message_id)
  WHERE smtp_message_id IS NOT NULL;

-- RLS policy : tous les utilisateurs authentifiés peuvent lire les logs email
-- (l'historique doit être visible par tous les gestionnaires, pas seulement l'expéditeur)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_logs'
      AND policyname = 'email_logs_read_all_authenticated'
  ) THEN
    CREATE POLICY email_logs_read_all_authenticated
      ON public.email_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- RLS policy : tous les utilisateurs authentifiés peuvent insérer des logs email
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
