-- Migration: Ajout du système d'ordre pour distinguer les coûts par artisan
-- artisan_order = 1 pour l'artisan principal, 2 pour le second artisan, NULL pour les coûts globaux

-- 1. Ajouter la colonne artisan_order à intervention_costs
ALTER TABLE public.intervention_costs 
ADD COLUMN IF NOT EXISTS artisan_order smallint DEFAULT 1;

-- 2. Ajouter la contrainte CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'intervention_costs_artisan_order_check'
  ) THEN
    ALTER TABLE public.intervention_costs 
    ADD CONSTRAINT intervention_costs_artisan_order_check 
    CHECK (artisan_order IS NULL OR artisan_order IN (1, 2));
  END IF;
END $$;

-- 3. Commentaire explicatif
COMMENT ON COLUMN public.intervention_costs.artisan_order 
IS 'Ordre de l''artisan: 1=principal, 2=secondaire, NULL=coût global (ex: cout_intervention)';

-- 4. Index pour les requêtes filtrées par artisan_order
CREATE INDEX IF NOT EXISTS idx_intervention_costs_artisan_order 
ON public.intervention_costs(intervention_id, artisan_order);

-- 5. Mettre à jour les coûts existants de type 'intervention' et 'marge' pour avoir artisan_order = NULL
-- (ce sont des coûts globaux, pas liés à un artisan spécifique)
UPDATE public.intervention_costs 
SET artisan_order = NULL 
WHERE cost_type IN ('intervention', 'marge');

-- 6. Supprimer les champs redondants de la table interventions (ajoutés en 00027)
-- On garde metier_second_artisan_id car c'est lié à l'artisan, pas aux coûts
ALTER TABLE public.interventions 
DROP COLUMN IF EXISTS cout_sst_second_artisan;

ALTER TABLE public.interventions 
DROP COLUMN IF EXISTS cout_materiel_second_artisan;

-- 7. Nettoyer les doublons avant de créer l'index unique
-- Garder seulement l'entrée la plus récente pour chaque combinaison (intervention_id, cost_type, artisan_order)
DELETE FROM public.intervention_costs a
USING public.intervention_costs b
WHERE a.intervention_id = b.intervention_id
  AND a.cost_type = b.cost_type
  AND a.artisan_order IS NOT DISTINCT FROM b.artisan_order
  AND a.id < b.id;

-- 8. Créer un index unique pour éviter les doublons de coûts par type/ordre
CREATE UNIQUE INDEX IF NOT EXISTS idx_intervention_costs_unique_type_order
ON public.intervention_costs(intervention_id, cost_type, artisan_order)
WHERE artisan_order IS NOT NULL;

-- 9. Créer un index unique pour les coûts globaux (artisan_order IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_intervention_costs_unique_type_global
ON public.intervention_costs(intervention_id, cost_type)
WHERE artisan_order IS NULL;

