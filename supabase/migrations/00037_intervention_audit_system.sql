-- ========================================
-- Intervention audit system
-- ========================================

-- ========================================
-- 1) Resolve actor id (public.users.id) from explicit/auth/fallback
-- ========================================
CREATE OR REPLACE FUNCTION public.resolve_actor_user_id(
  p_explicit_user_id uuid DEFAULT NULL,
  p_fallback_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  resolved_user_id uuid;
BEGIN
  IF p_explicit_user_id IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = p_explicit_user_id OR u.auth_user_id = p_explicit_user_id
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  resolved_user_id := public.get_current_user_id();
  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = auth.uid()
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  IF p_fallback_user_id IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = p_fallback_user_id OR u.auth_user_id = p_fallback_user_id
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.resolve_actor_user_id IS
  'Resolves public.users.id using explicit > auth mapping > fallback > NULL';

-- ========================================
-- 2) Add created_by to interventions
-- ========================================
ALTER TABLE public.interventions
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interventions_created_by
ON public.interventions(created_by);

COMMENT ON COLUMN public.interventions.created_by IS
  'User who created the intervention (public.users.id)';

-- ========================================
-- 3) Fix created_by/updated_by triggers (auth -> public mapping)
-- ========================================
CREATE OR REPLACE FUNCTION set_intervention_created_by()
RETURNS trigger AS $$
DECLARE
  created_id uuid;
  updated_id uuid;
  fallback_id uuid;
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    SELECT u.id INTO created_id
    FROM public.users u
    WHERE u.id = NEW.created_by OR u.auth_user_id = NEW.created_by
    LIMIT 1;
  END IF;

  IF NEW.updated_by IS NOT NULL THEN
    SELECT u.id INTO updated_id
    FROM public.users u
    WHERE u.id = NEW.updated_by OR u.auth_user_id = NEW.updated_by
    LIMIT 1;
  END IF;

  fallback_id := public.resolve_actor_user_id(NULL, NULL);

  IF created_id IS NULL THEN
    created_id := updated_id;
  END IF;
  IF created_id IS NULL THEN
    created_id := fallback_id;
  END IF;

  IF updated_id IS NULL THEN
    updated_id := created_id;
  END IF;

  NEW.created_by = created_id;
  NEW.updated_by = updated_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_intervention_updated_by()
RETURNS trigger AS $$
DECLARE
  actor_id uuid;
BEGIN
  actor_id := public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by);

  IF actor_id IS NOT NULL THEN
    NEW.updated_by = actor_id;
  ELSE
    NEW.updated_by = OLD.updated_by;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================
-- 4) Update status transition logging to resolve actors
-- ========================================
CREATE OR REPLACE FUNCTION log_intervention_status_transition_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
  actor_id uuid;
BEGIN
  IF NEW.statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  actor_id := public.resolve_actor_user_id(NEW.created_by, NEW.updated_by);

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, NULL, NEW.statut_id, NULL, to_status_code,
    actor_id,
    COALESCE(NEW.date, NEW.created_at, now()), 'trigger',
    jsonb_build_object('date_termine', NEW.date_termine, 'created_at', NEW.created_at,
      'note', 'Auto recorded by trigger on creation')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_intervention_status_transition_safety()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_status_code text;
  to_status_code text;
  existing_transition_id uuid;
  actor_id uuid;
