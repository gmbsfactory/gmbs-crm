-- ========================================
-- Fix: Doublons dans intervention_costs
-- ========================================
-- Root cause: addCost() default artisan_order=1 pour TOUS les types,
-- tandis que upsertCostsBatch() default artisan_order=NULL pour intervention/marge.
-- Ce mismatch cree des doublons avec des artisan_order differents pour le meme cout.
-- Le trigger SUM dans intervention_costs_cache additionne tous les doublons → montants errones.
-- ========================================

BEGIN;

-- Step 1: Normaliser artisan_order pour intervention/marge
-- Ces types n'utilisent PAS artisan_order, il etait incorrectement mis a 1
-- On ne touche PAS updated_at pour preserver l'ordre chronologique (step 2 en depend)
UPDATE public.intervention_costs
SET artisan_order = NULL
WHERE cost_type IN ('intervention', 'marge')
  AND artisan_order IS NOT NULL;

-- Step 2: Supprimer les doublons (garder la ligne la plus recente)
-- Apres la normalisation, il peut y avoir plusieurs lignes avec le meme
-- (intervention_id, cost_type, artisan_order=NULL)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY intervention_id, cost_type, COALESCE(artisan_order, 0)
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.intervention_costs
)
DELETE FROM public.intervention_costs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Contrainte UNIQUE pour empecher les doublons futurs
-- COALESCE(artisan_order, 0) traite NULL comme 0 pour l'unicite
CREATE UNIQUE INDEX IF NOT EXISTS uq_intervention_costs_type_order
ON public.intervention_costs (intervention_id, cost_type, COALESCE(artisan_order, 0));

-- Step 4: Recalculer le cache des couts (les SUM etaient fausses a cause des doublons)
SELECT public.refresh_dashboard_cache();

COMMIT;
