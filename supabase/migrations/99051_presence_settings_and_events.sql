-- ========================================
-- Présence CRM : seuils configurables + journal d'événements
-- ----------------------------------------
-- Distingue la session d'authentification Supabase du statut métier CRM :
-- active -> pastille verte, idle -> orange, offline -> grise.
-- Les seuils sont pilotés par crm_presence_settings.
-- ========================================

-- 1) Colonnes de présence sur users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS presence_state text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS presence_state_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS presence_session_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_presence_state_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_presence_state_check
      CHECK (presence_state IN ('active', 'idle', 'offline'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_presence_state
  ON public.users (presence_state);

CREATE INDEX IF NOT EXISTS idx_users_last_active_at
  ON public.users (last_active_at DESC);

COMMENT ON COLUMN public.users.presence_state IS
  'Statut métier de présence CRM : active, idle ou offline. Indépendant de la durée du token auth.';
COMMENT ON COLUMN public.users.last_active_at IS
  'Dernière activité utilisateur réelle côté CRM, utilisée pour basculer idle/offline.';
COMMENT ON COLUMN public.users.presence_session_id IS
  'Session de présence logique, renouvelée lors du retour après offline.';

-- 2) Réglages globaux de présence
CREATE TABLE IF NOT EXISTS public.crm_presence_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  idle_after_minutes integer NOT NULL DEFAULT 5,
  offline_after_minutes integer NOT NULL DEFAULT 60,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_presence_settings_thresholds_check'
      AND conrelid = 'public.crm_presence_settings'::regclass
  ) THEN
    ALTER TABLE public.crm_presence_settings
      ADD CONSTRAINT crm_presence_settings_thresholds_check
      CHECK (
        idle_after_minutes BETWEEN 1 AND 240
        AND offline_after_minutes BETWEEN 2 AND 1440
        AND offline_after_minutes > idle_after_minutes
      );
  END IF;
END $$;

INSERT INTO public.crm_presence_settings (id, idle_after_minutes, offline_after_minutes)
VALUES (true, 5, 60)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.crm_presence_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cps_authenticated_read ON public.crm_presence_settings;
CREATE POLICY cps_authenticated_read ON public.crm_presence_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS cps_dev_admin_write ON public.crm_presence_settings;
CREATE POLICY cps_dev_admin_write ON public.crm_presence_settings
  FOR ALL TO authenticated
  USING (public.user_has_role('admin') OR public.user_has_role('dev'))
  WITH CHECK (public.user_has_role('admin') OR public.user_has_role('dev'));

COMMENT ON TABLE public.crm_presence_settings IS
  'Seuils globaux de présence CRM : idle et offline, configurables depuis Monitoring Dev.';

