-- Migration: Add second artisan cost fields and metier to interventions table
-- These fields allow tracking costs specific to the second artisan

-- Métier du deuxième artisan (permet de filtrer les artisans par métier différent du premier)
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS metier_second_artisan_id uuid REFERENCES public.metiers(id);

-- Coût SST du deuxième artisan
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS cout_sst_second_artisan numeric(12,2) DEFAULT 0;

-- Coût matériel du deuxième artisan
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS cout_materiel_second_artisan numeric(12,2) DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN public.interventions.metier_second_artisan_id IS 'Métier/Type spécifique pour le deuxième artisan';
COMMENT ON COLUMN public.interventions.cout_sst_second_artisan IS 'Coût SST du deuxième artisan';
COMMENT ON COLUMN public.interventions.cout_materiel_second_artisan IS 'Coût matériel du deuxième artisan';

-- Note: La marge du 2ème artisan est calculée dynamiquement côté frontend
-- Formule: marge2 = (coutIntervention - (coutSST1 + coutMat1)) - (coutSST2 + coutMat2)

