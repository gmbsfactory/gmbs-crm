-- ============================================================================
-- DRY-RUN (LECTURE SEULE) — Faux « changements de propriétaire » dans l'audit
-- ============================================================================
-- Contexte : avant le correctif (fix/owner-phantom), chaque sauvegarde
-- d'intervention SANS téléphone propriétaire recréait un owner identique
-- (nouveau uuid) → owner_id "changeait" → ligne d'audit fantôme
-- "M. X → M. X". Le correctif applicatif (findOrCreateOwner dédupliqué par
-- plain_nom_facturation) STOPPE la création de nouveaux fantômes.
--
-- Ce fichier ne fait QUE des SELECT de comptage. Il sert à mesurer l'ampleur
-- AVANT d'écrire une éventuelle migration de nettoyage (suppression des lignes
-- d'audit fantômes + fusion des doublons d'owners). NE RIEN SUPPRIMER ICI.
-- ============================================================================

-- 1) Lignes d'audit qui loggent un changement de owner_id
SELECT count(*) AS audit_rows_with_owner_change
FROM public.intervention_audit_log
WHERE 'owner_id' = ANY(changed_fields);

-- 2) Parmi elles, les FANTÔMES : ancien et nouveau owner = même personne
--    (même plain_nom_facturation), uuid différents → aucun vrai changement.
SELECT count(*) AS phantom_owner_changes
FROM public.intervention_audit_log ial
JOIN public.owner o_old ON o_old.id = NULLIF(ial.old_values->>'owner_id', '')::uuid
JOIN public.owner o_new ON o_new.id = NULLIF(ial.new_values->>'owner_id', '')::uuid
WHERE 'owner_id' = ANY(ial.changed_fields)
  AND o_old.id <> o_new.id
  AND coalesce(btrim(o_old.plain_nom_facturation), '') <> ''
  AND coalesce(btrim(o_old.plain_nom_facturation), '') = coalesce(btrim(o_new.plain_nom_facturation), '');

-- 3) Doublons d'owners (même nom de facturation, sans téléphone) = la source
SELECT count(*) AS duplicate_owner_groups, coalesce(sum(cnt), 0) AS duplicate_owner_rows
FROM (
  SELECT btrim(plain_nom_facturation) AS nom, count(*) AS cnt
  FROM public.owner
  WHERE coalesce(btrim(plain_nom_facturation), '') <> ''
    AND coalesce(btrim(telephone), '') = ''
  GROUP BY btrim(plain_nom_facturation)
  HAVING count(*) > 1
) d;

-- 4) Aperçu : top 20 noms en doublon (les plus dupliqués d'abord)
SELECT btrim(plain_nom_facturation) AS nom, count(*) AS doublons
FROM public.owner
WHERE coalesce(btrim(plain_nom_facturation), '') <> ''
  AND coalesce(btrim(telephone), '') = ''
GROUP BY btrim(plain_nom_facturation)
HAVING count(*) > 1
ORDER BY count(*) DESC
LIMIT 20;
