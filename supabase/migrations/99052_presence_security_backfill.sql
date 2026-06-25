-- ========================================
-- Présence CRM : verrouillage sécurité + backfill + ping dédié
-- ----------------------------------------
-- Correctif de la migration 99051 :
--  1) Les RPC de présence qui écrivent l'état d'un user (record_user_presence_event,
--     check_inactive_users) ne doivent être appelables QUE par le serveur
--     (service_role via supabaseAdmin, ou pg_cron). Les DEFAULT PRIVILEGES du projet
--     (00001_clean_schema.sql) accordent EXECUTE à anon/authenticated sur TOUTE
--     nouvelle fonction → un simple retrait de GRANT ne suffit pas, il faut REVOKE
--     nominatif (PUBLIC + anon + authenticated) puis GRANT service_role.
--  2) Défense en profondeur : un client authentifié ne peut écrire que sa propre
--     présence (garde auth.uid()).
--  3) Nouveau kind PRESENCE_PING : ping d'activité 60 s qui rafraîchit last_active_at
--     sans polluer le journal (jamais loggé), distinct de PRESENCE_RESUME (vraie reprise).
--  4) Backfill : 99051 pose presence_state DEFAULT 'offline' sur tous les users →
--     les gestionnaires déjà connectés apparaîtraient gris jusqu'au prochain ping.
-- ========================================

-- 1) Étendre le CHECK kind pour accueillir PRESENCE_PING
ALTER TABLE public.user_presence_events
  DROP CONSTRAINT IF EXISTS user_presence_events_kind_check;

ALTER TABLE public.user_presence_events
  ADD CONSTRAINT user_presence_events_kind_check
  CHECK (kind IN (
    'AUTH_LOGIN',
    'PRESENCE_START',
    'PRESENCE_RESUME',
    'PRESENCE_PING',
    'IDLE_START',
    'PRESENCE_END'
  ));

-- 2) Redéfinir record_user_presence_event : garde d'autorisation + PRESENCE_PING
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
  -- Défense en profondeur : un appel client authentifié ne peut écrire QUE sa
  -- propre présence. auth.uid() IS NULL en contexte service_role (serveur/cron) →
  -- les chemins serveur ne sont jamais bloqués.
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

  -- Déduplication : on ne journalise que les transitions significatives.
  -- PRESENCE_PING n'est JAMAIS loggé : il sert seulement à rafraîchir last_active_at.
  IF p_kind = 'PRESENCE_PING' THEN
    v_should_log := false;
  ELSIF p_kind IN ('AUTH_LOGIN', 'PRESENCE_START') AND v_prev_state <> 'offline' THEN
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

COMMENT ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) IS
  'Met à jour la présence CRM et journalise uniquement les transitions significatives. Serveur uniquement (service_role) ; garde auth.uid() pour la défense en profondeur. PRESENCE_PING rafraîchit l''activité sans être journalisé.';

-- 3) Verrouillage des privilèges : RPC de présence appelables par le serveur seul
--    (REVOKE nominatif car les DEFAULT PRIVILEGES exposent à anon/authenticated)

-- record_user_presence_event : écrit l'état → service_role uniquement
REVOKE ALL ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_presence_event(uuid, text, text, text, uuid, jsonb, timestamptz) TO service_role;

-- check_inactive_users : bascule idle/offline en masse → serveur / pg_cron uniquement
REVOKE ALL ON FUNCTION public.check_inactive_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_inactive_users() TO service_role;

-- get_global_activity_feed : garde interne user_has_role('dev') déjà présente ;
-- on retire l'exposition anon/PUBLIC par hygiène, on conserve authenticated.
REVOKE ALL ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated, service_role;

-- 4) Backfill : repartir d'un état cohérent pour les gestionnaires déjà connectés.
--    99051 a posé presence_state='offline' par défaut ; on réaligne sur le statut auth
--    et on amorce last_active_at (sinon le cron retomberait sur last_seen_at).
UPDATE public.users
SET
  presence_state = 'active',
  last_active_at = COALESCE(last_active_at, last_seen_at, now()),
  presence_state_changed_at = now()
WHERE status IN ('connected', 'busy', 'dnd')
  AND presence_state = 'offline';
