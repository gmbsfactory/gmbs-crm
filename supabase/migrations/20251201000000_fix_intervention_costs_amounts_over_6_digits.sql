-- Migration pour corriger les montants de coûts SST et intervention qui dépassent 6 chiffres (>= 100 000)
-- Tous les montants >= 100 000 seront mis à 0 pour les types 'sst' et 'intervention'

-- Afficher les statistiques avant la mise à jour
DO $$
DECLARE
    sst_count INTEGER;
    intervention_count INTEGER;
    sst_total_amount NUMERIC;
    intervention_total_amount NUMERIC;
BEGIN
    -- Compter les coûts SST avec amount >= 100000
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO sst_count, sst_total_amount
    FROM public.intervention_costs
    WHERE cost_type = 'sst' AND ABS(amount) >= 100000;
    
    -- Compter les coûts intervention avec amount >= 100000
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO intervention_count, intervention_total_amount
    FROM public.intervention_costs
    WHERE cost_type = 'intervention' AND ABS(amount) >= 100000;
    
    RAISE NOTICE '=== AVANT LA MIGRATION ===';
    RAISE NOTICE 'Coûts SST >= 100 000: % lignes, montant total: % EUR', sst_count, sst_total_amount;
    RAISE NOTICE 'Coûts intervention >= 100 000: % lignes, montant total: % EUR', intervention_count, intervention_total_amount;
END $$;

-- Mettre à jour les coûts SST avec amount >= 100000
UPDATE public.intervention_costs
SET 
    amount = 0,
    updated_at = now()
WHERE cost_type = 'sst' 
  AND ABS(amount) >= 100000;

-- Mettre à jour les coûts intervention avec amount >= 100000
UPDATE public.intervention_costs
SET 
    amount = 0,
    updated_at = now()
WHERE cost_type = 'intervention' 
  AND ABS(amount) >= 100000;

-- Afficher les statistiques après la mise à jour
DO $$
DECLARE
    sst_count INTEGER;
    intervention_count INTEGER;
BEGIN
    -- Compter les coûts SST avec amount >= 100000 (devrait être 0)
    SELECT COUNT(*)
    INTO sst_count
    FROM public.intervention_costs
    WHERE cost_type = 'sst' AND ABS(amount) >= 100000;
    
    -- Compter les coûts intervention avec amount >= 100000 (devrait être 0)
    SELECT COUNT(*)
    INTO intervention_count
    FROM public.intervention_costs
    WHERE cost_type = 'intervention' AND ABS(amount) >= 100000;
    
    RAISE NOTICE '=== APRÈS LA MIGRATION ===';
    RAISE NOTICE 'Coûts SST >= 100 000 restants: % lignes', sst_count;
    RAISE NOTICE 'Coûts intervention >= 100 000 restants: % lignes', intervention_count;
    
    IF sst_count = 0 AND intervention_count = 0 THEN
        RAISE NOTICE '✅ Migration réussie : tous les montants >= 100 000 ont été mis à 0';
    ELSE
        RAISE WARNING '⚠️ Attention : il reste encore des montants >= 100 000';
    END IF;
END $$;

-- Commentaire pour documenter la migration
COMMENT ON TABLE public.intervention_costs IS 
'Table des coûts d''intervention. Les montants >= 100 000 pour les types sst et intervention sont automatiquement mis à 0 lors de l''import (voir data-mapper.js).';
