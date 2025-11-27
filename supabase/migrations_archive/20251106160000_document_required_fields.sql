-- Migration: Document required fields for intervention creation
-- Related: BR-INT-001 - Champs obligatoires à la création
-- Date: 2025-11-06
-- 
-- Cette migration DOCUMENTE les champs obligatoires sans ajouter de contraintes NOT NULL
-- pour éviter de casser les données existantes.
--
-- Champs obligatoires (validés en frontend et backend):
-- 1. adresse
-- 2. contexte_intervention
-- 3. metier_id
-- 4. statut_id
-- 5. agence_id

-- Ajout de commentaires sur les colonnes obligatoires
COMMENT ON COLUMN interventions.adresse IS 'Adresse de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN interventions.contexte_intervention IS 'Contexte de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN interventions.metier_id IS 'Métier/Type d''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN interventions.statut_id IS 'Statut de l''intervention (OBLIGATOIRE à la création - BR-INT-001)';
COMMENT ON COLUMN interventions.agence_id IS 'Agence cliente (OBLIGATOIRE à la création - BR-INT-001)';

-- Note: Les contraintes NOT NULL ne sont PAS ajoutées pour permettre:
-- 1. Les données existantes qui pourraient avoir des NULL
-- 2. Les imports/migrations de données
-- 3. La flexibilité dans certains contextes
--
-- La validation est implémentée au niveau applicatif (frontend + backend)

