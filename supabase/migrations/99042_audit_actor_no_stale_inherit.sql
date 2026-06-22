-- ============================================================================
-- 99042 — Acteur de l'audit : ne plus hériter de l'éditeur précédent
-- ============================================================================
-- Bug : audit_intervention_update résolvait l'acteur via
--   resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
-- Or, lors d'un UPDATE qui ne change pas explicitement updated_by (contexte
-- serveur / service role sans auth.uid()), la colonne NEW.updated_by porte la
-- valeur HÉRITÉE de l'éditeur précédent. Comme resolve_actor_user_id donne la
-- priorité à l'argument « explicite », l'audit créditait à tort la dernière
-- personne (ex. « Harold » sur un changement qu'il n'a pas fait).
--
-- Règle métier : un UPDATE applicatif a TOUJOURS auth.uid(). On ne traite donc
-- updated_by comme acteur explicite QUE s'il a réellement changé dans cet UPDATE
-- (IS DISTINCT FROM OLD). Sinon on retombe sur auth.uid() (get_current_user_id),
-- puis NULL (-> « Système ») si la session est absente — jamais sur l'ancien
-- éditeur. Seule la résolution de l'acteur change ; le reste est identique au
-- trigger d'origine (migration 00037).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_intervention_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text := 'UPDATE';
  excluded_keys text[] := ARRAY[
    'updated_at', 'updated_by', 'created_at', 'created_by',
    'statut_id'
  ];
BEGIN
  SELECT * INTO diff
  FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), excluded_keys);

  IF array_length(diff.changed_fields, 1) IS NULL OR array_length(diff.changed_fields, 1) = 0 THEN
    RETURN NEW;
  END IF;

  IF 'is_active' = ANY(diff.changed_fields) THEN
    IF NEW.is_active = false THEN
      action_name := 'ARCHIVE';
    ELSIF NEW.is_active = true AND OLD.is_active = false THEN
      action_name := 'RESTORE';
    END IF;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(
      -- updated_by n'est l'acteur explicite que s'il a réellement changé ;
      -- sinon -> auth.uid(), puis NULL ("Système"). Jamais l'éditeur précédent.
      CASE WHEN NEW.updated_by IS DISTINCT FROM OLD.updated_by THEN NEW.updated_by ELSE NULL END,
      NULL
    )
  );

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    diff.old_values, diff.new_values, diff.changed_fields,
    'trigger',
    txid_current(),
    COALESCE(NEW.updated_at, now())
  );

  RETURN NEW;
END;
$$;
