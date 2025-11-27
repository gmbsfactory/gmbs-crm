-- Migration: Mise à jour des kinds de documents pour interventions et artisans
-- Date: 2025-01-15
-- Description: 
--   - Ajout des nouveaux kinds: 'autre' et 'a_classe' pour interventions
--   - Mise à jour des kinds pour artisans: ajout de 'photo_profil' et 'a_classe'
--   - Retrait des kinds obsolètes
--   - Migration de 'a classifier' (avec espace) vers 'a_classe' (avec underscore)

-- ========================================
-- 1. INTERVENTIONS - Mise à jour contrainte CHECK
-- ========================================

-- Vérifier que la table existe avant de la modifier
DO $$ 
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervention_attachments') THEN
    -- Trouver et supprimer l'ancienne contrainte
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'intervention_attachments'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'kind'
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
      EXECUTE 'ALTER TABLE public.intervention_attachments DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;

    -- Ajouter la nouvelle contrainte avec les kinds mis à jour
    ALTER TABLE public.intervention_attachments 
    ADD CONSTRAINT intervention_attachments_kind_check 
    CHECK (kind IN (
      'devis',
      'photos',
      'facturesGMBS',
      'facturesArtisans',
      'facturesMateriel',
      'autre',
      'a_classe'
    ));

    -- Commentaire sur la contrainte
    COMMENT ON CONSTRAINT intervention_attachments_kind_check ON public.intervention_attachments 
    IS 'Contraint les kinds de documents pour les interventions. Nouveaux kinds: autre, a_classe. Format factures avec s.';
  END IF;
END $$;

-- ========================================
-- 2. ARTISANS - Ajout contrainte CHECK (optionnel mais recommandé)
-- ========================================

-- Vérifier que la table existe avant de la modifier
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artisan_attachments') THEN
-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.artisan_attachments 
DROP CONSTRAINT IF EXISTS artisan_attachments_kind_check;

-- Ajouter la nouvelle contrainte avec les kinds mis à jour
ALTER TABLE public.artisan_attachments 
ADD CONSTRAINT artisan_attachments_kind_check 
CHECK (kind IN (
  'kbis',
  'assurance',
  'cni_recto_verso',
  'iban',
  'decharge_partenariat',
  'photo_profil',
  'autre',
  'a_classe'
));

-- Commentaire sur la contrainte
COMMENT ON CONSTRAINT artisan_attachments_kind_check ON public.artisan_attachments 
IS 'Contraint les kinds de documents pour les artisans. Nouveaux kinds: photo_profil, a_classe.';
  END IF;
END $$;

-- ========================================
-- 3. Migration des données existantes (si nécessaire)
-- ========================================

-- Migrer les anciens kinds d'interventions vers les nouveaux formats
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'intervention_attachments') THEN
    -- Migrer 'a classifier' (avec espace) vers 'a_classe' (avec underscore)
    UPDATE public.intervention_attachments 
    SET kind = 'a_classe' 
    WHERE kind = 'a classifier';

    -- factureGMBS -> facturesGMBS
    UPDATE public.intervention_attachments 
    SET kind = 'facturesGMBS' 
    WHERE kind = 'factureGMBS';

    -- factureArtisan -> facturesArtisans
    UPDATE public.intervention_attachments 
    SET kind = 'facturesArtisans' 
    WHERE kind = 'factureArtisan';

    -- factureMateriel -> facturesMateriel
    UPDATE public.intervention_attachments 
    SET kind = 'facturesMateriel' 
    WHERE kind = 'factureMateriel';

    -- Migrer les anciens kinds obsolètes vers 'autre' ou 'a_classe'
    -- intervention -> autre (ou a_classe selon contexte)
    UPDATE public.intervention_attachments 
    SET kind = 'autre' 
    WHERE kind = 'intervention';

    -- cout -> autre
    UPDATE public.intervention_attachments 
    SET kind = 'autre' 
    WHERE kind = 'cout';

    -- rapport_intervention -> autre
    UPDATE public.intervention_attachments 
    SET kind = 'autre' 
    WHERE kind = 'rapport_intervention';

    -- plan -> autre
    UPDATE public.intervention_attachments 
    SET kind = 'autre' 
    WHERE kind = 'plan';

    -- schema -> autre
    UPDATE public.intervention_attachments 
    SET kind = 'autre' 
    WHERE kind = 'schema';
  END IF;
END $$;

-- Pour les artisans, migrer les anciens kinds obsolètes vers 'autre'
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artisan_attachments') THEN
-- certificat -> autre
UPDATE public.artisan_attachments 
SET kind = 'autre' 
WHERE kind = 'certificat';

-- siret -> autre
UPDATE public.artisan_attachments 
SET kind = 'autre' 
WHERE kind = 'siret';

-- portfolio -> autre
UPDATE public.artisan_attachments 
SET kind = 'autre' 
WHERE kind = 'portfolio';
  END IF;
END $$;

-- ========================================
-- 4. Vérification des données migrées (commenté pour éviter les erreurs si tables vides)
-- ========================================

-- Ces requêtes peuvent être exécutées manuellement après la migration si nécessaire
-- Compter les documents par kind pour interventions
-- SELECT kind, COUNT(*) as count 
-- FROM public.intervention_attachments 
-- GROUP BY kind 
-- ORDER BY count DESC;

-- Compter les documents par kind pour artisans
-- SELECT kind, COUNT(*) as count 
-- FROM public.artisan_attachments 
-- GROUP BY kind 
-- ORDER BY count DESC;

