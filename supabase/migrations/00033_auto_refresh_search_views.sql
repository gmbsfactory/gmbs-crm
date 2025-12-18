-- ========================================
-- GMBS CRM - Rafraîchissement Automatique des Vues Matérialisées
-- ========================================
-- Date: 2025-12-18
-- Description: Modifie les triggers pour rafraîchir DIRECTEMENT les vues
--              matérialisées au lieu d'utiliser pg_notify qui nécessite un worker
-- ========================================

-- ========================================
-- 1️⃣ REMPLACER LES FONCTIONS DE TRIGGER
-- ========================================

-- Fonction pour rafraîchir automatiquement la vue interventions
CREATE OR REPLACE FUNCTION refresh_interventions_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rafraîchir de manière CONCURRENTE (non-bloquant pour les lectures)
  REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
  -- Rafraîchir aussi la vue globale car elle dépend de interventions_search_mv
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION refresh_interventions_search_trigger() IS
'Fonction trigger qui rafraîchit DIRECTEMENT et automatiquement interventions_search_mv et global_search_mv.
Le refresh est CONCURRENT pour ne pas bloquer les lectures.
Appelée automatiquement par les triggers sur interventions, comments, intervention_artisans, etc.';

-- Fonction pour rafraîchir automatiquement la vue artisans
CREATE OR REPLACE FUNCTION refresh_artisans_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Rafraîchir de manière CONCURRENTE (non-bloquant pour les lectures)
  REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
  -- Rafraîchir aussi la vue globale car elle dépend de artisans_search_mv
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION refresh_artisans_search_trigger() IS
'Fonction trigger qui rafraîchit DIRECTEMENT et automatiquement artisans_search_mv et global_search_mv.
Le refresh est CONCURRENT pour ne pas bloquer les lectures.
Appelée automatiquement par les triggers sur artisans, artisan_metiers, artisan_zones, etc.';


-- ========================================
-- 2️⃣ RECRÉER LES TRIGGERS AVEC LES NOUVELLES FONCTIONS
-- ========================================

-- Triggers sur la table INTERVENTIONS
DROP TRIGGER IF EXISTS trigger_interventions_search_refresh ON public.interventions;
CREATE TRIGGER trigger_interventions_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.interventions
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- Triggers sur la table INTERVENTION_ARTISANS
DROP TRIGGER IF EXISTS trigger_intervention_artisans_search_refresh ON public.intervention_artisans;
CREATE TRIGGER trigger_intervention_artisans_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- ⭐ Triggers sur la table COMMENTS (CRITIQUE pour la recherche dans les commentaires!)
DROP TRIGGER IF EXISTS trigger_comments_search_refresh ON public.comments;
CREATE TRIGGER trigger_comments_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- Triggers sur la table AGENCIES
DROP TRIGGER IF EXISTS trigger_agencies_search_refresh ON public.agencies;
CREATE TRIGGER trigger_agencies_search_refresh
  AFTER INSERT OR UPDATE ON public.agencies
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- Triggers sur la table TENANTS
DROP TRIGGER IF EXISTS trigger_tenants_search_refresh ON public.tenants;
CREATE TRIGGER trigger_tenants_search_refresh
  AFTER INSERT OR UPDATE ON public.tenants
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- Triggers sur la table ARTISANS (pour interventions)
DROP TRIGGER IF EXISTS trigger_artisans_interventions_search_refresh ON public.artisans;
CREATE TRIGGER trigger_artisans_interventions_search_refresh
  AFTER INSERT OR UPDATE ON public.artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_interventions_search_trigger();

-- Triggers sur la table ARTISANS (pour artisans)
DROP TRIGGER IF EXISTS trigger_artisans_artisans_search_refresh ON public.artisans;
CREATE TRIGGER trigger_artisans_artisans_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisans
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artisans_search_trigger();

-- Triggers sur ARTISAN_METIERS
DROP TRIGGER IF EXISTS trigger_artisan_metiers_search_refresh ON public.artisan_metiers;
CREATE TRIGGER trigger_artisan_metiers_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_metiers
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artisans_search_trigger();

-- Triggers sur ARTISAN_ZONES
DROP TRIGGER IF EXISTS trigger_artisan_zones_search_refresh ON public.artisan_zones;
CREATE TRIGGER trigger_artisan_zones_search_refresh
  AFTER INSERT OR UPDATE OR DELETE ON public.artisan_zones
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_artisans_search_trigger();


-- ========================================
-- 3️⃣ SUPPRIMER LES ANCIENNES FONCTIONS pg_notify
-- ========================================

-- Ces fonctions ne sont plus nécessaires car on rafraîchit directement
DROP FUNCTION IF EXISTS notify_interventions_search_refresh();
DROP FUNCTION IF EXISTS notify_artisans_search_refresh();


-- ========================================
-- 4️⃣ RAFRAÎCHISSEMENT INITIAL
-- ========================================

-- Rafraîchir toutes les vues pour s'assurer qu'elles sont à jour
REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;


-- ========================================
-- FIN DE LA MIGRATION
-- ========================================
-- Les vues matérialisées se rafraîchissent maintenant AUTOMATIQUEMENT
-- quand vous ajoutez/modifiez/supprimez:
--   - Des interventions
--   - Des commentaires ⭐
--   - Des artisans
--   - Des relations intervention_artisans
--   - Etc.
--
-- Le rafraîchissement est CONCURRENT, donc il ne bloque pas les lectures.
--
-- IMPORTANT: Chaque modification déclenche un refresh complet de la vue.
-- Si vous avez beaucoup d'écritures simultanées, cela peut impacter les performances.
-- Dans ce cas, considérez plutôt un cron job qui rafraîchit toutes les X minutes.
