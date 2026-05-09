-- ============================================================================
-- Pre-deploy STEP 1/2 : Hybrid Search — colonnes générées
-- ============================================================================
--
-- Ce script ajoute les colonnes `search_vector` GENERATED sur `interventions`
-- et `artisans`. Il peut tourner dans une transaction (compatible Supabase
-- SQL editor, psql -f, etc.).
--
-- ⚠️  COÛT : ALTER TABLE ... ADD COLUMN ... GENERATED ALWAYS STORED réécrit
-- toute la table sous lock ACCESS EXCLUSIVE. À faire HORS pic de trafic.
--
-- Idempotent grâce aux IF NOT EXISTS.
--
-- ÉTAPE SUIVANTE : exécuter `prod_deploy_search_indexes_concurrent.sql`
-- (à lancer en mode autocommit, pas en transaction).
-- ============================================================================

-- 0. Wrapper IMMUTABLE pour unaccent() (requis par les colonnes GENERATED)
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $func$
  SELECT unaccent('unaccent', $1)
$func$;

-- 1. Colonne search_vector sur interventions
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', f_unaccent(coalesce(id_inter, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(reference_agence, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(contexte_intervention, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(commentaire_agent, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(code_postal, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_second_artisan, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(key_code, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(floor, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(apartment_number, ''))), 'D')
  ) STORED;

-- 2. Colonne search_vector sur artisans
ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', f_unaccent(coalesce(numero_associe, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(siret, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(
      coalesce(prenom, '') || ' ' || coalesce(nom, '')
    )), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(plain_nom, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(raison_sociale, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone2, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_siege_social, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_siege_social, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_intervention, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(statut_juridique, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(suivi_relances_docs, ''))), 'D')
  ) STORED;
