-- ============================================================================
-- 99054 — Triggers « import-aware » — PHASE 2  (dépend de 99053)
-- ----------------------------------------------------------------------------
-- Sous une opération d'import VALIDE (cf. current_data_operation_context, basée
-- sur le mécanisme prouvé en POC Phase 0), les écritures générées :
--   • restent ÉCRITES et traçables (operation_id pointe sur data_operation_log)
--   • ne créditent JAMAIS l'humain qui a lancé l'import :
--        actor_user_id / changed_by_user_id = NULL, source = 'import'
-- HORS import : comportement STRICTEMENT identique à aujourd'hui (seule la
-- clause VALUES est touchée ; toute la logique métier est inchangée).
--
-- Anti-forge : le contexte n'est honoré QUE si role = service_role ET
-- auth.uid() IS NULL ET en-têtes x-crm-operation-* présents ET opération
-- 'running' en base. Un appel anon/authenticated forgeant les en-têtes est
-- ignoré (retombe sur le comportement normal).
--
-- Cette migration NE TOUCHE PAS : la route import, l'export, le Monitoring
-- feed/RPC, ni aucune donnée historique.
-- ============================================================================

-- ── 0) Contexte d'opération (source de vérité unique, anti-forge) ────────────
CREATE OR REPLACE FUNCTION public.current_data_operation_context()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    text;
  v_uid     uuid;
  v_headers jsonb;
  v_op_id   text;
  v_op_type text;
  v_ok      boolean;
BEGIN
  -- (1) Rôle PostgREST = service_role, sinon on n'honore RIEN.
  BEGIN
    v_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  EXCEPTION WHEN others THEN v_role := null; END;
  IF v_role IS DISTINCT FROM 'service_role' THEN
    RETURN NULL;
  END IF;

  -- (2) Aucun utilisateur authentifié (un JWT user ne doit jamais activer l'import).
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN others THEN v_uid := null; END;
  IF v_uid IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- (3) En-têtes d'opération présents et de type import.
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN v_headers := null; END;
  v_op_id   := v_headers ->> 'x-crm-operation-id';
  v_op_type := v_headers ->> 'x-crm-operation-type';
  IF v_op_id IS NULL OR v_op_type IS DISTINCT FROM 'IMPORT_INTERVENTIONS' THEN
    RETURN NULL;
  END IF;

  -- (4) L'opération doit exister et être EN COURS (anti-rejeu / anti-id arbitraire).
  SELECT EXISTS (
    SELECT 1 FROM public.data_operation_log d
    WHERE d.id = v_op_id::uuid
      AND d.operation_type = 'IMPORT_INTERVENTIONS'
      AND d.status = 'running'
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN NULL;
  END IF;

  RETURN v_op_id::uuid;
EXCEPTION WHEN others THEN
  -- Tout imprévu (cast invalide, etc.) → pas de contexte → comportement normal.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_data_operation_context() IS
  'Retourne l''operation_id d''import courant SEULEMENT si role=service_role ET auth.uid() IS NULL ET en-têtes x-crm-operation-* valides ET opération running. NULL sinon. Anti-forge : jamais honoré sous anon/authenticated.';

-- Moindre privilège : fonction INTERNE, appelée uniquement par les triggers
-- (SECURITY DEFINER → exécutés en tant qu'owner, donc EXECUTE conservé). On la
-- retire de l'API publique : sans ce REVOKE, les DEFAULT PRIVILEGES Supabase la
-- granteraient à anon/authenticated (RPC /rest/v1/rpc/...).
REVOKE ALL ON FUNCTION public.current_data_operation_context() FROM PUBLIC, anon, authenticated;

-- ── 1) BEFORE INSERT/UPDATE interventions : acteur neutralisé sous import ─────
CREATE OR REPLACE FUNCTION set_intervention_created_by()
RETURNS trigger AS $$
DECLARE
  created_id uuid;
  updated_id uuid;
  fallback_id uuid;
BEGIN
  -- Import : écriture système, aucun créateur/éditeur humain.
  IF public.current_data_operation_context() IS NOT NULL THEN
    NEW.created_by := NULL;
    NEW.updated_by := NULL;
    RETURN NEW;
  END IF;

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

  IF created_id IS NULL THEN created_id := updated_id; END IF;
  IF created_id IS NULL THEN created_id := fallback_id; END IF;
  IF updated_id IS NULL THEN updated_id := created_id; END IF;

  NEW.created_by = created_id;
  NEW.updated_by = updated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_intervention_updated_by()
RETURNS trigger AS $$
DECLARE
  actor_id uuid;
BEGIN
  -- Import : aucun éditeur humain.
  IF public.current_data_operation_context() IS NOT NULL THEN
    NEW.updated_by := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  actor_id := public.resolve_actor_user_id(NEW.updated_by, NULL);
  IF actor_id IS NOT NULL THEN
    NEW.updated_by = actor_id;
  ELSE
    NEW.updated_by = NULL;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2) AFTER INSERT/UPDATE interventions : audit log ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_intervention_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor record;
  v_op_id uuid := public.current_data_operation_context();
BEGIN
  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.created_by, NEW.updated_by)
  );

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type, new_values, source, operation_id, transaction_id, occurred_at
  ) VALUES (
    NEW.id,
    CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
    'CREATE',
    to_jsonb(NEW),
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    v_op_id,
    txid_current(),
    COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_intervention_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor record;
  diff record;
  action_name text := 'UPDATE';
  v_op_id uuid := public.current_data_operation_context();
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

  SELECT * INTO actor
  FROM public.get_actor_snapshot(
    public.resolve_actor_user_id(NEW.updated_by, NULL)
  );

  INSERT INTO public.intervention_audit_log (
    intervention_id,
    actor_user_id, actor_display, actor_code, actor_color,
    action_type, old_values, new_values, changed_fields,
    source, operation_id, transaction_id, occurred_at
  ) VALUES (
    NEW.id,
    CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
    action_name,
    diff.old_values, diff.new_values, diff.changed_fields,
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    v_op_id,
    txid_current(),
    COALESCE(NEW.updated_at, now())
  );
  RETURN NEW;
END;
$$;

-- ── 3) Transitions de statut (initiale + safety + audit) ─────────────────────
CREATE OR REPLACE FUNCTION public.log_intervention_status_transition_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
  actor_id uuid;
  v_op_id uuid := public.current_data_operation_context();
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

  actor_id := CASE WHEN v_op_id IS NULL
                   THEN public.resolve_actor_user_id(NEW.created_by, NEW.updated_by)
                   ELSE NULL END;

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata, operation_id
  ) VALUES (
    NEW.id, NULL, NEW.statut_id, NULL, to_status_code,
    actor_id,
    COALESCE(NEW.created_at, now()),
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    jsonb_build_object('date_termine', NEW.date_termine, 'created_at', NEW.created_at,
      'note', 'Auto recorded by trigger on creation'),
    v_op_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_intervention_status_transition_safety()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  from_status_code text;
  to_status_code text;
  existing_transition_id uuid;
  actor_id uuid;
  v_op_id uuid := public.current_data_operation_context();
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

  actor_id := CASE WHEN v_op_id IS NULL
                   THEN public.resolve_actor_user_id(NULL, NEW.updated_by)
                   ELSE NULL END;

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata, operation_id
  ) VALUES (
    NEW.id, OLD.statut_id, NEW.statut_id, from_status_code, to_status_code,
    actor_id,
    now(),
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    jsonb_build_object('date_termine', NEW.date_termine, 'updated_at', NEW.updated_at,
      'note', 'Auto recorded by trigger (direct update)'),
    v_op_id
  );
  RETURN NEW;
