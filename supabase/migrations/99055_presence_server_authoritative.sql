-- ========================================
-- Présence CRM : serveur autoritaire + datation au moment métier
-- ----------------------------------------
-- 1) record_user_presence_event :
--    - AUTH_LOGIN est TOUJOURS journalisé (login portail explicite), même si l'état
--      précédent n'est pas 'offline' (avant : jeté par la dédup → faux PRESENCE_START).
--    - Le SERVEUR décide la reprise : un PRESENCE_START reçu alors que la DB est
--      'offline' (reload / onglet endormi >1h) est journalisé comme PRESENCE_RESUME.
--      Le navigateur n'a plus à connaître l'état précédent (stateRef).
-- 2) check_inactive_users : les événements détectés par le cron sont datés au MOMENT
--    MÉTIER (last_active_at + seuil), pas à l'heure de détection. `detected_at` garde
--    la trace de quand le serveur l'a constaté.
-- ========================================

-- 1) RPC d'écriture de présence : serveur autoritaire
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
  v_effective_kind text := p_kind;
  v_should_log boolean := true;
  v_event_id bigint;
BEGIN
  -- Défense en profondeur : un appel client authentifié ne peut écrire QUE sa propre
  -- présence. auth.uid() IS NULL en contexte service_role (serveur/cron) → non bloqué.
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM public.get_public_user_id() THEN
    RAISE EXCEPTION 'forbidden: cannot record presence for another user'
      USING errcode = '42501';
  END IF;

  IF p_state NOT IN ('active', 'idle', 'offline') THEN
    RAISE EXCEPTION 'invalid presence state: %', p_state USING errcode = '22023';
  END IF;

  IF p_kind NOT IN ('AUTH_LOGIN', 'PRESENCE_START', 'PRESENCE_RESUME', 'PRESENCE_PING', 'IDLE_START', 'PRESENCE_END') THEN
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

  -- Serveur autoritaire : un PRESENCE_START reçu alors que la DB est 'offline' est une
  -- vraie reprise (reload / onglet endormi >1h) → journalisé comme PRESENCE_RESUME.
  IF p_kind = 'PRESENCE_START' AND v_prev_state = 'offline' THEN
    v_effective_kind := 'PRESENCE_RESUME';
  END IF;

  -- Déduplication (sur le kind effectif). AUTH_LOGIN n'a AUCUNE condition → toujours
  -- journalisé (login portail explicite). PRESENCE_PING n'est jamais journalisé.
  IF v_effective_kind = 'PRESENCE_PING' THEN
    v_should_log := false;
  ELSIF v_effective_kind = 'PRESENCE_START' AND v_prev_state <> 'offline' THEN
    v_should_log := false;
  ELSIF v_effective_kind = 'IDLE_START' AND v_prev_state = 'idle' THEN
    v_should_log := false;
  ELSIF v_effective_kind = 'PRESENCE_RESUME' AND v_prev_state = 'active' THEN
    v_should_log := false;
  ELSIF v_effective_kind = 'PRESENCE_END' AND v_prev_state = 'offline' THEN
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
      user_id, session_id, kind, source, occurred_at, metadata
    )
    VALUES (
      p_user_id, p_session_id, v_effective_kind, p_source, v_at,
      COALESCE(p_metadata, '{}'::jsonb)
        || jsonb_build_object('previous_state', v_prev_state, 'state', p_state)
        || CASE WHEN v_effective_kind <> p_kind
                THEN jsonb_build_object('requested_kind', p_kind)
                ELSE '{}'::jsonb END
    )
    RETURNING id INTO v_event_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'logged', v_should_log,
    'event_id', v_event_id,
    'previous_state', v_prev_state,
    'effective_kind', v_effective_kind,
    'state', p_state
  );
END;
$$;

COMMENT ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) IS
  'Présence CRM : serveur autoritaire. AUTH_LOGIN toujours journalisé ; PRESENCE_START sur DB offline → PRESENCE_RESUME. Serveur uniquement (service_role) + garde auth.uid().';

-- Re-verrouillage (CREATE OR REPLACE préserve les privilèges, on les ré-affirme par sécurité)
REVOKE ALL ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) TO service_role;

-- 2) Cron d'inactivité : datation au moment métier
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

  -- active/idle → offline (inactivité >= seuil offline)
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
      activity_at + make_interval(mins => v_offline_minutes), -- moment métier réel
      jsonb_build_object(
        'reason', 'offline_threshold',
        'threshold_minutes', v_offline_minutes,
        'previous_state', previous_state,
        'state', 'offline',
        'last_activity_at', activity_at,
        'detected_at', now()
      )
    FROM updated
    RETURNING user_id
  )
  SELECT COUNT(*)::integer, COALESCE(array_agg(user_id::text), ARRAY[]::text[])
    INTO v_offline_count, v_offline_ids
  FROM inserted;

  -- active → idle (inactivité >= seuil idle, < seuil offline)
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
    activity_at + make_interval(mins => v_idle_minutes), -- moment métier réel
    jsonb_build_object(
      'reason', 'idle_threshold',
      'threshold_minutes', v_idle_minutes,
      'previous_state', 'active',
      'state', 'idle',
      'last_activity_at', activity_at,
      'detected_at', now()
    )
  FROM updated;

  RETURN QUERY SELECT v_offline_count, v_offline_ids;
END;
$$;

COMMENT ON FUNCTION public.check_inactive_users IS
  'Bascule active->idle et ->offline selon crm_presence_settings. Événements datés au moment métier (last_active_at + seuil), detected_at en métadonnée.';

REVOKE ALL ON FUNCTION public.check_inactive_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_inactive_users() TO service_role;
