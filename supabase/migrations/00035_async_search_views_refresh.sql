-- ========================================
-- GMBS CRM - Rafraîchissement ASYNCHRONE des Vues Matérialisées
-- ========================================
-- Date: 2025-12-19
-- Description: Corrige le problème de timeout en remplaçant les triggers
--              synchrones par une approche asynchrone avec pg_cron
-- Problème: Les triggers de 00033 font REFRESH MATERIALIZED VIEW directement,
--           ce qui peut prendre plusieurs secondes et causer des timeouts
-- Solution: Utiliser pg_cron pour rafraîchir les vues périodiquement
-- ========================================

-- ========================================
-- 1️⃣ DÉSACTIVER LES TRIGGERS SYNCHRONES PROBLÉMATIQUES
-- ========================================

-- Supprimer les triggers qui causent les timeouts
DROP TRIGGER IF EXISTS trigger_interventions_search_refresh ON public.interventions;
DROP TRIGGER IF EXISTS trigger_intervention_artisans_search_refresh ON public.intervention_artisans;
DROP TRIGGER IF EXISTS trigger_comments_search_refresh ON public.comments;
DROP TRIGGER IF EXISTS trigger_agencies_search_refresh ON public.agencies;
DROP TRIGGER IF EXISTS trigger_tenants_search_refresh ON public.tenants;
DROP TRIGGER IF EXISTS trigger_artisans_interventions_search_refresh ON public.artisans;
DROP TRIGGER IF EXISTS trigger_artisans_artisans_search_refresh ON public.artisans;
DROP TRIGGER IF EXISTS trigger_artisan_metiers_search_refresh ON public.artisan_metiers;
DROP TRIGGER IF EXISTS trigger_artisan_zones_search_refresh ON public.artisan_zones;

-- Supprimer les anciennes fonctions de trigger synchrones
DROP FUNCTION IF EXISTS refresh_interventions_search_trigger() CASCADE;
DROP FUNCTION IF EXISTS refresh_artisans_search_trigger() CASCADE;

-- ========================================
-- 2️⃣ CRÉER UNE TABLE DE FLAG POUR MARQUER LES VUES À RAFRAÎCHIR
-- ========================================

