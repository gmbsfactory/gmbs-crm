-- ========================================
-- Fix: adapter les triggers d'audit artisan aux colonnes reelles de la table artisans
--
-- La table artisans n'a PAS les colonnes: updated_by, created_by, archived_at
-- (contrairement a interventions qui a updated_by et created_by)
--
-- Resolution de l'acteur: on passe NULL a resolve_actor_user_id()
-- qui resout automatiquement via auth.uid() -> public.users
--
-- Archive/Restore: detection via is_active (pas archived_at)
-- ========================================

-- ========================================
-- 1) Fix audit_artisan_insert (retirait created_by / updated_by)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
BEGIN
  -- artisans n'a pas created_by/updated_by, on resout via auth.uid()
  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NULL, NULL)
  );

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    new_values,
    source,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    'CREATE',
    to_jsonb(NEW),
    'trigger',
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$$;

-- ========================================
-- 2) Fix audit_artisan_update (retirait updated_by + archived_at)
-- Calque sur audit_intervention_update (migration 00037)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_artisan_update()
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
    'updated_at', 'created_at',
    'statut_id'
  ];
BEGIN
  -- Status change is handled separately
  IF OLD.statut_id IS DISTINCT FROM NEW.statut_id THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NULL, NULL)
    );

    INSERT INTO public.artisan_audit_log (
      artisan_id,
      actor_user_id, actor_display, actor_code, actor_color,
      action_type,
      related_entity_type,
      old_values, new_values,
      source,
      occurred_at
    ) VALUES (
      NEW.id,
      actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
      'STATUS_CHANGE',
      'status',
      jsonb_build_object('statut_id', OLD.statut_id),
      jsonb_build_object('statut_id', NEW.statut_id),
      'trigger',
      COALESCE(NEW.updated_at, now())
    );
  END IF;

  -- Compute diff for other fields
  SELECT * INTO diff
  FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), excluded_keys);

  IF array_length(diff.changed_fields, 1) IS NULL OR array_length(diff.changed_fields, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Archive / Restore detection via is_active (meme pattern que interventions)
  IF 'is_active' = ANY(diff.changed_fields) THEN
    IF NEW.is_active = false THEN
      action_name := 'ARCHIVE';
    ELSIF NEW.is_active = true AND OLD.is_active = false THEN
      action_name := 'RESTORE';
    END IF;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NULL, NULL)
  );

  INSERT INTO public.artisan_audit_log (
    artisan_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    old_values, new_values, changed_fields,
    source,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    diff.old_values, diff.new_values, diff.changed_fields,
    'trigger',
    COALESCE(NEW.updated_at, now())
  );

  RETURN NEW;
END;
$$;
