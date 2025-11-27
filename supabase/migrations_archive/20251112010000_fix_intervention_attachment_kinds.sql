-- Migration: Réparer les kinds autorisés pour les pièces jointes
-- Date: 2025-11-12
-- Objectif:
--   - Ré-aligner la contrainte CHECK de intervention_attachments.kind sur les valeurs attendues par l'app et par l'Edge Function
--   - Ré-aligner aussi artisan_attachments.kind (ajout de portfolio) pour éviter les 500 sur l'upload
--   - Normaliser les données existantes avant de recréer la contrainte

-- =============================
-- 1. INTERVENTIONS
-- =============================
DO $$
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'intervention_attachments'
  ) THEN
    -- Supprimer l'ancienne contrainte (peu importe son nom)
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'intervention_attachments'
      AND ccu.column_name = 'kind'
      AND tc.constraint_type = 'CHECK'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.intervention_attachments DROP CONSTRAINT %I',
        constraint_name
      );
    END IF;

    -- Normaliser les valeurs historiques avant de recréer la contrainte
    UPDATE public.intervention_attachments
    SET kind = 'facturesGMBS'
    WHERE kind IN (
      'factureGMBS', 'FactureGMBS', 'factures_gmbs', 'factures gmbs', 'facture gmbs'
    );

    UPDATE public.intervention_attachments
    SET kind = 'facturesArtisans'
    WHERE kind IN ('factureArtisan', 'FactureArtisan', 'factures_artisan');

    UPDATE public.intervention_attachments
    SET kind = 'facturesMateriel'
    WHERE kind IN ('factureMateriel', 'FactureMateriel', 'factures_materiel');

    UPDATE public.intervention_attachments
    SET kind = 'a_classe'
    WHERE kind IN (
      'a classifier', 'a classer', 'à classifier', 'à classer',
      'a_classer', 'a_classifier', 'aclasser', 'aclassifier', 'àclasser', 'àclassifier'
    );

    UPDATE public.intervention_attachments
    SET kind = 'autre'
    WHERE kind IN ('intervention', 'cout', 'rapport_intervention', 'plan', 'schema');

    -- Recréer la contrainte avec la liste complète
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

    COMMENT ON CONSTRAINT intervention_attachments_kind_check ON public.intervention_attachments
    IS 'Contrainte des types de documents intervention (devis, photos, factures*, autre, a_classe).';
  END IF;
END $$;

-- =============================
-- 2. ARTISANS
-- =============================
DO $$
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'artisan_attachments'
  ) THEN
    -- Supprimer la contrainte existante si elle est présente
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'artisan_attachments'
      AND ccu.column_name = 'kind'
      AND tc.constraint_type = 'CHECK'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.artisan_attachments DROP CONSTRAINT %I',
        constraint_name
      );
    END IF;

    -- Normaliser les anciennes valeurs
    UPDATE public.artisan_attachments
    SET kind = 'autre'
    WHERE kind IN ('certificat', 'siret');

    -- Recréer la contrainte en ajoutant "portfolio"
    ALTER TABLE public.artisan_attachments
    ADD CONSTRAINT artisan_attachments_kind_check
    CHECK (kind IN (
      'kbis',
      'assurance',
      'cni_recto_verso',
      'iban',
      'decharge_partenariat',
      'photo_profil',
      'portfolio',
      'autre',
      'a_classe'
    ));

    COMMENT ON CONSTRAINT artisan_attachments_kind_check ON public.artisan_attachments
    IS 'Contrainte des types de documents artisan (kbis, assurance, portfolio, photo_profil, etc.).';
  END IF;
END $$;
