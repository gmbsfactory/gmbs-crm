-- ========================================
-- GMBS CRM - Rafraîchissement Event-Driven des Vues Matérialisées
-- ========================================
-- Date: 2026-01-06
-- Description: Migration de pg_cron vers Database Webhook + Edge Function
--              pour réduire la latence de ~60s à ~5-10s
--
-- Architecture:
-- 1. Database Webhook détecte les changements sur les tables sources
-- 2. Appelle l'Edge Function refresh-search-views
-- 3. La fonction RPC ci-dessous gère le debounce côté PostgreSQL
-- 4. pg_cron reste en fallback (5 min) pour la résilience
-- ========================================

-- ========================================
-- 1️⃣ TABLE DE DEBOUNCE AMÉLIORÉE
-- ========================================

-- Améliorer la table existante avec des métriques
DO $$
BEGIN
  -- Ajouter une colonne de timestamp pour le debounce
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_views_refresh_flags'
    AND column_name = 'last_change_at'
  ) THEN
    ALTER TABLE public.search_views_refresh_flags
    ADD COLUMN last_change_at timestamptz;
  END IF;

  -- Ajouter des métriques
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_views_refresh_flags'
    AND column_name = 'refresh_count'
  ) THEN
    ALTER TABLE public.search_views_refresh_flags
    ADD COLUMN refresh_count bigint DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_views_refresh_flags'
    AND column_name = 'avg_refresh_duration_ms'
  ) THEN
    ALTER TABLE public.search_views_refresh_flags
    ADD COLUMN avg_refresh_duration_ms int;
  END IF;
END $$;

COMMENT ON COLUMN public.search_views_refresh_flags.last_change_at IS
'Timestamp de la dernière modification détectée (pour debounce)';

COMMENT ON COLUMN public.search_views_refresh_flags.refresh_count IS
'Nombre total de rafraîchissements effectués';

COMMENT ON COLUMN public.search_views_refresh_flags.avg_refresh_duration_ms IS
'Durée moyenne de rafraîchissement en ms';


-- ========================================
-- 2️⃣ FONCTION RPC AVEC DEBOUNCE INTELLIGENT
-- ========================================

