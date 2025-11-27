-- Ajout des informations de gestionnaire sur les pièces jointes

ALTER TABLE public.intervention_attachments
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_by_display text NULL,
  ADD COLUMN IF NOT EXISTS created_by_code text NULL,
  ADD COLUMN IF NOT EXISTS created_by_color text NULL;

ALTER TABLE public.artisan_attachments
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_by_display text NULL,
  ADD COLUMN IF NOT EXISTS created_by_code text NULL,
  ADD COLUMN IF NOT EXISTS created_by_color text NULL;

