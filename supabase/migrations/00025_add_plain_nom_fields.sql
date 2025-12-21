-- Migration: Ajouter plain_nom_facturation et plain_nom_client
-- Objectif: Fusionner les champs nom/prénom en un seul champ pour simplifier l'UI

-- 1. Ajouter la colonne plain_nom_facturation à la table owner
ALTER TABLE public.owner
ADD COLUMN IF NOT EXISTS plain_nom_facturation text;

-- 2. Ajouter la colonne plain_nom_client à la table tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS plain_nom_client text;

-- 3. Migrer les données existantes pour owner
UPDATE public.owner
SET plain_nom_facturation = NULLIF(TRIM(COALESCE(owner_lastname, '') || ' ' || COALESCE(owner_firstname, '')), '')
WHERE plain_nom_facturation IS NULL 
  AND (owner_lastname IS NOT NULL OR owner_firstname IS NOT NULL);

-- 4. Migrer les données existantes pour tenants
UPDATE public.tenants
SET plain_nom_client = NULLIF(TRIM(COALESCE(lastname, '') || ' ' || COALESCE(firstname, '')), '')
WHERE plain_nom_client IS NULL 
  AND (lastname IS NOT NULL OR firstname IS NOT NULL);

-- 5. Créer des index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_owner_plain_nom_facturation ON public.owner(plain_nom_facturation);
CREATE INDEX IF NOT EXISTS idx_tenants_plain_nom_client ON public.tenants(plain_nom_client);

COMMENT ON COLUMN public.owner.plain_nom_facturation IS 'Nom complet fusionné pour la facturation (nom + prénom)';
COMMENT ON COLUMN public.tenants.plain_nom_client IS 'Nom complet fusionné du client (nom + prénom)';








