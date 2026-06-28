-- ============================================================
-- Migration 99036: assainissement des sessions historiques polluées
--
-- Avant le journal d'événements, user_page_sessions accumulait des sessions
-- « fantômes » (onglet laissé ouvert pendant la veille → durée = sommeil) et
-- des orphelines (ended_at NULL, beforeunload non déclenché).
--
-- Cette migration borne ces cas, en SAUVEGARDANT d'abord les valeurs d'origine
-- (table de backup) → entièrement RÉVERSIBLE. Idempotente.
--
-- Règles (cf. décision produit) :
--   - Orphelines (ended_at NULL)      → ended_at = started_at + 1 min, durée 60 s
--   - Sessions > 2 h continu          → plafonnées à 2 h
--
-- RESTAURATION (si besoin) :
--   UPDATE public.user_page_sessions s
--     SET ended_at = b.original_ended_at, duration_ms = b.original_duration_ms
--   FROM public.user_page_sessions_cleanup_backup b
--   WHERE s.id = b.id;
-- ============================================================

-- 0) Table de sauvegarde des valeurs d'origine
CREATE TABLE IF NOT EXISTS public.user_page_sessions_cleanup_backup (
  id                   uuid PRIMARY KEY,
  original_ended_at    timestamptz,
  original_duration_ms integer,
  reason               text,
  cleaned_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_page_sessions_cleanup_backup IS
  'Sauvegarde des valeurs d''origine avant assainissement (migration 99036). Permet la restauration.';

-- 1) Orphelines (ended_at NULL) : sauvegarde puis fermeture à 1 min
INSERT INTO public.user_page_sessions_cleanup_backup (id, original_ended_at, original_duration_ms, reason)
SELECT s.id, s.ended_at, s.duration_ms, 'orphan'
FROM public.user_page_sessions s
WHERE s.ended_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_page_sessions_cleanup_backup b WHERE b.id = s.id);

UPDATE public.user_page_sessions
SET ended_at = started_at + interval '1 minute',
    duration_ms = 60000
WHERE ended_at IS NULL;

-- 2) Sessions > 2 h : sauvegarde puis plafond à 2 h
INSERT INTO public.user_page_sessions_cleanup_backup (id, original_ended_at, original_duration_ms, reason)
SELECT s.id, s.ended_at, s.duration_ms, 'over_2h'
FROM public.user_page_sessions s
WHERE s.duration_ms > 7200000
  AND NOT EXISTS (SELECT 1 FROM public.user_page_sessions_cleanup_backup b WHERE b.id = s.id);

UPDATE public.user_page_sessions
SET ended_at = started_at + interval '2 hours',
    duration_ms = 7200000
WHERE duration_ms > 7200000;
