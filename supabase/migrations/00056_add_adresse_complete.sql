-- Migration: Ajouter la colonne adresse_complete à la table interventions
-- Date: 2026-01-04
-- Description: Permet de stocker l'adresse complète retournée par le géocodage,
--              indépendamment du champ adresse (adresse partielle saisie par l'utilisateur)

-- Ajouter la colonne adresse_complete
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS adresse_complete text;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.interventions.adresse_complete IS 'Adresse complète retournée par le service de géocodage (ex: "123 Rue de Rivoli, 75001 Paris, France"). Ce champ est indépendant du champ adresse qui contient l''adresse partielle saisie par l''utilisateur.';

-- Initialiser les valeurs existantes en concaténant les champs existants
UPDATE public.interventions
SET adresse_complete = NULLIF(TRIM(CONCAT_WS(', ',
  NULLIF(adresse, ''),
  NULLIF(code_postal, ''),
  NULLIF(ville, '')
)), '')
WHERE adresse_complete IS NULL;