CREATE TABLE IF NOT EXISTS public.search_views_refresh_flags (
  id text PRIMARY KEY,
  needs_refresh boolean DEFAULT false,
  last_refresh timestamptz,
  last_flag_set timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Insérer les flags initiaux
INSERT INTO public.search_views_refresh_flags (id, needs_refresh, last_refresh)
VALUES 
  ('interventions_search_mv', false, now()),
  ('artisans_search_mv', false, now()),
  ('global_search_mv', false, now())
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 3️⃣ CRÉER DES FONCTIONS DE TRIGGER LÉGÈRES (juste un flag)
-- ========================================

-- Fonction légère qui marque juste le flag (ne fait PAS le refresh)
CREATE OR REPLACE FUNCTION flag_interventions_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.search_views_refresh_flags 
  SET needs_refresh = true, last_flag_set = now()
  WHERE id IN ('interventions_search_mv', 'global_search_mv');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION flag_artisans_search_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.search_views_refresh_flags 
  SET needs_refresh = true, last_flag_set = now()
  WHERE id IN ('artisans_search_mv', 'global_search_mv');
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION flag_interventions_search_refresh() IS
'Trigger léger qui marque le flag needs_refresh=true. Le refresh réel est fait par pg_cron.';

COMMENT ON FUNCTION flag_artisans_search_refresh() IS
'Trigger léger qui marque le flag needs_refresh=true. Le refresh réel est fait par pg_cron.';

-- ========================================
-- 4️⃣ RECRÉER LES TRIGGERS AVEC LES FONCTIONS LÉGÈRES
-- ========================================

-- Triggers sur INTERVENTIONS
CREATE TRIGGER trigger_interventions_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.interventions
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_interventions_search_refresh();

-- Triggers sur INTERVENTION_ARTISANS
CREATE TRIGGER trigger_intervention_artisans_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_interventions_search_refresh();

-- Triggers sur COMMENTS
CREATE TRIGGER trigger_comments_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_interventions_search_refresh();

-- Triggers sur AGENCIES
CREATE TRIGGER trigger_agencies_search_flag
  AFTER INSERT OR UPDATE ON public.agencies
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_interventions_search_refresh();

-- Triggers sur TENANTS
CREATE TRIGGER trigger_tenants_search_flag
  AFTER INSERT OR UPDATE ON public.tenants
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_interventions_search_refresh();

-- Triggers sur ARTISANS (pour interventions ET artisans)
CREATE TRIGGER trigger_artisans_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_artisans_search_refresh();

-- Note: Un seul trigger sur artisans qui flag les deux vues

-- Triggers sur ARTISAN_METIERS
CREATE TRIGGER trigger_artisan_metiers_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_metiers
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_artisans_search_refresh();

-- Triggers sur ARTISAN_ZONES
CREATE TRIGGER trigger_artisan_zones_search_flag
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_zones
  FOR EACH STATEMENT
  EXECUTE FUNCTION flag_artisans_search_refresh();

-- ========================================
-- 5️⃣ FONCTION DE REFRESH CONDITIONNEL (appelée par pg_cron)
-- ========================================

CREATE OR REPLACE FUNCTION refresh_search_views_if_needed()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_interventions_needs_refresh boolean;
  v_artisans_needs_refresh boolean;
BEGIN
  -- Vérifier quelles vues ont besoin d'être rafraîchies
  SELECT needs_refresh INTO v_interventions_needs_refresh
  FROM public.search_views_refresh_flags
  WHERE id = 'interventions_search_mv';
  
  SELECT needs_refresh INTO v_artisans_needs_refresh
  FROM public.search_views_refresh_flags
  WHERE id = 'artisans_search_mv';
  
  -- Rafraîchir interventions si nécessaire
  IF v_interventions_needs_refresh THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
    UPDATE public.search_views_refresh_flags 
    SET needs_refresh = false, last_refresh = now()
    WHERE id = 'interventions_search_mv';
  END IF;
  
  -- Rafraîchir artisans si nécessaire
  IF v_artisans_needs_refresh THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
    UPDATE public.search_views_refresh_flags 
    SET needs_refresh = false, last_refresh = now()
    WHERE id = 'artisans_search_mv';
  END IF;
  
  -- Rafraîchir global si l'une des deux vues a été rafraîchie
  IF v_interventions_needs_refresh OR v_artisans_needs_refresh THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
    UPDATE public.search_views_refresh_flags 
    SET needs_refresh = false, last_refresh = now()
    WHERE id = 'global_search_mv';
  END IF;
END;
$$;

COMMENT ON FUNCTION refresh_search_views_if_needed() IS
'Rafraîchit les vues matérialisées uniquement si elles ont été marquées comme nécessitant un refresh.
Appelée par pg_cron toutes les 30 secondes.';

-- ========================================
-- 6️⃣ CONFIGURER pg_cron POUR LE REFRESH PÉRIODIQUE
-- ========================================

-- Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supprimer l'ancien job s'il existe
SELECT cron.unschedule('refresh_search_views')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_search_views');

-- Créer le job qui s'exécute toutes les 30 secondes
-- Note: pg_cron ne supporte pas les intervalles < 1 minute, donc on utilise 1 minute
SELECT cron.schedule(
  'refresh_search_views',
  '* * * * *',  -- Toutes les minutes
  $$SELECT refresh_search_views_if_needed()$$
);

-- ========================================
-- 7️⃣ RAFRAÎCHISSEMENT INITIAL
-- ========================================

-- Faire un refresh initial pour s'assurer que tout est à jour
SELECT refresh_search_views_if_needed();

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================
-- Les vues matérialisées sont maintenant rafraîchies de manière ASYNCHRONE:
-- 1. Quand une table est modifiée, un trigger léger met le flag needs_refresh=true
-- 2. pg_cron vérifie toutes les minutes si un refresh est nécessaire
-- 3. Si oui, il fait le refresh de manière concurrente
--
-- Avantages:
-- - Plus de timeout sur les INSERT/UPDATE/DELETE
-- - Refresh intelligent (seulement si nécessaire)
-- - Pas de blocage des opérations utilisateur
--
-- Inconvénient:
-- - Délai max de ~1 minute avant que les nouvelles données soient dans la recherche

