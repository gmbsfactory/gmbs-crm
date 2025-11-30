-- ========================================
-- Data Fixes Migration
-- ========================================
-- Ce fichier contient des corrections de données à exécuter une fois

-- ========================================
-- FIX: Montants de coûts aberrants >= 100,000
-- ========================================
-- Les montants SST, intervention ET materiel >= 100 000 sont mis à 0
-- (probablement des erreurs d'import)

DO $$
DECLARE
    sst_count INTEGER;
    intervention_count INTEGER;
    materiel_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO sst_count FROM public.intervention_costs
    WHERE cost_type = 'sst' AND ABS(amount) >= 100000;
    
    SELECT COUNT(*) INTO intervention_count FROM public.intervention_costs
    WHERE cost_type = 'intervention' AND ABS(amount) >= 100000;
    
    SELECT COUNT(*) INTO materiel_count FROM public.intervention_costs
    WHERE cost_type = 'materiel' AND ABS(amount) >= 100000;
    
    IF sst_count > 0 OR intervention_count > 0 OR materiel_count > 0 THEN
        RAISE NOTICE '=== CORRECTION DES MONTANTS >= 100 000 ===';
        RAISE NOTICE 'SST: % lignes, Intervention: % lignes, Materiel: % lignes', sst_count, intervention_count, materiel_count;
    END IF;
END $$;

-- Mettre à jour les coûts SST avec amount >= 100000
UPDATE public.intervention_costs
SET amount = 0, updated_at = now()
WHERE cost_type = 'sst' AND ABS(amount) >= 100000;

-- Mettre à jour les coûts intervention avec amount >= 100000
UPDATE public.intervention_costs
SET amount = 0, updated_at = now()
WHERE cost_type = 'intervention' AND ABS(amount) >= 100000;

-- Mettre à jour les coûts materiel avec amount >= 100000
UPDATE public.intervention_costs
SET amount = 0, updated_at = now()
WHERE cost_type = 'materiel' AND ABS(amount) >= 100000;

-- Vérification finale
DO $$
DECLARE
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count
    FROM public.intervention_costs
    WHERE cost_type IN ('sst', 'intervention', 'materiel') AND ABS(amount) >= 100000;
    
    IF total_count = 0 THEN
        RAISE NOTICE '✅ Data fix appliqué : aucun montant aberrant >= 100 000';
    ELSE
        RAISE WARNING '⚠️ Attention : il reste % montants >= 100 000', total_count;
    END IF;
END $$;

