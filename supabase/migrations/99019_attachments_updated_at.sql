-- Add updated_at column to intervention_attachments and artisan_attachments
-- Required by the set_updated_at() trigger that exists in production

ALTER TABLE public.intervention_attachments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.artisan_attachments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add triggers to keep updated_at in sync (mirrors production state)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intervention_attachments_updated_at') THEN
    CREATE TRIGGER trg_intervention_attachments_updated_at
      BEFORE UPDATE ON public.intervention_attachments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_artisan_attachments_updated_at') THEN
    CREATE TRIGGER trg_artisan_attachments_updated_at
      BEFORE UPDATE ON public.artisan_attachments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
