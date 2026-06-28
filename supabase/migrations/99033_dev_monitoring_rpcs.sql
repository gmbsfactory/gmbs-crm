-- ============================================================
-- Migration 99033: RPCs du dashboard "Monitoring DEV"
--
-- Deux fonctions de lecture agregee, reservees au role "dev" :
--   1) get_global_activity_feed  : flux global de TOUTES les actions
--      (interventions + artisans) sur une periode, avec auteur,
--      filtres optionnels et pagination.
--   2) get_team_connections      : horaires de connexion/deconnexion
--      et temps de presence par jour, derives de user_page_sessions.
--
-- Securite : SECURITY DEFINER + guard interne public.user_has_role('dev').
-- Ces RPCs exposent l'audit complet -> acces strictement dev (pas seulement
-- garde cote UI). Le mapping auth->public et le helper de role suivent les
-- conventions existantes (cf. 00037, 00088).
--
-- Style calque sur get_user_daily_activity (99004) et get_team_weekly_stats
-- (00093) : RETURNS jsonb, COALESCE(jsonb_agg(... ORDER BY ...), '[]').
-- ============================================================

-- ========================================
-- 1) Flux d'activite global (interventions + artisans)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_global_activity_feed(
  p_date_start    timestamptz,
  p_date_end      timestamptz,
  p_user_ids      uuid[]  DEFAULT NULL,   -- filtre par auteur (actor_user_id)
  p_action_types  text[]  DEFAULT NULL,   -- filtre par type d'action
  p_entity_types  text[]  DEFAULT NULL,   -- 'intervention' | 'artisan'
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
  -- Guard : reserve au role "dev"
  IF NOT public.user_has_role('dev') THEN
    RAISE EXCEPTION 'forbidden: dev role required' USING errcode = '42501';
  END IF;

  WITH feed AS (
    -- Actions sur interventions
    SELECT
      ial.id,
      ial.action_type,
      'intervention'::text                          AS entity_type,
      ial.intervention_id                           AS entity_id,
      i.reference_agence                            AS entity_label,
      jsonb_build_object(
        'id_inter',     i.id_inter,
        'date',         i.date,
        'statut_code',  ist.code,
        'statut_label', ist.label,
        'statut_color', ist.color
      )                                             AS entity_meta,
      ial.actor_user_id,
      ial.actor_display,
      ial.actor_code,
      ial.actor_color,
      ial.occurred_at,
      ial.changed_fields,
      ial.old_values,
      ial.new_values
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i          ON i.id = ial.intervention_id
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE ial.occurred_at >= p_date_start
      AND ial.occurred_at <= p_date_end

    UNION ALL

    -- Actions sur artisans
    SELECT
      aal.id,
      aal.action_type,
      'artisan'::text                               AS entity_type,
      aal.artisan_id                                AS entity_id,
      COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) AS entity_label,
      jsonb_build_object(
        'nom',           a.nom,
        'prenom',        a.prenom,
        'raison_sociale', a.raison_sociale,
        'statut_code',   ast.code,
        'statut_label',  ast.label,
        'statut_color',  ast.color
      )                                             AS entity_meta,
      aal.actor_user_id,
      aal.actor_display,
      aal.actor_code,
      aal.actor_color,
      aal.occurred_at,
      aal.changed_fields,
      aal.old_values,
      aal.new_values
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a            ON a.id = aal.artisan_id
    LEFT JOIN public.artisan_statuses ast  ON ast.id = a.statut_id
    WHERE aal.occurred_at >= p_date_start
      AND aal.occurred_at <= p_date_end
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
        'id',             f.id,
        'action_type',    f.action_type,
        'entity_type',    f.entity_type,
        'entity_id',      f.entity_id,
        'entity_label',   f.entity_label,
        'entity_meta',    f.entity_meta,
        'occurred_at',    f.occurred_at,
        'changed_fields', f.changed_fields,
        'old_values',     f.old_values,
        'new_values',     f.new_values,
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

COMMENT ON FUNCTION public.get_global_activity_feed IS
  'Flux global des actions (interventions + artisans) sur une periode, avec auteur, filtres et pagination. Reserve au role dev.';