BEGIN
  IF OLD.statut_id = NEW.statut_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT code INTO from_status_code
  FROM public.intervention_statuses WHERE id = OLD.statut_id;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses WHERE id = NEW.statut_id;

  actor_id := public.resolve_actor_user_id(NULL, NEW.updated_by);

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, OLD.statut_id, NEW.statut_id, from_status_code, to_status_code,
    actor_id,
    now(), 'trigger',
    jsonb_build_object('date_termine', NEW.date_termine, 'updated_at', NEW.updated_at,
      'note', 'Auto recorded by trigger (direct update)')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_status_transition_from_api(
  p_intervention_id uuid,
  p_from_status_id uuid,
  p_to_status_id uuid,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  from_status_code text;
  to_status_code text;
  transition_id uuid;
  actor_id uuid;
BEGIN
  IF p_from_status_id IS NOT NULL THEN
    SELECT code INTO from_status_code
    FROM public.intervention_statuses WHERE id = p_from_status_id;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses WHERE id = p_to_status_id;

  actor_id := public.resolve_actor_user_id(p_changed_by_user_id, NULL);

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    p_intervention_id, p_from_status_id, p_to_status_id, from_status_code, to_status_code,
    actor_id, now(), 'api', COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO transition_id;

  RETURN transition_id;
END;
$$;

-- ========================================
-- 5) Audit table
-- ========================================
CREATE TABLE IF NOT EXISTS public.intervention_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id),

  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_display text,
  actor_code text,
  actor_color text,

  action_type text NOT NULL CHECK (action_type IN (
    'CREATE',
    'UPDATE',
    'ARCHIVE',
    'RESTORE',
    'STATUS_CHANGE',
    'COST_ADD',
    'COST_UPDATE',
    'COST_DELETE',
    'PAYMENT_ADD',
    'PAYMENT_UPDATE',
    'PAYMENT_DELETE',
    'ARTISAN_ASSIGN',
    'ARTISAN_UPDATE',
    'ARTISAN_UNASSIGN',
    'DOCUMENT_ADD',
    'DOCUMENT_UPDATE',
    'DOCUMENT_DELETE',
    'COMMENT_ADD',
    'COMMENT_UPDATE',
    'COMMENT_DELETE'
  )),

  related_entity_type text CHECK (related_entity_type IS NULL OR related_entity_type IN (
    'cost', 'payment', 'artisan', 'document', 'comment', 'status_transition'
  )),
  related_entity_id uuid,

  old_values jsonb DEFAULT '{}'::jsonb,
  new_values jsonb DEFAULT '{}'::jsonb,
  changed_fields text[] DEFAULT '{}',

  status_transition_id uuid REFERENCES public.intervention_status_transitions(id) ON DELETE SET NULL,

  source text DEFAULT 'trigger' CHECK (source IN ('api', 'trigger', 'import', 'system', 'manual', 'backfill')),
  request_id text,
  transaction_id bigint,
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,

  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_intervention_id
  ON public.intervention_audit_log(intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_occurred_at
  ON public.intervention_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_intervention_occurred
  ON public.intervention_audit_log(intervention_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_action_type
  ON public.intervention_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_actor_user_id
  ON public.intervention_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_log_related_entity
  ON public.intervention_audit_log(related_entity_type, related_entity_id);

COMMENT ON TABLE public.intervention_audit_log IS
  'Audit log for interventions and related entities';

-- ========================================
-- 6) Actor snapshot helper
-- ========================================
CREATE OR REPLACE FUNCTION public.get_actor_snapshot(p_user_id uuid)
RETURNS TABLE (
  actor_user_id uuid,
  actor_display text,
  actor_code text,
  actor_color text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    u.id,
    COALESCE(NULLIF(BTRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, u.email),
    u.code_gestionnaire,
    u.color
  FROM public.users u
  WHERE u.id = p_user_id
  LIMIT 1;
$$;

-- ========================================
-- 7) Generic jsonb diff helper
-- ========================================
CREATE OR REPLACE FUNCTION public.jsonb_diff(
  p_old jsonb,
  p_new jsonb,
  p_exclude_keys text[] DEFAULT ARRAY['updated_at', 'updated_by', 'created_at']
)
RETURNS TABLE (
  changed_fields text[],
  old_values jsonb,
  new_values jsonb
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  key text;
  changed text[] := ARRAY[]::text[];
  old_vals jsonb := '{}'::jsonb;
  new_vals jsonb := '{}'::jsonb;
BEGIN
  IF p_old IS NULL THEN
    p_old := '{}'::jsonb;
  END IF;
  IF p_new IS NULL THEN
    p_new := '{}'::jsonb;
  END IF;

  FOR key IN SELECT jsonb_object_keys(p_new)
  LOOP
    IF p_exclude_keys IS NOT NULL AND key = ANY(p_exclude_keys) THEN
      CONTINUE;
    END IF;

    IF (p_old->key) IS DISTINCT FROM (p_new->key) THEN
      changed := array_append(changed, key);
      old_vals := old_vals || jsonb_build_object(key, p_old->key);
      new_vals := new_vals || jsonb_build_object(key, p_new->key);
    END IF;
  END LOOP;

  FOR key IN SELECT jsonb_object_keys(p_old)
  LOOP
    IF p_exclude_keys IS NOT NULL AND key = ANY(p_exclude_keys) THEN
      CONTINUE;
    END IF;

    IF NOT (p_new ? key) THEN
      changed := array_append(changed, key);
      old_vals := old_vals || jsonb_build_object(key, p_old->key);
      new_vals := new_vals || jsonb_build_object(key, NULL);
    END IF;
  END LOOP;

  RETURN QUERY SELECT changed, old_vals, new_vals;
END;
$$;

-- ========================================
-- 8) Audit triggers
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_intervention_insert()
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

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    new_values,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    NEW.id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    'CREATE',
    to_jsonb(NEW),
    'trigger',
    txid_current(),
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_insert ON public.interventions;
CREATE TRIGGER trg_audit_intervention_insert
  AFTER INSERT ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_insert();

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
    public.resolve_actor_user_id(NEW.updated_by, OLD.updated_by)
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

DROP TRIGGER IF EXISTS trg_audit_intervention_update ON public.interventions;
CREATE TRIGGER trg_audit_intervention_update
  AFTER UPDATE ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_update();

CREATE OR REPLACE FUNCTION public.audit_status_transition()
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
    public.resolve_actor_user_id(NEW.changed_by_user_id, NULL)
  );

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    status_transition_id,
    old_values, new_values,
    source,
    transaction_id,
    occurred_at,
    metadata
  ) VALUES (
    NEW.intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    'STATUS_CHANGE',
    'status_transition', NEW.id,
    NEW.id,
    jsonb_build_object('status_code', NEW.from_status_code, 'status_id', NEW.from_status_id),
    jsonb_build_object('status_code', NEW.to_status_code, 'status_id', NEW.to_status_id),
    COALESCE(NEW.source, 'trigger'),
    txid_current(),
    COALESCE(NEW.transition_date, now()),
    COALESCE(NEW.metadata, '{}'::jsonb)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_status_transition ON public.intervention_status_transitions;
CREATE TRIGGER trg_audit_status_transition
  AFTER INSERT ON public.intervention_status_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_status_transition();

CREATE OR REPLACE FUNCTION public.audit_intervention_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'COST_ADD';
    target_intervention_id := NEW.intervention_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'COST_UPDATE';
    target_intervention_id := NEW.intervention_id;

    SELECT * INTO diff
    FROM public.jsonb_diff(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['updated_at', 'created_at']
    );

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := COALESCE(NEW.updated_at, now());

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'COST_DELETE';
    target_intervention_id := OLD.intervention_id;
    old_val := to_jsonb(OLD);
    occurred := now();
  END IF;

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    target_intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'cost', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    txid_current(),
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_cost ON public.intervention_costs;
CREATE TRIGGER trg_audit_intervention_cost
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_cost();

CREATE OR REPLACE FUNCTION public.audit_intervention_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'PAYMENT_ADD';
    target_intervention_id := NEW.intervention_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'PAYMENT_UPDATE';
    target_intervention_id := NEW.intervention_id;

    SELECT * INTO diff
    FROM public.jsonb_diff(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['updated_at', 'created_at']
    );

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := COALESCE(NEW.updated_at, now());

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'PAYMENT_DELETE';
    target_intervention_id := OLD.intervention_id;
    old_val := to_jsonb(OLD);
    occurred := now();
  END IF;

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    target_intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'payment', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    txid_current(),
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_payment ON public.intervention_payments;
CREATE TRIGGER trg_audit_intervention_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_payment();

CREATE OR REPLACE FUNCTION public.audit_intervention_artisan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
  related_id uuid;
  meta jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(public.resolve_actor_user_id(NULL, NULL));

  IF TG_OP = 'INSERT' THEN
    action_name := 'ARTISAN_ASSIGN';
    target_intervention_id := NEW.intervention_id;
    related_id := NEW.artisan_id;
    new_val := to_jsonb(NEW);
    occurred := COALESCE(NEW.assigned_at, NEW.created_at, now());
    meta := jsonb_build_object('intervention_artisan_id', NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'ARTISAN_UPDATE';
    target_intervention_id := NEW.intervention_id;
    related_id := NEW.artisan_id;

    SELECT * INTO diff
    FROM public.jsonb_diff(
      to_jsonb(OLD),
      to_jsonb(NEW),
      ARRAY['created_at']
    );

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := now();
    meta := jsonb_build_object('intervention_artisan_id', NEW.id);

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'ARTISAN_UNASSIGN';
    target_intervention_id := OLD.intervention_id;
    related_id := OLD.artisan_id;
    old_val := to_jsonb(OLD);
    occurred := now();
    meta := jsonb_build_object('intervention_artisan_id', OLD.id);
  END IF;

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at,
    metadata
  ) VALUES (
    target_intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'artisan', related_id,
    old_val, new_val, changed,
    'trigger',
    txid_current(),
    occurred,
    meta
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_artisan ON public.intervention_artisans;
CREATE TRIGGER trg_audit_intervention_artisan
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_artisans
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_artisan();

CREATE OR REPLACE FUNCTION public.audit_intervention_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.created_by, NULL)
    );

    action_name := 'DOCUMENT_ADD';
    target_intervention_id := NEW.intervention_id;
    new_val := jsonb_build_object(
      'id', NEW.id,
      'kind', NEW.kind,
      'filename', NEW.filename,
      'mime_type', NEW.mime_type,
      'url', NEW.url
    );
    occurred := COALESCE(NEW.created_at, now());
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NULL, COALESCE(NEW.created_by, OLD.created_by))
    );

    action_name := 'DOCUMENT_UPDATE';
    target_intervention_id := NEW.intervention_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'kind', OLD.kind,
      'filename', OLD.filename,
      'mime_type', OLD.mime_type,
      'url', OLD.url,
      'file_size', OLD.file_size
    );
    new_val := jsonb_build_object(
      'id', NEW.id,
      'kind', NEW.kind,
      'filename', NEW.filename,
      'mime_type', NEW.mime_type,
      'url', NEW.url,
      'file_size', NEW.file_size
    );

    SELECT * INTO diff
    FROM public.jsonb_diff(old_val, new_val, ARRAY[]::text[]);

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := now();

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(OLD.created_by, NULL)
    );

    action_name := 'DOCUMENT_DELETE';
    target_intervention_id := OLD.intervention_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'kind', OLD.kind,
      'filename', OLD.filename,
      'mime_type', OLD.mime_type,
      'url', OLD.url
    );
    occurred := now();
  END IF;

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    target_intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'document', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    txid_current(),
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_attachment ON public.intervention_attachments;
CREATE TRIGGER trg_audit_intervention_attachment
  AFTER INSERT OR UPDATE OR DELETE ON public.intervention_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_attachment();

