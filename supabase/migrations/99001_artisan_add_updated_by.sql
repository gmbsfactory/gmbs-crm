-- ========================================
-- Add updated_by / created_by to artisans table
-- ========================================
-- La table artisans n'avait pas ces colonnes, contrairement a interventions.
-- Cela empechait les triggers d'audit de resoudre l'acteur (actor_user_id = NULL)
-- car l'Edge Function utilise la service role key (auth.uid() = NULL).
--
-- Avec ces colonnes, le pattern est identique aux interventions :
-- Edge Function extrait le user ID du JWT → le passe dans updated_by/created_by
-- → le trigger lit NEW.updated_by pour resoudre l'acteur.

-- ========================================
-- 1) Ajouter les colonnes
-- ========================================
ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.artisans.updated_by IS 'User ID of the last modifier (for audit trigger resolution)';
COMMENT ON COLUMN public.artisans.created_by IS 'User ID of the creator (for audit trigger resolution)';

-- ========================================
-- 2) Mettre a jour audit_artisan_insert
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
  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.created_by, NEW.updated_by)
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
-- 3) Mettre a jour audit_artisan_update
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
    'updated_at', 'created_at', 'updated_by', 'created_by',
    'statut_id'
  ];
BEGIN
  -- Status change is handled separately
  IF OLD.statut_id IS DISTINCT FROM NEW.statut_id THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
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

  -- Archive / Restore detection via is_active
  IF 'is_active' = ANY(diff.changed_fields) THEN
    IF NEW.is_active = false THEN
      action_name := 'ARCHIVE';
    ELSIF NEW.is_active = true AND OLD.is_active = false THEN
      action_name := 'RESTORE';
    END IF;
  END IF;

  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
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
