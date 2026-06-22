-- ============================================================================
-- 99041 — Nettoyage des lignes d'audit « fantômes » sur owner_id
-- ============================================================================
-- Avant le correctif de dédup (findOrCreateOwner), chaque sauvegarde d'un dossier
-- sans téléphone propriétaire recréait un owner -> owner_id changeait d'UUID alors
-- que le PROPRIÉTAIRE restait le même (même plain_nom_facturation). L'audit
-- enregistrait donc un faux changement « M. X → M. X » qui pollue le suivi.
--
-- Dry-run du 2026-06-22 : 133 lignes UPDATE touchent owner_id
--   - 64 fantômes PURES (owner_id seul, avant==après même nom) -> SUPPRIMÉES
--   - 65 fantômes MIXTES (owner_id + vrais champs, même nom)   -> owner_id retiré
--   -  4 vrais changements de propriétaire                     -> INTACTS
--   -  0 owner -> NULL                                          -> INTACTS
--
-- Critère « fantôme » : owner_id change d'UUID MAIS owner(ancien) et owner(nouveau)
-- portent un plain_nom_facturation identique (non vide). Réversible : non (suppression
-- de lignes d'audit obsolètes) — mais strictement borné aux paires même-nom.
-- ============================================================================

-- Visibilité dans la sortie de `supabase db push`
DO $$
DECLARE n_pure int; n_mixed int;
BEGIN
  SELECT count(*) INTO n_pure
  FROM public.intervention_audit_log ial
  JOIN public.owner o_old ON o_old.id = NULLIF(ial.old_values->>'owner_id','')::uuid
  JOIN public.owner o_new ON o_new.id = NULLIF(ial.new_values->>'owner_id','')::uuid
  WHERE ial.action_type = 'UPDATE'
    AND ial.changed_fields = ARRAY['owner_id']
    AND o_old.id <> o_new.id
    AND btrim(coalesce(o_old.plain_nom_facturation,'')) <> ''
    AND btrim(coalesce(o_old.plain_nom_facturation,'')) = btrim(coalesce(o_new.plain_nom_facturation,''));

  SELECT count(*) INTO n_mixed
  FROM public.intervention_audit_log ial
  JOIN public.owner o_old ON o_old.id = NULLIF(ial.old_values->>'owner_id','')::uuid
  JOIN public.owner o_new ON o_new.id = NULLIF(ial.new_values->>'owner_id','')::uuid
  WHERE ial.action_type = 'UPDATE'
    AND 'owner_id' = ANY(ial.changed_fields)
    AND array_length(ial.changed_fields, 1) > 1
    AND o_old.id <> o_new.id
    AND btrim(coalesce(o_old.plain_nom_facturation,'')) <> ''
    AND btrim(coalesce(o_old.plain_nom_facturation,'')) = btrim(coalesce(o_new.plain_nom_facturation,''));

  RAISE NOTICE '[99041] fantomes owner -> PURES (delete): %, MIXTES (strip owner_id): %', n_pure, n_mixed;
END $$;

-- 1) Supprimer les fantômes PURES (la ligne n'existe que pour ce faux changement)
DELETE FROM public.intervention_audit_log ial
USING public.owner o_old, public.owner o_new
WHERE ial.action_type = 'UPDATE'
  AND ial.changed_fields = ARRAY['owner_id']
  AND o_old.id = NULLIF(ial.old_values->>'owner_id','')::uuid
  AND o_new.id = NULLIF(ial.new_values->>'owner_id','')::uuid
  AND o_old.id <> o_new.id
  AND btrim(coalesce(o_old.plain_nom_facturation,'')) <> ''
  AND btrim(coalesce(o_old.plain_nom_facturation,'')) = btrim(coalesce(o_new.plain_nom_facturation,''));

-- 2) Nettoyer les fantômes MIXTES : retirer owner_id du diff, garder les vrais champs
UPDATE public.intervention_audit_log ial SET
  changed_fields = array_remove(ial.changed_fields, 'owner_id'),
  old_values = ial.old_values - 'owner_id',
  new_values = ial.new_values - 'owner_id'
FROM public.owner o_old, public.owner o_new
WHERE ial.action_type = 'UPDATE'
  AND 'owner_id' = ANY(ial.changed_fields)
  AND array_length(ial.changed_fields, 1) > 1
  AND o_old.id = NULLIF(ial.old_values->>'owner_id','')::uuid
  AND o_new.id = NULLIF(ial.new_values->>'owner_id','')::uuid
  AND o_old.id <> o_new.id
  AND btrim(coalesce(o_old.plain_nom_facturation,'')) <> ''
  AND btrim(coalesce(o_old.plain_nom_facturation,'')) = btrim(coalesce(o_new.plain_nom_facturation,''));