END;
$$;

-- audit_status_transition propage le contexte PORTÉ par la transition (NEW),
-- déjà posé en source='import' + operation_id par les deux fonctions ci-dessus.
CREATE OR REPLACE FUNCTION public.audit_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    action_type, related_entity_type, related_entity_id, status_transition_id,
    old_values, new_values, source, operation_id, transaction_id, occurred_at, metadata
  ) VALUES (
    NEW.intervention_id,
    CASE WHEN NEW.operation_id IS NULL THEN actor.actor_user_id END,
    CASE WHEN NEW.operation_id IS NULL THEN actor.actor_display END,
    CASE WHEN NEW.operation_id IS NULL THEN actor.actor_code  END,
    CASE WHEN NEW.operation_id IS NULL THEN actor.actor_color END,
    'STATUS_CHANGE',
    'status_transition', NEW.id, NEW.id,
    jsonb_build_object('status_code', NEW.from_status_code, 'status_id', NEW.from_status_id),
    jsonb_build_object('status_code', NEW.to_status_code, 'status_id', NEW.to_status_id),
    COALESCE(NEW.source, 'trigger'),
    NEW.operation_id,
    txid_current(),
    COALESCE(NEW.transition_date, now()),
    COALESCE(NEW.metadata, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

-- ── 4) Coûts & affectations artisan ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_intervention_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor record;
  diff record;
  action_name text;
  target_intervention_id uuid;
  old_val jsonb := '{}'::jsonb;
  new_val jsonb := '{}'::jsonb;
  changed text[] := ARRAY[]::text[];
  occurred timestamptz;
  v_op_id uuid := public.current_data_operation_context();
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
    FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), ARRAY['updated_at', 'created_at']);
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
    action_type, related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source, operation_id, transaction_id, occurred_at
  ) VALUES (
    target_intervention_id,
    CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
    action_name,
    'cost', COALESCE(NEW.id, OLD.id),
    old_val, new_val, changed,
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    v_op_id,
    txid_current(),
    occurred
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_intervention_artisan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_op_id uuid := public.current_data_operation_context();
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
    FROM public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), ARRAY['created_at']);
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
    action_type, related_entity_type, related_entity_id,
    old_values, new_values, changed_fields,
    source, operation_id, transaction_id, occurred_at, metadata
  ) VALUES (
    target_intervention_id,
    CASE WHEN v_op_id IS NULL THEN actor.actor_user_id END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_display END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_code  END,
    CASE WHEN v_op_id IS NULL THEN actor.actor_color END,
    action_name,
    'artisan', related_id,
    old_val, new_val, changed,
    CASE WHEN v_op_id IS NULL THEN 'trigger' ELSE 'import' END,
    v_op_id,
    txid_current(),
    occurred,
    meta
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Les CREATE TRIGGER existants pointent ces fonctions par nom : aucun trigger à
-- recréer. On notifie PostgREST de recharger le schéma.
NOTIFY pgrst, 'reload schema';
