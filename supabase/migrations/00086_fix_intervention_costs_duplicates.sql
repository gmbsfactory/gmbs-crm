-- ========================================
-- Fix: Doublons dans intervention_costs
-- ========================================
-- Root cause: addCost() default artisan_order=1 pour TOUS les types,
-- tandis que upsertCostsBatch() default artisan_order=NULL pour intervention/marge.
-- Ce mismatch cree des lignes artisan_order=1 pour intervention/marge qui
-- contournent l'index unique partiel idx_intervention_costs_unique_type_global
-- (WHERE artisan_order IS NULL) cree par la migration 00028.
-- Le trigger SUM dans intervention_costs_cache additionne tous les doublons → montants errones.
-- ========================================

BEGIN;

-- Step 1: Supprimer les doublons pour intervention/marge
-- Pour chaque (intervention_id, cost_type) de type intervention/marge,
-- garder UNE seule ligne (la plus recente), qu'elle ait artisan_order=NULL ou 1
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY intervention_id, cost_type
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.intervention_costs
  WHERE cost_type IN ('intervention', 'marge')
)
DELETE FROM public.intervention_costs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Normaliser artisan_order pour les lignes restantes intervention/marge
-- Maintenant qu'il n'y a plus de doublons, on peut mettre artisan_order a NULL
-- sans violer idx_intervention_costs_unique_type_global
UPDATE public.intervention_costs
SET artisan_order = NULL
WHERE cost_type IN ('intervention', 'marge')
  AND artisan_order IS NOT NULL;

-- Step 3: Recalculer le cache des couts (les SUM etaient fausses a cause des doublons)
SELECT public.refresh_dashboard_cache();

COMMIT;
