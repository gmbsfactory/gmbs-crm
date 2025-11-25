-- Migration pour s'assurer que les colonnes latitude et longitude existent dans la table interventions
-- Ces colonnes devraient déjà exister selon le schéma initial, mais cette migration garantit leur présence

-- Vérifier et ajouter la colonne latitude si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'interventions' 
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE public.interventions 
        ADD COLUMN latitude numeric(9,6);
        
        RAISE NOTICE 'Colonne latitude ajoutée à la table interventions';
    ELSE
        RAISE NOTICE 'Colonne latitude existe déjà dans la table interventions';
    END IF;
END $$;

-- Vérifier et ajouter la colonne longitude si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'interventions' 
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE public.interventions 
        ADD COLUMN longitude numeric(9,6);
        
        RAISE NOTICE 'Colonne longitude ajoutée à la table interventions';
    ELSE
        RAISE NOTICE 'Colonne longitude existe déjà dans la table interventions';
    END IF;
END $$;

-- Ajouter un index pour améliorer les performances des requêtes géographiques
CREATE INDEX IF NOT EXISTS idx_interventions_location 
ON public.interventions(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN public.interventions.latitude IS 'Latitude de l''adresse de l''intervention (coordonnées géographiques)';
COMMENT ON COLUMN public.interventions.longitude IS 'Longitude de l''adresse de l''intervention (coordonnées géographiques)';