-- ========================================
-- 2) Connexions / deconnexions + presence par jour
--    (derive de user_page_sessions, aucune nouvelle collecte)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_team_connections(
  p_date_start date,
  p_date_end   date,
  p_user_ids   uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Guard : reserve au role "dev"
  IF NOT public.user_has_role('dev') THEN
    RAISE EXCEPTION 'forbidden: dev role required' USING errcode = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(u_obj ORDER BY (u_obj->>'lastname'), (u_obj->>'firstname')), '[]'::jsonb)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'user_id',           u.id,
      'firstname',         u.firstname,
      'lastname',          u.lastname,
      'color',             u.color,
      'avatar_url',        u.avatar_url,
      'code_gestionnaire', u.code_gestionnaire,
      'days', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'date',                 d.day,
          'first_seen_at',        d.first_seen_at,
          'last_seen_at',         d.last_seen_at,
          'total_screen_time_ms', d.total_ms,
          'sessions',             d.sessions
        ) ORDER BY d.day DESC), '[]'::jsonb)
        FROM (
          SELECT
            ups.started_at::date                            AS day,
            MIN(ups.started_at)                             AS first_seen_at,
            MAX(COALESCE(ups.ended_at, ups.started_at))     AS last_seen_at,
            COALESCE(SUM(ups.duration_ms), 0)               AS total_ms,
            COALESCE(jsonb_agg(jsonb_build_object(
              'page_name',   ups.page_name,
              'started_at',  ups.started_at,
              'ended_at',    COALESCE(ups.ended_at, ups.started_at + interval '1 minute'),
              'duration_ms', COALESCE(ups.duration_ms, 60000)
            ) ORDER BY ups.started_at), '[]'::jsonb)        AS sessions
          FROM public.user_page_sessions ups
          WHERE ups.user_id = u.id
            AND ups.started_at::date >= p_date_start
            AND ups.started_at::date <= p_date_end
          GROUP BY ups.started_at::date
        ) d
      )
    ) AS u_obj
    FROM public.users u
    WHERE u.archived_at IS NULL
      AND (p_user_ids IS NULL OR u.id = ANY(p_user_ids))
      AND EXISTS (
        SELECT 1
        FROM public.user_page_sessions ups2
        WHERE ups2.user_id = u.id
          AND ups2.started_at::date >= p_date_start
          AND ups2.started_at::date <= p_date_end
      )
  ) users_sub;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_team_connections IS
  'Horaires de connexion/deconnexion et temps de presence par jour (derive de user_page_sessions). Reserve au role dev.';

-- ========================================
-- 3) Grants (le guard interne assure le dev-only)
-- ========================================
GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_connections(date, date, uuid[]) TO authenticated;

-- ========================================
-- 3) Heatmap d'activité (gestionnaire × bucket temps) — vue Pulse
-- ========================================
CREATE OR REPLACE FUNCTION public.get_activity_heatmap(
  p_date_start timestamptz,
  p_date_end   timestamptz,
  p_bucket     text   DEFAULT 'hour',   -- 'hour' | 'day'
  p_user_ids   uuid[] DEFAULT NULL
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

  WITH base AS (
    SELECT actor_user_id, occurred_at FROM public.intervention_audit_log
    WHERE occurred_at >= p_date_start AND occurred_at <= p_date_end
    UNION ALL
    SELECT actor_user_id, occurred_at FROM public.artisan_audit_log
    WHERE occurred_at >= p_date_start AND occurred_at <= p_date_end
  ),
  filtered AS (
    SELECT * FROM base
    WHERE actor_user_id IS NOT NULL
      AND (p_user_ids IS NULL OR actor_user_id = ANY(p_user_ids))
  ),
  agg AS (
    SELECT
      actor_user_id,
      CASE WHEN p_bucket = 'day'
        THEN to_char(occurred_at::date, 'YYYY-MM-DD')
        ELSE lpad(EXTRACT(hour FROM occurred_at)::int::text, 2, '0')
      END AS bucket,
      COUNT(*) AS cnt
    FROM filtered
    GROUP BY 1, 2
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id',           a.actor_user_id,
    'firstname',         u.firstname,
    'lastname',          u.lastname,
    'color',             u.color,
    'code_gestionnaire', u.code_gestionnaire,
    'bucket',            a.bucket,
    'count',             a.cnt
  )), '[]'::jsonb)
  INTO result
  FROM agg a
  JOIN public.users u ON u.id = a.actor_user_id
  WHERE u.archived_at IS NULL;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_activity_heatmap IS
  'Comptes d''actions par gestionnaire et par bucket (heure ou jour). Réservé au rôle dev.';

-- ========================================
-- 4) Dossiers les plus actifs (top entités) — vue Pulse
-- ========================================
CREATE OR REPLACE FUNCTION public.get_top_entities(
  p_date_start timestamptz,
  p_date_end   timestamptz,
  p_limit      int    DEFAULT 10,
  p_user_ids   uuid[] DEFAULT NULL
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

  WITH base AS (
    SELECT 'intervention'::text AS entity_type, ial.intervention_id AS entity_id,
           i.reference_agence AS label, ial.occurred_at, ial.actor_user_id
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i ON i.id = ial.intervention_id
    WHERE ial.occurred_at >= p_date_start AND ial.occurred_at <= p_date_end
    UNION ALL
    SELECT 'artisan'::text, aal.artisan_id,
           COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)), aal.occurred_at, aal.actor_user_id
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a ON a.id = aal.artisan_id
    WHERE aal.occurred_at >= p_date_start AND aal.occurred_at <= p_date_end
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (p_user_ids IS NULL OR actor_user_id = ANY(p_user_ids))
  ),
  agg AS (
    SELECT entity_type, entity_id, MAX(label) AS label,
           COUNT(*) AS cnt, MAX(occurred_at) AS last_at
    FROM filtered
    GROUP BY entity_type, entity_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entity_type',    t.entity_type,
    'entity_id',      t.entity_id,
    'entity_label',   t.label,
    'count',          t.cnt,
    'last_action_at', t.last_at
  ) ORDER BY t.cnt DESC), '[]'::jsonb)
  INTO result
  FROM (SELECT * FROM agg ORDER BY cnt DESC LIMIT GREATEST(p_limit, 0)) t;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_top_entities IS
  'Entités (interventions/artisans) les plus actives sur la période. Réservé au rôle dev.';

GRANT EXECUTE ON FUNCTION public.get_activity_heatmap(timestamptz, timestamptz, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_entities(timestamptz, timestamptz, int, uuid[]) TO authenticated;
