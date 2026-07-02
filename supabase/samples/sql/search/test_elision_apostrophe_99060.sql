-- ============================================================================
-- Test de non-régression — migration 99060 (élision / apostrophe + repli ILIKE)
-- ============================================================================
-- Reproduit le bug réel (intervention id 21290, adresse
-- « BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L'ETOILE 74 RUE D'ANJOU 44600 ST
-- NAZAIRE ») : la barre de recherche du haut (search_global) ne trouvait plus
-- l'adresse dès qu'on tapait au-delà de l'article élidé (« ...DE L'ET »).
--
-- AUTO-PORTÉ : crée des tables-stub minimales, ne dépend PAS du schéma réel.
-- À lancer sur un Postgres jetable :
--   initdb ... && pg_ctl start ...
--   psql -f supabase/migrations/99060_search_fix_elision_apostrophe_and_address_ilike.sql  -- (après ce fichier, cf. plus bas)
--
-- Ordre d'exécution :
--   1) psql -f test_elision_apostrophe_99060.sql          (ce fichier : stubs + seed)
--   2) psql -f ../../migrations/99060_search_fix_elision_apostrophe_and_address_ilike.sql
--   3) ré-exécuter la SECTION ASSERTIONS ci-dessous (ou copier/coller)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET client_min_messages = warning;

-- ===== Stubs (colonnes réellement lues par les fonctions) =====
DROP TABLE IF EXISTS public.search_views_refresh_flags, public.interventions,
  public.artisans, public.global_search_mv, public.interventions_search_mv CASCADE;

CREATE TABLE public.search_views_refresh_flags(id text primary key, last_refresh timestamptz);
INSERT INTO public.search_views_refresh_flags VALUES ('global_search_mv', '2025-01-01'::timestamptz);

CREATE TABLE public.interventions(
  id uuid primary key, id_inter text, is_active boolean, updated_at timestamptz,
  adresse text, ville text, code_postal text, contexte_intervention text,
  date date, search_vector tsvector);
CREATE TABLE public.artisans(
  id uuid primary key, numero_associe text, plain_nom text, raison_sociale text,
  email text, telephone text, ville_intervention text,
  is_active boolean, updated_at timestamptz, search_vector tsvector);
CREATE TABLE public.global_search_mv(
  entity_type text, entity_id uuid, search_vector tsvector, metadata jsonb,
  created_at timestamptz, updated_at timestamptz);
CREATE TABLE public.interventions_search_mv(
  id uuid, id_inter text, contexte_intervention text, adresse text, ville text,
  agence_label text, artisan_plain_nom text, statut_label text, statut_color text,
  date_formatted text, tenant_firstname text, tenant_lastname text, date date,
  search_vector tsvector);

-- ===== Seed : l'intervention litigieuse (adresse EXACTE du client) =====
\set uid '11111111-1111-1111-1111-111111111111'
\set adr 'BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ETOILE 74 RUE D''ANJOU'

INSERT INTO public.interventions(id,id_inter,is_active,updated_at,adresse,ville,code_postal,contexte_intervention,date,search_vector)
VALUES (:'uid','INT-21290',true,'2024-06-01'::timestamptz,:'adr','ST NAZAIRE','44600','Fuite salle de bain','2024-06-01',
  setweight(to_tsvector('french',unaccent('INT-21290')),'A') ||
  setweight(to_tsvector('french',unaccent('Fuite salle de bain')),'B') ||
  setweight(to_tsvector('french',unaccent(:'adr')),'C') ||
  setweight(to_tsvector('french',unaccent('ST NAZAIRE')),'C') ||
  setweight(to_tsvector('french',unaccent('44600')),'C'));

INSERT INTO public.global_search_mv(entity_type,entity_id,search_vector,metadata,created_at,updated_at)
SELECT 'intervention', id, search_vector,
  jsonb_build_object('id_inter',id_inter,'contexte',contexte_intervention,'adresse',adresse,'ville',ville,'agence','Agence X'),
  updated_at, updated_at
FROM public.interventions WHERE id = :'uid';

INSERT INTO public.interventions_search_mv(id,id_inter,contexte_intervention,adresse,ville,agence_label,statut_label,statut_color,date_formatted,date,search_vector)
SELECT id,id_inter,contexte_intervention,adresse,ville,'Agence X','En cours','#000','01/06/2024',date,search_vector
FROM public.interventions WHERE id = :'uid';

-- ============================================================================
-- SECTION ASSERTIONS (à ré-exécuter APRÈS avoir chargé la migration 99060)
-- ============================================================================
-- Attendu : chaque cas ci-dessous renvoie 1 (trouvé), sauf le "bruit" = 0.
--
-- SELECT
--   (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''E',20,0,null)   WHERE entity_id='11111111-1111-1111-1111-111111111111') AS a_le,
--   (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ET',20,0,null)  WHERE entity_id='11111111-1111-1111-1111-111111111111') AS b_let,
--   (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ETOILE 74 RUE D''ANJOU 44600 ST NAZAIRE',20,0,null) WHERE entity_id='11111111-1111-1111-1111-111111111111') AS c_full,
--   (SELECT count(*) FROM search_global('ETOILE',20,0,null) WHERE entity_id='11111111-1111-1111-1111-111111111111') AS d_etoile,
--   (SELECT count(*) FROM search_global('PLOMBERIE ZORGLUB',20,0,null)) AS noise_zero;
--
-- Assertion dure (échoue si un cas casse) :
DO $$
DECLARE uid uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  IF to_regprocedure('search_global(text,int,int,text)') IS NULL THEN
    RAISE NOTICE 'Migration 99060 non chargée — chargez-la puis relancez ce bloc.';
    RETURN;
  END IF;
  IF (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ET',20,0,null) WHERE entity_id=uid) < 1
    THEN RAISE EXCEPTION 'ECHEC: "...L''ET" introuvable dans search_global'; END IF;
  IF (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ETOILE 74 RUE D''ANJOU 44600 ST NAZAIRE',20,0,null) WHERE entity_id=uid) < 1
    THEN RAISE EXCEPTION 'ECHEC: adresse complète introuvable dans search_global'; END IF;
  IF (SELECT count(*) FROM search_global('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''E',20,0,null) WHERE entity_id=uid) < 1
    THEN RAISE EXCEPTION 'REGRESSION: "...L''E" ne matche plus'; END IF;
  IF (SELECT count(*) FROM search_interventions('BATIMENT 2 - APPT 225 -2ND RESIDENCE DE L''ET',20,0) WHERE id=uid) < 1
    THEN RAISE EXCEPTION 'ECHEC: "...L''ET" introuvable dans search_interventions'; END IF;
  RAISE NOTICE 'OK — toutes les assertions 99060 passent.';
END $$;
