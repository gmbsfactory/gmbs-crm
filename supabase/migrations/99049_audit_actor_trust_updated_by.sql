-- ============================================================================
-- 99049 — Acteur d'audit : faire confiance à updated_by (corrige le "Système"
--          sur les actions service-role same-user, ex. archivage)
-- ============================================================================
-- 99042 résolvait l'acteur via "NEW.updated_by SEULEMENT s'il diffère de OLD,
-- sinon auth.uid()". Régression : l'archivage passe par l'Edge Function en
-- service-role (auth.uid() NULL) et pose pourtant updated_by = l'utilisateur du
-- JWT. Quand cet utilisateur était déjà le dernier éditeur (NEW.updated_by =
-- OLD.updated_by), la condition "diffère de OLD" échouait -> repli sur auth.uid()
-- NULL -> acteur "Système" (pas d'avatar).
--
-- Toutes les écritures service-role (Edge Function interventions-v2) posent
-- explicitement updated_by ; on peut donc lui faire confiance. On résout l'acteur
-- via resolve_actor_user_id(NEW.updated_by, NULL) (explicite -> auth.uid -> NULL).
-- set_intervention_updated_by ne ré-hérite plus de OLD quand l'acteur est
-- irrésolvable (-> NULL/"Système" plutôt que l'éditeur précédent).
--
-- Bonus : search_vector (colonne recalculée à chaque update) est exclu du diff
-- d'audit pour ne plus polluer l'historique/flux ("Modification : Search Vector").
-- ============================================================================

-- 1) BEFORE UPDATE : résoudre l'acteur sans repli sur OLD
CREATE OR REPLACE FUNCTION public.set_intervention_updated_by()
RETURNS trigger AS $$
DECLARE
  actor_id uuid;
BEGIN
  actor_id := public.resolve_actor_user_id(NEW.updated_by, NULL);

  IF actor_id IS NOT NULL THEN
    NEW.updated_by = actor_id;
  ELSE
    -- Irrésolvable : ne pas hériter de l'éditeur précédent (évite le faux acteur).
    NEW.updated_by = NULL;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) AFTER UPDATE : faire confiance à NEW.updated_by + exclure search_vector
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
    'statut_id', 'search_vector'
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

  -- updated_by est posé de façon fiable (client + Edge Function service-role) ;
  -- on lui fait confiance, puis auth.uid(), puis NULL ("Système").
  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.updated_by, NULL)
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