CREATE OR REPLACE FUNCTION public.audit_intervention_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.entity_type <> 'intervention' THEN
      RETURN NEW;
    END IF;

    action_name := 'COMMENT_ADD';
    target_intervention_id := NEW.entity_id;
    new_val := jsonb_build_object(
      'id', NEW.id,
      'content', LEFT(NEW.content, 200),
      'comment_type', NEW.comment_type,
      'reason_type', NEW.reason_type,
      'is_internal', NEW.is_internal
    );
    occurred := COALESCE(NEW.created_at, now());

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.author_id, NULL)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.entity_type <> 'intervention' THEN
      RETURN NEW;
    END IF;

    action_name := 'COMMENT_UPDATE';
    target_intervention_id := NEW.entity_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'content', LEFT(OLD.content, 200),
      'comment_type', OLD.comment_type,
      'reason_type', OLD.reason_type,
      'is_internal', OLD.is_internal
    );
    new_val := jsonb_build_object(
      'id', NEW.id,
      'content', LEFT(NEW.content, 200),
      'comment_type', NEW.comment_type,
      'reason_type', NEW.reason_type,
      'is_internal', NEW.is_internal
    );

    SELECT * INTO diff
    FROM public.jsonb_diff(old_val, new_val, ARRAY[]::text[]);

    changed := diff.changed_fields;
    old_val := diff.old_values;
    new_val := diff.new_values;
    occurred := COALESCE(NEW.updated_at, now());

    IF array_length(changed, 1) IS NULL OR array_length(changed, 1) = 0 THEN
      RETURN NEW;
    END IF;

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(NEW.author_id, NULL)
    );
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.entity_type <> 'intervention' THEN
      RETURN OLD;
    END IF;

    action_name := 'COMMENT_DELETE';
    target_intervention_id := OLD.entity_id;
    old_val := jsonb_build_object(
      'id', OLD.id,
      'content', LEFT(OLD.content, 200),
      'comment_type', OLD.comment_type,
      'reason_type', OLD.reason_type,
      'is_internal', OLD.is_internal
    );
    occurred := now();

    SELECT * INTO actor
    FROM public.get_actor_snapshot(
      public.resolve_actor_user_id(OLD.author_id, NULL)
    );
  END IF;

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type,
    related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source,
    transaction_id,
    occurred_at
  ) VALUES (
    target_intervention_id,
    actor.actor_user_id, actor.actor_display, actor.actor_code, actor.actor_color,
    action_name,
    'comment', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    'trigger',
    txid_current(),
    occurred
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_intervention_comment ON public.comments;
CREATE TRIGGER trg_audit_intervention_comment
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_intervention_comment();

-- ========================================
-- 9) Unified history function
-- ========================================
CREATE OR REPLACE FUNCTION public.get_intervention_history(
  p_intervention_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  action_type text,
  action_label text,
  actor_display text,
  actor_code text,
  actor_color text,
  occurred_at timestamptz,
  old_values jsonb,
  new_values jsonb,
  changed_fields text[],
  related_entity_type text,
  related_entity_id uuid,
  source text,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    a.id,
    a.action_type,
    CASE a.action_type
      WHEN 'CREATE' THEN 'Intervention creee'
      WHEN 'UPDATE' THEN 'Modification'
      WHEN 'ARCHIVE' THEN 'Archivee'
      WHEN 'RESTORE' THEN 'Restauree'
      WHEN 'STATUS_CHANGE' THEN 'Changement de statut'
      WHEN 'COST_ADD' THEN 'Cout ajoute'
      WHEN 'COST_UPDATE' THEN 'Cout modifie'
      WHEN 'COST_DELETE' THEN 'Cout supprime'
      WHEN 'PAYMENT_ADD' THEN 'Paiement ajoute'
      WHEN 'PAYMENT_UPDATE' THEN 'Paiement modifie'
      WHEN 'PAYMENT_DELETE' THEN 'Paiement supprime'
      WHEN 'ARTISAN_ASSIGN' THEN 'Artisan assigne'
      WHEN 'ARTISAN_UPDATE' THEN 'Artisan modifie'
      WHEN 'ARTISAN_UNASSIGN' THEN 'Artisan retire'
      WHEN 'DOCUMENT_ADD' THEN 'Document ajoute'
      WHEN 'DOCUMENT_UPDATE' THEN 'Document modifie'
      WHEN 'DOCUMENT_DELETE' THEN 'Document supprime'
      WHEN 'COMMENT_ADD' THEN 'Commentaire ajoute'
      WHEN 'COMMENT_UPDATE' THEN 'Commentaire modifie'
      WHEN 'COMMENT_DELETE' THEN 'Commentaire supprime'
      ELSE a.action_type
    END AS action_label,
    a.actor_display,
    a.actor_code,
    a.actor_color,
    a.occurred_at,
    a.old_values,
    a.new_values,
    a.changed_fields,
    a.related_entity_type,
    a.related_entity_id,
    a.source,
    a.metadata
  FROM public.intervention_audit_log a
  WHERE a.intervention_id = p_intervention_id
  ORDER BY a.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.get_intervention_history IS
  'Returns unified intervention history from the audit log';
