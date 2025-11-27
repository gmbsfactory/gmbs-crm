-- ========================================
-- MIGRATION OBSOLÈTE - Remplacée par 00016_optimize_interventions_ca_cache.sql
-- ========================================
-- Cette migration créait des triggers de rafraîchissement synchrone de la vue matérialisée
-- qui étaient très lents (O(n) pour chaque modification de coût).
-- 
-- La migration 00016 remplace cette approche par une table de cache avec mise à jour
-- incrémentale (O(1) - ultra-rapide).
--
-- Cette migration est conservée vide pour la compatibilité avec les environnements
-- qui l'ont déjà exécutée.
-- ========================================

-- Nettoyage des anciens triggers (au cas où cette migration est exécutée)
DROP TRIGGER IF EXISTS trg_refresh_ca_on_cost_insert ON public.intervention_costs;
DROP TRIGGER IF EXISTS trg_refresh_ca_on_cost_update ON public.intervention_costs;
DROP TRIGGER IF EXISTS trg_refresh_ca_on_cost_delete ON public.intervention_costs;

-- La fonction refresh_interventions_ca sera supprimée par la migration 00016

