-- ============================================================================
-- 99046 — Fusion des owners doublons (racine du bug owner_id fantôme)
-- ============================================================================
-- Avant la dédup (findOrCreateOwner), chaque sauvegarde sans téléphone recréait un
-- owner -> 151 doublons répartis sur 53 noms. 99041 a nettoyé l'audit ; ici on
-- fusionne réellement les lignes owner pour supprimer la source résiduelle.
--
-- Dry-run 2026-06-23 : 53 groupes "clean" (<=1 tél distinct = artefacts du bug),
-- 0 groupe ambigu (aucun homonyme à téléphones distincts -> aucun risque de
-- fusionner deux personnes réelles), 151 owners fusionnés, 13 interventions
-- repointées, 13 doublons portant des champs mineurs (ville/cp/nom) -> backfill
-- pour fusion SANS PERTE.
--
-- Canonical par groupe = le plus complet (tél>email>ref>adresse>nom>récent), aligné
-- avec ownersApi.findByNomFacturation (réutilisation du plus récent). Réversible :
-- non (suppression de doublons) — mais strictement borné aux groupes même-nom non
-- ambigus. Seul interventions.owner_id référence owner (1 seule FK).
-- ============================================================================

-- 1) Mapping doublon -> canonical, uniquement pour les groupes "clean"
--    (stats par nom calculées à part : COUNT(DISTINCT) interdit en fonction fenêtre)
CREATE TEMP TABLE _owner_merge AS
WITH stats AS (
  SELECT
    btrim(o.plain_nom_facturation) AS name,
    COUNT(*) AS grp_size,
    COUNT(DISTINCT NULLIF(btrim(coalesce(o.telephone, '')), '')) AS distinct_phones
  FROM public.owner o
  WHERE btrim(coalesce(o.plain_nom_facturation, '')) <> ''
  GROUP BY btrim(o.plain_nom_facturation)
),
ranked AS (
  SELECT
    o.id,
    btrim(o.plain_nom_facturation) AS name,
    ROW_NUMBER() OVER (
      PARTITION BY btrim(o.plain_nom_facturation)
      ORDER BY
        (NULLIF(btrim(coalesce(o.telephone, '')), '')       IS NOT NULL) DESC,
        (NULLIF(btrim(coalesce(o.email, '')), '')           IS NOT NULL) DESC,
        (NULLIF(btrim(coalesce(o.external_ref, '')), '')    IS NOT NULL) DESC,
        (NULLIF(btrim(coalesce(o.adresse, '')), '')         IS NOT NULL) DESC,
        (NULLIF(btrim(coalesce(o.owner_firstname, '')), '') IS NOT NULL) DESC,
        (NULLIF(btrim(coalesce(o.owner_lastname, '')), '')  IS NOT NULL) DESC,
        o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST, o.id
    ) AS rn
  FROM public.owner o
  WHERE btrim(coalesce(o.plain_nom_facturation, '')) <> ''
),
canon AS (
  SELECT name, id AS canonical_id FROM ranked WHERE rn = 1
)
SELECT r.id AS loser_id, c.canonical_id
FROM ranked r
JOIN canon c USING (name)
JOIN stats s USING (name)
WHERE s.grp_size > 1
  AND s.distinct_phones <= 1
  AND r.rn > 1;

-- 2) Visibilité dans la sortie de push
DO $$
DECLARE n_losers int; n_groups int;
BEGIN
  SELECT count(*), count(DISTINCT canonical_id) INTO n_losers, n_groups FROM _owner_merge;
  RAISE NOTICE '[99046] groupes fusionnes: %, owners doublons supprimes: %', n_groups, n_losers;
END $$;

-- 3) Backfill SANS PERTE : le canonical récupère toute donnée non vide des doublons
UPDATE public.owner c SET
  telephone       = COALESCE(NULLIF(btrim(c.telephone), ''),       b.telephone,       c.telephone),
  telephone2      = COALESCE(NULLIF(btrim(c.telephone2), ''),      b.telephone2,      c.telephone2),
  email           = COALESCE(NULLIF(btrim(c.email), ''),           b.email,           c.email),
  external_ref    = COALESCE(NULLIF(btrim(c.external_ref), ''),    b.external_ref,    c.external_ref),
  adresse         = COALESCE(NULLIF(btrim(c.adresse), ''),         b.adresse,         c.adresse),
  ville           = COALESCE(NULLIF(btrim(c.ville), ''),           b.ville,           c.ville),
  code_postal     = COALESCE(NULLIF(btrim(c.code_postal), ''),     b.code_postal,     c.code_postal),
  owner_firstname = COALESCE(NULLIF(btrim(c.owner_firstname), ''), b.owner_firstname, c.owner_firstname),
  owner_lastname  = COALESCE(NULLIF(btrim(c.owner_lastname), ''),  b.owner_lastname,  c.owner_lastname)
FROM (
  SELECT
    m.canonical_id,
    (array_remove(array_agg(NULLIF(btrim(o.telephone), '')       ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS telephone,
    (array_remove(array_agg(NULLIF(btrim(o.telephone2), '')      ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS telephone2,
    (array_remove(array_agg(NULLIF(btrim(o.email), '')           ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS email,
    (array_remove(array_agg(NULLIF(btrim(o.external_ref), '')    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS external_ref,
    (array_remove(array_agg(NULLIF(btrim(o.adresse), '')         ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS adresse,
    (array_remove(array_agg(NULLIF(btrim(o.ville), '')           ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS ville,
    (array_remove(array_agg(NULLIF(btrim(o.code_postal), '')     ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS code_postal,
    (array_remove(array_agg(NULLIF(btrim(o.owner_firstname), '') ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS owner_firstname,
    (array_remove(array_agg(NULLIF(btrim(o.owner_lastname), '')  ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST), NULL))[1] AS owner_lastname
  FROM _owner_merge m
  JOIN public.owner o ON o.id = m.loser_id
  GROUP BY m.canonical_id
) b
WHERE c.id = b.canonical_id;

-- 4) Repointer les interventions vers le canonical.
-- Triggers USER désactivés : pas de faux audit "owner changé", pas de bump updated_at.
-- La recherche est inchangée (même plain_nom_facturation), donc pas de staleness.
ALTER TABLE public.interventions DISABLE TRIGGER USER;

UPDATE public.interventions i
SET owner_id = m.canonical_id
FROM _owner_merge m
WHERE i.owner_id = m.loser_id;

ALTER TABLE public.interventions ENABLE TRIGGER USER;

-- 5) Supprimer les doublons (plus aucune intervention ne les référence)
DELETE FROM public.owner o
USING _owner_merge m
WHERE o.id = m.loser_id;

DROP TABLE _owner_merge;