-- Fonction principale appelée par l'Edge Function
-- Gère le debounce côté PostgreSQL pour éviter les refreshs trop fréquents
CREATE OR REPLACE FUNCTION public.refresh_search_views_debounced(
  p_refresh_interventions boolean DEFAULT false,
  p_refresh_artisans boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debounce_seconds int := 5; -- Debounce de 5 secondes
  v_interventions_needs_refresh boolean := false;
  v_artisans_needs_refresh boolean := false;
  v_last_change timestamptz;
  v_now timestamptz := now();
  v_refreshed_views text[] := ARRAY[]::text[];
  v_start_time timestamptz;
  v_duration_ms int;
BEGIN
  -- Vérifier si un refresh est nécessaire pour interventions
  IF p_refresh_interventions THEN
    SELECT last_change_at INTO v_last_change
    FROM public.search_views_refresh_flags
    WHERE id = 'interventions_search_mv';

    -- Refresh si:
    -- 1. Jamais rafraîchi (last_change_at IS NULL)
    -- 2. Dernière modification > debounce_seconds
    IF v_last_change IS NULL OR (v_now - v_last_change) > (v_debounce_seconds || ' seconds')::interval THEN
      v_interventions_needs_refresh := true;
    ELSE
      -- Mettre à jour le flag pour indiquer qu'un changement a eu lieu
      UPDATE public.search_views_refresh_flags
      SET needs_refresh = true,
          last_flag_set = v_now,
          last_change_at = v_now
      WHERE id = 'interventions_search_mv';
    END IF;
  END IF;

  -- Même logique pour artisans
  IF p_refresh_artisans THEN
    SELECT last_change_at INTO v_last_change
    FROM public.search_views_refresh_flags
    WHERE id = 'artisans_search_mv';

    IF v_last_change IS NULL OR (v_now - v_last_change) > (v_debounce_seconds || ' seconds')::interval THEN
      v_artisans_needs_refresh := true;
    ELSE
      UPDATE public.search_views_refresh_flags
      SET needs_refresh = true,
          last_flag_set = v_now,
          last_change_at = v_now
      WHERE id = 'artisans_search_mv';
    END IF;
  END IF;

  -- Si aucun refresh n'est nécessaire, retourner immédiatement
  IF NOT v_interventions_needs_refresh AND NOT v_artisans_needs_refresh THEN
    RETURN jsonb_build_object(
      'debounced', true,
      'message', 'Refresh debounced, waiting for more changes',
      'next_refresh_after', v_now + (v_debounce_seconds || ' seconds')::interval
    );
  END IF;

  -- Effectuer les refreshs nécessaires
  v_start_time := clock_timestamp();

  IF v_interventions_needs_refresh THEN
    RAISE NOTICE 'Refreshing interventions_search_mv...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.interventions_search_mv;
    v_refreshed_views := array_append(v_refreshed_views, 'interventions_search_mv');

    -- Mettre à jour les métriques
    UPDATE public.search_views_refresh_flags
    SET needs_refresh = false,
        last_refresh = v_now,
        last_change_at = v_now,
        refresh_count = refresh_count + 1
    WHERE id = 'interventions_search_mv';
  END IF;

  IF v_artisans_needs_refresh THEN
    RAISE NOTICE 'Refreshing artisans_search_mv...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.artisans_search_mv;
    v_refreshed_views := array_append(v_refreshed_views, 'artisans_search_mv');

    UPDATE public.search_views_refresh_flags
    SET needs_refresh = false,
        last_refresh = v_now,
        last_change_at = v_now,
        refresh_count = refresh_count + 1
    WHERE id = 'artisans_search_mv';
  END IF;

  -- Rafraîchir global_search_mv si au moins une vue a été rafraîchie
  IF array_length(v_refreshed_views, 1) > 0 THEN
    RAISE NOTICE 'Refreshing global_search_mv...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.global_search_mv;
    v_refreshed_views := array_append(v_refreshed_views, 'global_search_mv');
  END IF;

  v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::int;

  RETURN jsonb_build_object(
    'success', true,
    'refreshed_views', v_refreshed_views,
    'duration_ms', v_duration_ms,
    'debounced', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error refreshing search views: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'refreshed_views', v_refreshed_views
    );
END;
$$;

COMMENT ON FUNCTION public.refresh_search_views_debounced IS
'Rafraîchit les vues matérialisées de recherche avec debounce intelligent.
Appelée par l''Edge Function refresh-search-views via Database Webhook.
Le debounce de 5 secondes évite les refreshs trop fréquents.';


-- ========================================
-- 3️⃣ FONCTIONS RPC SÉCURISÉES (pour compatibilité)
-- ========================================

-- Wrapper sécurisé pour refresh_interventions_search
CREATE OR REPLACE FUNCTION public.refresh_interventions_search_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.interventions_search_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.global_search_mv;

  UPDATE public.search_views_refresh_flags
  SET needs_refresh = false,
      last_refresh = now(),
      refresh_count = refresh_count + 1
  WHERE id = 'interventions_search_mv';
END;
$$;

-- Wrapper sécurisé pour refresh_artisans_search
CREATE OR REPLACE FUNCTION public.refresh_artisans_search_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.artisans_search_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.global_search_mv;

  UPDATE public.search_views_refresh_flags
  SET needs_refresh = false,
      last_refresh = now(),
      refresh_count = refresh_count + 1
  WHERE id = 'artisans_search_mv';
END;
$$;

-- Wrapper sécurisé pour refresh global
CREATE OR REPLACE FUNCTION public.refresh_global_search_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.global_search_mv;
END;
$$;


-- ========================================
-- 4️⃣ MODIFIER pg_cron POUR FALLBACK (5 MIN)
-- ========================================

-- Désactiver le cron actuel (1 min)
SELECT cron.unschedule('refresh_search_views');

-- Recréer avec intervalle de 5 minutes (fallback)
-- Rafraîchit uniquement si needs_refresh = true ET last_flag_set > 5 min
SELECT cron.schedule(
  'refresh_search_views_fallback',
  '*/5 * * * *', -- Toutes les 5 minutes
  $$
  DO $$
  DECLARE
    v_now timestamptz := now();
    v_interventions_needs_refresh boolean;
    v_artisans_needs_refresh boolean;
    v_last_flag_set timestamptz;
  BEGIN
    -- Vérifier si interventions_search_mv a besoin d'un refresh
    SELECT needs_refresh, last_flag_set INTO v_interventions_needs_refresh, v_last_flag_set
    FROM public.search_views_refresh_flags
    WHERE id = 'interventions_search_mv';

    -- Refresh si le flag est true ET qu'il n'a pas été rafraîchi depuis 5 min
    -- (cas où le webhook aurait échoué)
    IF v_interventions_needs_refresh AND (v_now - v_last_flag_set) > interval '5 minutes' THEN
      PERFORM public.refresh_interventions_search_safe();
      RAISE NOTICE '[pg_cron fallback] Refreshed interventions_search_mv';
    END IF;

    -- Même logique pour artisans
    SELECT needs_refresh, last_flag_set INTO v_artisans_needs_refresh, v_last_flag_set
    FROM public.search_views_refresh_flags
    WHERE id = 'artisans_search_mv';

    IF v_artisans_needs_refresh AND (v_now - v_last_flag_set) > interval '5 minutes' THEN
      PERFORM public.refresh_artisans_search_safe();
      RAISE NOTICE '[pg_cron fallback] Refreshed artisans_search_mv';
    END IF;
  END $$;
  $$
);

COMMENT ON EXTENSION cron IS
'pg_cron utilisé comme fallback (5 min) pour le rafraîchissement des vues matérialisées.
Le système principal utilise Database Webhook + Edge Function (latence ~5-10s).';


-- ========================================
-- 5️⃣ INITIALISER LES NOUVELLES COLONNES
-- ========================================

UPDATE public.search_views_refresh_flags
SET last_change_at = COALESCE(last_refresh, now()),
    refresh_count = COALESCE(refresh_count, 0),
    avg_refresh_duration_ms = NULL
WHERE last_change_at IS NULL;


-- ========================================
-- 6️⃣ FONCTION DE MONITORING (OPTIONNEL)
-- ========================================

-- Vue pour monitorer l'état des refreshs
CREATE OR REPLACE VIEW public.search_views_refresh_status AS
SELECT
  id as view_name,
  needs_refresh,
  last_refresh,
  last_flag_set,
  last_change_at,
  refresh_count,
  avg_refresh_duration_ms,
  CASE
    WHEN last_refresh IS NULL THEN 'Never refreshed'
    WHEN (now() - last_refresh) < interval '1 minute' THEN 'Fresh (< 1 min)'
    WHEN (now() - last_refresh) < interval '5 minutes' THEN 'Recent (< 5 min)'
    WHEN (now() - last_refresh) < interval '1 hour' THEN 'Stale (< 1 hour)'
    ELSE 'Very stale (> 1 hour)'
  END as freshness,
  now() - last_refresh as age
FROM public.search_views_refresh_flags
ORDER BY id;

COMMENT ON VIEW public.search_views_refresh_status IS
'Vue de monitoring pour visualiser l''état des rafraîchissements des vues matérialisées';


-- ========================================
-- FIN DE LA MIGRATION
-- ========================================
-- Configuration Database Webhook dans Supabase Dashboard:
--
-- 1. Aller dans Database > Webhooks
-- 2. Créer un nouveau webhook:
--    - Name: refresh-search-views
--    - Table: interventions (puis créer un webhook par table)
--    - Events: INSERT, UPDATE, DELETE
--    - HTTP Request: POST
--    - URL: https://<project-ref>.supabase.co/functions/v1/refresh-search-views
--    - HTTP Headers:
--        Authorization: Bearer <anon-key>
-- 3. Répéter pour: intervention_artisans, comments, agencies, tenants, owner, artisans, artisan_metiers, artisan_zones
--
-- Alternative: Utiliser Supabase Realtime côté client (voir docs)
-- ========================================