-- 3) Journal persistant des transitions de présence
CREATE TABLE IF NOT EXISTS public.user_presence_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid,
  kind text NOT NULL CHECK (kind IN (
    'AUTH_LOGIN',
    'PRESENCE_START',
    'PRESENCE_RESUME',
    'IDLE_START',
    'PRESENCE_END'
  )),
  source text NOT NULL DEFAULT 'client' CHECK (source IN ('auth', 'client', 'server', 'system')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upe_time
  ON public.user_presence_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_upe_user_time
  ON public.user_presence_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_upe_kind_time
  ON public.user_presence_events (kind, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_upe_session
  ON public.user_presence_events (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.user_presence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upe_admin_dev_read ON public.user_presence_events;
CREATE POLICY upe_admin_dev_read ON public.user_presence_events
  FOR SELECT TO authenticated
  USING (public.user_has_role('admin') OR public.user_has_role('dev'));

DROP POLICY IF EXISTS upe_user_own_events ON public.user_presence_events;
CREATE POLICY upe_user_own_events ON public.user_presence_events
  FOR SELECT TO authenticated
  USING (user_id = public.get_public_user_id());

DROP POLICY IF EXISTS upe_user_insert_own_events ON public.user_presence_events;
CREATE POLICY upe_user_insert_own_events ON public.user_presence_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_public_user_id());

COMMENT ON TABLE public.user_presence_events IS
  'Journal des transitions de présence CRM, utilisé par le flux Monitoring Dev.';

-- 4) Fonction centrale d'écriture de présence
CREATE OR REPLACE FUNCTION public.record_user_presence_event(
  p_user_id uuid,
  p_state text,
  p_kind text,
  p_source text DEFAULT 'client',
  p_session_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_occurred_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_state text;
  v_status user_status;
  v_at timestamptz := COALESCE(p_occurred_at, now());
  v_should_log boolean := true;
  v_event_id bigint;
BEGIN
  IF p_state NOT IN ('active', 'idle', 'offline') THEN
    RAISE EXCEPTION 'invalid presence state: %', p_state USING errcode = '22023';
  END IF;

  IF p_kind NOT IN ('AUTH_LOGIN', 'PRESENCE_START', 'PRESENCE_RESUME', 'IDLE_START', 'PRESENCE_END') THEN
    RAISE EXCEPTION 'invalid presence kind: %', p_kind USING errcode = '22023';
  END IF;

  IF p_source NOT IN ('auth', 'client', 'server', 'system') THEN
    RAISE EXCEPTION 'invalid presence source: %', p_source USING errcode = '22023';
  END IF;

  SELECT presence_state, status
    INTO v_prev_state, v_status
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found: %', p_user_id USING errcode = '02000';
  END IF;

  v_prev_state := COALESCE(v_prev_state, 'offline');

  IF p_kind IN ('AUTH_LOGIN', 'PRESENCE_START') AND v_prev_state <> 'offline' THEN
    v_should_log := false;
  ELSIF p_kind = 'IDLE_START' AND v_prev_state = 'idle' THEN
    v_should_log := false;
  ELSIF p_kind = 'PRESENCE_RESUME' AND v_prev_state = 'active' THEN
    v_should_log := false;
  ELSIF p_kind = 'PRESENCE_END' AND v_prev_state = 'offline' THEN
    v_should_log := false;
  END IF;

  UPDATE public.users
  SET
    presence_state = p_state,
    presence_state_changed_at = CASE WHEN v_prev_state IS DISTINCT FROM p_state THEN v_at ELSE presence_state_changed_at END,
    last_active_at = CASE WHEN p_state = 'active' THEN v_at ELSE last_active_at END,
    last_seen_at = CASE WHEN p_state = 'active' THEN v_at ELSE last_seen_at END,
    presence_session_id = COALESCE(p_session_id, presence_session_id),
    status = CASE
      WHEN status = 'archived' THEN status
      WHEN p_state = 'active' THEN 'connected'::user_status
      WHEN p_state = 'offline' THEN 'offline'::user_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_user_id;

  IF v_should_log THEN
    INSERT INTO public.user_presence_events (
      user_id,
      session_id,
      kind,
      source,
      occurred_at,
      metadata
    )
    VALUES (
      p_user_id,
      p_session_id,
      p_kind,
      p_source,
      v_at,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('previous_state', v_prev_state, 'state', p_state)
    )
    RETURNING id INTO v_event_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'logged', v_should_log,
    'event_id', v_event_id,
    'previous_state', v_prev_state,
    'state', p_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) IS
  'Met à jour la présence CRM et journalise uniquement les transitions significatives.';

-- 5) Cron d'inactivité piloté par les réglages
CREATE OR REPLACE FUNCTION public.check_inactive_users()
RETURNS TABLE(
  users_set_offline integer,
  affected_user_ids text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idle_minutes integer;
  v_offline_minutes integer;
  v_offline_count integer := 0;
  v_offline_ids text[] := ARRAY[]::text[];
BEGIN
  SELECT idle_after_minutes, offline_after_minutes
    INTO v_idle_minutes, v_offline_minutes
  FROM public.crm_presence_settings
  WHERE id = true;

  v_idle_minutes := COALESCE(v_idle_minutes, 5);
  v_offline_minutes := COALESCE(v_offline_minutes, 60);

  WITH candidates AS (
    SELECT
      id,
      presence_session_id,
      presence_state,
      COALESCE(last_active_at, last_seen_at, presence_state_changed_at, updated_at, created_at) AS activity_at
    FROM public.users
    WHERE status <> 'archived'
      AND presence_state <> 'offline'
      AND COALESCE(last_active_at, last_seen_at, presence_state_changed_at, updated_at, created_at)
          < now() - make_interval(mins => v_offline_minutes)
  ),
  updated AS (
    UPDATE public.users u
    SET
      presence_state = 'offline',
      status = 'offline',
      presence_state_changed_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE u.id = c.id
    RETURNING u.id, u.presence_session_id, c.presence_state AS previous_state, c.activity_at
  ),
  inserted AS (
    INSERT INTO public.user_presence_events (user_id, session_id, kind, source, occurred_at, metadata)
    SELECT
      id,
      presence_session_id,
      'PRESENCE_END',
      'server',
      now(),
      jsonb_build_object(
        'reason', 'offline_threshold',
        'threshold_minutes', v_offline_minutes,
        'previous_state', previous_state,
        'state', 'offline',
        'last_activity_at', activity_at
      )
    FROM updated
    RETURNING user_id
  )
  SELECT COUNT(*)::integer, COALESCE(array_agg(user_id::text), ARRAY[]::text[])
    INTO v_offline_count, v_offline_ids
  FROM inserted;

  WITH candidates AS (
    SELECT
      id,
      presence_session_id,
      COALESCE(last_active_at, last_seen_at, presence_state_changed_at, updated_at, created_at) AS activity_at
    FROM public.users
    WHERE status <> 'archived'
      AND presence_state = 'active'
      AND COALESCE(last_active_at, last_seen_at, presence_state_changed_at, updated_at, created_at)
          < now() - make_interval(mins => v_idle_minutes)
      AND COALESCE(last_active_at, last_seen_at, presence_state_changed_at, updated_at, created_at)
          >= now() - make_interval(mins => v_offline_minutes)
  ),
  updated AS (
    UPDATE public.users u
    SET
      presence_state = 'idle',
      presence_state_changed_at = now(),
      updated_at = now()
    FROM candidates c
    WHERE u.id = c.id
    RETURNING u.id, u.presence_session_id, c.activity_at
  )
  INSERT INTO public.user_presence_events (user_id, session_id, kind, source, occurred_at, metadata)
  SELECT
    id,
    presence_session_id,
    'IDLE_START',
    'server',
    now(),
    jsonb_build_object(
      'reason', 'idle_threshold',
      'threshold_minutes', v_idle_minutes,
      'previous_state', 'active',
      'state', 'idle',
      'last_activity_at', activity_at
    )
  FROM updated;

  RETURN QUERY SELECT v_offline_count, v_offline_ids;
END;
$$;

COMMENT ON FUNCTION public.check_inactive_users IS
  'Bascule active->idle et idle/active->offline selon crm_presence_settings. La session auth reste indépendante.';

-- 6) Flux Monitoring Dev : inclure les événements de présence
CREATE OR REPLACE FUNCTION public.get_global_activity_feed(
  p_date_start    timestamptz,
  p_date_end      timestamptz,
  p_user_ids      uuid[]  DEFAULT NULL,
  p_action_types  text[]  DEFAULT NULL,
  p_entity_types  text[]  DEFAULT NULL,
  p_limit         int     DEFAULT 200,
  p_offset        int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.user_has_role('dev') THEN
    RAISE EXCEPTION 'forbidden: dev role required' USING errcode = '42501';
  END IF;

  WITH feed AS (
    SELECT
      ial.id::text AS id,
      ial.action_type,
      'intervention'::text AS entity_type,
      ial.intervention_id::text AS entity_id,
      COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8)) AS entity_label,
      jsonb_build_object(
        'id_inter',     i.id_inter,
        'date',         i.date,
        'statut_code',  ist.code,
        'statut_label', ist.label,
        'statut_color', ist.color
      ) AS entity_meta,
      ial.actor_user_id,
      ial.actor_display,
      ial.actor_code,
      ial.actor_color,
      ial.occurred_at,
      ial.changed_fields,
      ial.old_values,
      ial.new_values,
      ial.related_entity_id::text AS related_entity_id
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i ON i.id = ial.intervention_id
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE ial.occurred_at >= p_date_start
      AND ial.occurred_at <= p_date_end

    UNION ALL

    SELECT
      aal.id::text AS id,
      aal.action_type,
      'artisan'::text AS entity_type,
      aal.artisan_id::text AS entity_id,
      COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) AS entity_label,
      jsonb_build_object(
        'nom',           a.nom,
        'prenom',        a.prenom,
        'raison_sociale', a.raison_sociale,
        'statut_code',   ast.code,
        'statut_label',  ast.label,
        'statut_color',  ast.color
      ) AS entity_meta,
      aal.actor_user_id,
      aal.actor_display,
      aal.actor_code,
      aal.actor_color,
      aal.occurred_at,
      aal.changed_fields,
      aal.old_values,
      aal.new_values,
      aal.related_entity_id::text AS related_entity_id
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a ON a.id = aal.artisan_id
    LEFT JOIN public.artisan_statuses ast ON ast.id = a.statut_id
    WHERE aal.occurred_at >= p_date_start
      AND aal.occurred_at <= p_date_end

    UNION ALL

    SELECT
      ('presence-' || upe.id::text) AS id,
      upe.kind AS action_type,
      'presence'::text AS entity_type,
      upe.user_id::text AS entity_id,
      'Présence CRM'::text AS entity_label,
      jsonb_build_object(
        'source', upe.source,
        'session_id', upe.session_id,
        'state', upe.metadata ->> 'state',
        'previous_state', upe.metadata ->> 'previous_state',
        'reason', upe.metadata ->> 'reason'
      ) AS entity_meta,
      upe.user_id AS actor_user_id,
      COALESCE(NULLIF(trim(concat(u.firstname, ' ', u.lastname)), ''), u.code_gestionnaire, u.username, u.email, 'Utilisateur') AS actor_display,
      u.code_gestionnaire AS actor_code,
      u.color AS actor_color,
      upe.occurred_at,
      ARRAY[]::text[] AS changed_fields,
      '{}'::jsonb AS old_values,
      upe.metadata AS new_values,
      NULL::text AS related_entity_id
    FROM public.user_presence_events upe
    LEFT JOIN public.users u ON u.id = upe.user_id
    WHERE upe.occurred_at >= p_date_start
      AND upe.occurred_at <= p_date_end
  ),
  filtered AS (
    SELECT *
    FROM feed
    WHERE (p_user_ids     IS NULL OR actor_user_id = ANY(p_user_ids))
      AND (p_action_types IS NULL OR action_type   = ANY(p_action_types))
      AND (p_entity_types IS NULL OR entity_type    = ANY(p_entity_types))
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM filtered),
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id',                f.id,
        'action_type',       f.action_type,
        'entity_type',       f.entity_type,
        'entity_id',         f.entity_id,
        'entity_label',      f.entity_label,
        'entity_meta',       f.entity_meta,
        'occurred_at',       f.occurred_at,
        'changed_fields',    f.changed_fields,
        'old_values',        f.old_values,
        'new_values',        f.new_values,
        'related_entity_id', f.related_entity_id,
        'actor', jsonb_build_object(
          'user_id', f.actor_user_id,
          'display', f.actor_display,
          'code',    f.actor_code,
          'color',   f.actor_color
        )
      ) ORDER BY f.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT *
        FROM filtered
        ORDER BY occurred_at DESC
        LIMIT GREATEST(p_limit, 0)
        OFFSET GREATEST(p_offset, 0)
      ) f
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated;

COMMENT ON FUNCTION public.get_global_activity_feed IS
  'Flux global des actions (interventions + artisans + présence CRM) sur une periode, avec auteur, related_entity_id, filtres et pagination. Reserve au role dev.';
