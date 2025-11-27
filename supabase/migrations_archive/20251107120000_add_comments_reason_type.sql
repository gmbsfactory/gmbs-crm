-- Migration: Ajouter reason_type aux commentaires
-- Objectif ARC-001 : tracer la raison (archivage / terminé)

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS reason_type text;

-- Limiter les valeurs autorisées
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_reason_type_check;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_reason_type_check
  CHECK (reason_type IS NULL OR reason_type IN ('archive', 'done'));

COMMENT ON COLUMN public.comments.reason_type IS 'Motif système pour ARC-001 (archive/done)';
