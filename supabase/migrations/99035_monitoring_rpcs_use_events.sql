-- ============================================================
-- Migration 99035: bascule des RPC monitoring sur le journal d'événements
--
-- Les 4 RPC qui dérivaient le « temps d'écran » de user_page_sessions lisent
-- désormais une source UNIFIÉE : monitoring_screen_rows = sessions legacy
-- (historique, durée réelle) ∪ sessions reconstituées depuis le journal
-- d'événements (durées recalculées côté serveur, bornées à MAX_GAP=90s).
--
-- Comportement ADDITIF et sans rupture :
--  - Dates historiques (aucun événement) → identique à avant (sessions legacy).
--  - Dates avec événements → temps d'écran précis (veille/offline/orphelines
--    exclues structurellement).
--  - Contrat JSON de sortie INCHANGÉ → aucune page monitoring à retoucher.
--
-- La sessionisation (gaps & islands) est le miroir de
-- sessionizeIntervals() dans src/lib/monitoring/active-time.ts (testé).
-- ============================================================

-- ========================================
-- 0) Source unifiée : sessions legacy ∪ événements sessionisés
-- ========================================
CREATE OR REPLACE FUNCTION public.monitoring_screen_rows(
  p_from    timestamptz,
  p_to      timestamptz,
  p_user_id uuid DEFAULT NULL   -- NULL = toute l'equipe
)
RETURNS TABLE (
  user_id         uuid,
  page_name       text,
  intervention_id text,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_ms     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- (a) Sessions legacy (historique) avec une duree reelle
  SELECT
    ups.user_id,
    ups.page_name,
    ups.intervention_id,
    ups.started_at,
    COALESCE(ups.ended_at, ups.started_at) AS ended_at,
    ups.duration_ms::bigint                AS duration_ms
  FROM public.user_page_sessions ups
  WHERE ups.started_at >= p_from
    AND ups.started_at <  p_to
    AND ups.duration_ms IS NOT NULL
    AND (p_user_id IS NULL OR ups.user_id = p_user_id)

  UNION ALL

  -- (b) Sessions reconstituees depuis le journal d'evenements (gaps & islands)
  SELECT
    g.user_id,
    g.page_name,
    g.intervention_id,
    MIN(g.started_at)        AS started_at,
    MAX(g.ended_at)          AS ended_at,
    SUM(g.duration_ms)::bigint AS duration_ms
  FROM (
    SELECT
      iv.user_id, iv.page_name, iv.intervention_id,
      iv.started_at, iv.ended_at, iv.duration_ms,
      SUM(iv.is_new) OVER (
        PARTITION BY iv.user_id, iv.page_name, COALESCE(iv.intervention_id, '')
        ORDER BY iv.started_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS grp
    FROM (
      SELECT
        m.user_id, m.page_name, m.intervention_id,
        m.started_at, m.ended_at, m.duration_ms,
        CASE
          WHEN m.started_at <= LAG(m.ended_at) OVER (
                 PARTITION BY m.user_id, m.page_name, COALESCE(m.intervention_id, '')
                 ORDER BY m.started_at)
          THEN 0 ELSE 1
        END AS is_new
      FROM public.monitoring_active_intervals(p_from, p_to, p_user_id) m
    ) iv
  ) g
  GROUP BY g.user_id, g.page_name, g.intervention_id, g.grp;
$$;

COMMENT ON FUNCTION public.monitoring_screen_rows(timestamptz, timestamptz, uuid) IS
  'Source unifiee du temps d''ecran : sessions legacy (user_page_sessions) UNION sessions reconstituees du journal d''evenements (sessionizees). Utilisee par les RPC monitoring.';

REVOKE ALL ON FUNCTION public.monitoring_screen_rows(timestamptz, timestamptz, uuid) FROM PUBLIC;

-- ========================================
-- 1) get_user_daily_activity (source = monitoring_screen_rows)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_user_daily_activity(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'first_seen_at', (
      SELECT MIN(started_at) FROM public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz, p_user_id)
      WHERE user_id = p_user_id AND started_at::date = p_date
    ),
    'last_seen_at', (
      SELECT MAX(COALESCE(ended_at, started_at)) FROM public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz, p_user_id)
      WHERE user_id = p_user_id AND started_at::date = p_date
    ),
    'total_screen_time_ms', (
      SELECT COALESCE(SUM(duration_ms), 0) FROM public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz, p_user_id)
      WHERE user_id = p_user_id AND started_at::date = p_date AND duration_ms IS NOT NULL
    ),
    'pages', (
      SELECT COALESCE(jsonb_agg(page_stat ORDER BY total_ms DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'page_name', page_name,
          'total_duration_ms', SUM(COALESCE(duration_ms, 0)),
          'visit_count', COUNT(*)
        ) AS page_stat, SUM(COALESCE(duration_ms, 0)) AS total_ms
        FROM public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz, p_user_id)
        WHERE user_id = p_user_id AND started_at::date = p_date
        GROUP BY page_name
      ) sub
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'page_name', ups.page_name,
        'started_at', ups.started_at,
        'ended_at', COALESCE(ups.ended_at, ups.started_at + interval '1 minute'),
        'duration_ms', COALESCE(ups.duration_ms, 60000)
      ) ORDER BY ups.started_at), '[]'::jsonb)
      FROM public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz, p_user_id) ups
      WHERE ups.user_id = p_user_id AND ups.started_at::date = p_date
    ),
    'intervention_actions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action_type', action_type,
        'count', cnt
      ) ORDER BY cnt DESC), '[]'::jsonb)
      FROM (
        SELECT action_type, COUNT(*) AS cnt
        FROM public.intervention_audit_log
        WHERE actor_user_id = p_user_id AND occurred_at::date = p_date
        GROUP BY action_type
      ) sub2
    ),
    'interventions_created', (
      SELECT COUNT(*) FROM public.intervention_audit_log
      WHERE actor_user_id = p_user_id AND action_type = 'CREATE' AND occurred_at::date = p_date
    ),
    'interventions_completed', (
      SELECT COUNT(*) FROM public.intervention_status_transitions
      WHERE changed_by_user_id = p_user_id
        AND to_status_code = 'INTER_TERMINEE'
        AND transition_date::date = p_date
    ),
    'devis_sent', (
      SELECT COUNT(*) FROM public.intervention_status_transitions
      WHERE changed_by_user_id = p_user_id
        AND to_status_code = 'DEVIS_ENVOYE'
        AND transition_date::date = p_date
    ),
    'recent_actions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action_type', sub3.action_type,
        'entity_type', sub3.entity_type,
        'entity_id', sub3.entity_id,
        'entity_label', sub3.entity_label,
        'entity_meta', sub3.entity_meta,
        'occurred_at', sub3.occurred_at,
        'changed_fields', sub3.changed_fields,
        'old_values', sub3.old_values,
        'new_values', sub3.new_values
      ) ORDER BY sub3.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ial.action_type,
          'intervention'::text AS entity_type,
          ial.intervention_id AS entity_id,
          i.reference_agence AS entity_label,
          jsonb_build_object(
            'id_inter', i.id_inter,
            'date', i.date,
            'statut_code', ist.code,
            'statut_label', ist.label,
            'statut_color', ist.color
          ) AS entity_meta,
          ial.occurred_at,
          ial.changed_fields,
          ial.old_values,
          ial.new_values
        FROM public.intervention_audit_log ial
        LEFT JOIN public.interventions i ON i.id = ial.intervention_id
        LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
        WHERE ial.actor_user_id = p_user_id AND ial.occurred_at::date = p_date

        UNION ALL

        SELECT
          aal.action_type,
          'artisan'::text AS entity_type,
          aal.artisan_id AS entity_id,
          COALESCE(a.raison_sociale, CONCAT(a.prenom, ' ', a.nom)) AS entity_label,
          jsonb_build_object(
            'nom', a.nom,
            'prenom', a.prenom,
            'raison_sociale', a.raison_sociale,
            'statut_code', ast.code,
            'statut_label', ast.label,
            'statut_color', ast.color
          ) AS entity_meta,
          aal.occurred_at,
          aal.changed_fields,
          aal.old_values,
          aal.new_values
        FROM public.artisan_audit_log aal
        LEFT JOIN public.artisans a ON a.id = aal.artisan_id
        LEFT JOIN public.artisan_statuses ast ON ast.id = a.statut_id
        WHERE aal.actor_user_id = p_user_id AND aal.occurred_at::date = p_date

        ORDER BY occurred_at DESC
        LIMIT 200
      ) sub3
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ========================================
-- 2) get_team_daily_overview (source = monitoring_screen_rows)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_team_daily_overview(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(user_data ORDER BY total_screen_time_ms DESC), '[]'::jsonb)
    FROM (
      SELECT
        u.id AS user_id,
        u.firstname,
        u.lastname,
        u.color,
        u.avatar_url,
        u.status,
        u.code_gestionnaire,
        MIN(ups.started_at) AS first_seen_at,
        COALESCE(SUM(ups.duration_ms), 0) AS total_screen_time_ms,
        (SELECT COUNT(*) FROM public.intervention_audit_log ial
         WHERE ial.actor_user_id = u.id AND ial.occurred_at::date = p_date) AS total_actions,
        (SELECT COUNT(*) FROM public.intervention_audit_log ial
         WHERE ial.actor_user_id = u.id AND ial.action_type = 'CREATE' AND ial.occurred_at::date = p_date) AS interventions_created,
        (SELECT COUNT(*) FROM public.intervention_status_transitions ist
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'INTER_TERMINEE'
           AND ist.transition_date::date = p_date) AS interventions_completed,
        (SELECT COUNT(*) FROM public.intervention_status_transitions ist
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'DEVIS_ENVOYE'
           AND ist.transition_date::date = p_date) AS devis_sent,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ial.intervention_id,
          'numero', i.reference_agence
        ) ORDER BY ial.occurred_at DESC), '[]'::jsonb)
         FROM public.intervention_audit_log ial
         JOIN public.interventions i ON i.id = ial.intervention_id
         WHERE ial.actor_user_id = u.id AND ial.action_type = 'CREATE' AND ial.occurred_at::date = p_date
        ) AS created_ids,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ist.intervention_id,
          'numero', i.reference_agence
        ) ORDER BY ist.transition_date DESC), '[]'::jsonb)
         FROM public.intervention_status_transitions ist
         JOIN public.interventions i ON i.id = ist.intervention_id
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'INTER_TERMINEE'
           AND ist.transition_date::date = p_date
        ) AS completed_ids,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ist.intervention_id,
          'numero', i.reference_agence
        ) ORDER BY ist.transition_date DESC), '[]'::jsonb)
         FROM public.intervention_status_transitions ist
         JOIN public.interventions i ON i.id = ist.intervention_id
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'DEVIS_ENVOYE'
           AND ist.transition_date::date = p_date
        ) AS devis_ids
      FROM public.users u
      JOIN public.monitoring_screen_rows((p_date - 1)::timestamptz, (p_date + 2)::timestamptz) ups
        ON ups.user_id = u.id AND ups.started_at::date = p_date
      WHERE u.archived_at IS NULL
      GROUP BY u.id
    ) sub
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'user_id', sub.user_id,
        'firstname', sub.firstname,
        'lastname', sub.lastname,
        'color', sub.color,
        'avatar_url', sub.avatar_url,
        'status', sub.status,
        'code_gestionnaire', sub.code_gestionnaire,
        'first_seen_at', sub.first_seen_at,
        'total_screen_time_ms', sub.total_screen_time_ms,
        'total_actions', sub.total_actions,
        'interventions_created', sub.interventions_created,
        'interventions_completed', sub.interventions_completed,
        'devis_sent', sub.devis_sent,
        'created_ids', sub.created_ids,
        'completed_ids', sub.completed_ids,
        'devis_ids', sub.devis_ids
      ) AS user_data
    ) lat
  );
END;
$$;

-- ========================================
-- 3) get_team_weekly_stats (source = monitoring_screen_rows)
-- ========================================
CREATE OR REPLACE FUNCTION public.get_team_weekly_stats(
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(user_data ORDER BY total_screen_time_ms DESC), '[]'::jsonb)
    FROM (
      SELECT
        u.id AS user_id,
        u.firstname,
        u.lastname,
        u.color,
        u.avatar_url,
        u.code_gestionnaire,
        COUNT(DISTINCT ups.started_at::date) AS days_active,
        COALESCE(SUM(ups.duration_ms), 0) AS total_screen_time_ms,
        CASE
          WHEN COUNT(DISTINCT ups.started_at::date) > 0
          THEN COALESCE(SUM(ups.duration_ms), 0) / COUNT(DISTINCT ups.started_at::date)
          ELSE 0
        END AS avg_daily_screen_time_ms,
        (SELECT COUNT(*) FROM public.intervention_audit_log ial
         WHERE ial.actor_user_id = u.id AND ial.action_type = 'CREATE'
           AND ial.occurred_at::date BETWEEN p_start_date AND p_end_date) AS interventions_created,
        (SELECT COUNT(*) FROM public.intervention_status_transitions ist
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'INTER_TERMINEE'
           AND ist.transition_date::date BETWEEN p_start_date AND p_end_date) AS interventions_completed,
        (SELECT COUNT(*) FROM public.intervention_status_transitions ist
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'DEVIS_ENVOYE'
           AND ist.transition_date::date BETWEEN p_start_date AND p_end_date) AS devis_sent,
        (SELECT COUNT(*) FROM public.intervention_audit_log ial
         WHERE ial.actor_user_id = u.id
           AND ial.occurred_at::date BETWEEN p_start_date AND p_end_date) AS total_actions,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'date', ds.day_date,
          'first_seen_at', ds.first_seen_at,
          'screen_time_ms', ds.screen_time_ms,
          'created', (SELECT COUNT(*) FROM public.intervention_audit_log ial3
                      WHERE ial3.actor_user_id = u.id AND ial3.action_type = 'CREATE'
                        AND ial3.occurred_at::date = ds.day_date),
          'completed', (SELECT COUNT(*) FROM public.intervention_status_transitions ist3
                        WHERE ist3.changed_by_user_id = u.id
                          AND ist3.to_status_code = 'INTER_TERMINEE'
                          AND ist3.transition_date::date = ds.day_date),
          'devis', (SELECT COUNT(*) FROM public.intervention_status_transitions ist3
                    WHERE ist3.changed_by_user_id = u.id
                      AND ist3.to_status_code = 'DEVIS_ENVOYE'
                      AND ist3.transition_date::date = ds.day_date),
          'actions', (SELECT COUNT(*) FROM public.intervention_audit_log ial3
                      WHERE ial3.actor_user_id = u.id
                        AND ial3.occurred_at::date = ds.day_date),
          'pages', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'page', p_sub.page_name,
                     'duration_ms', p_sub.page_dur
                   ) ORDER BY p_sub.page_dur DESC), '[]'::jsonb)
                   FROM (
                     SELECT page_name, SUM(COALESCE(duration_ms, 0)) AS page_dur
                     FROM public.monitoring_screen_rows((p_start_date - 1)::timestamptz, (p_end_date + 2)::timestamptz, u.id)
                     WHERE user_id = u.id AND started_at::date = ds.day_date
                     GROUP BY page_name
                   ) p_sub)
        ) ORDER BY ds.day_date), '[]'::jsonb)
        FROM (
          SELECT
            ups2.started_at::date AS day_date,
            MIN(ups2.started_at) AS first_seen_at,
            COALESCE(SUM(ups2.duration_ms), 0) AS screen_time_ms
          FROM public.monitoring_screen_rows((p_start_date - 1)::timestamptz, (p_end_date + 2)::timestamptz, u.id) ups2
          WHERE ups2.user_id = u.id
            AND ups2.started_at::date BETWEEN p_start_date AND p_end_date
          GROUP BY ups2.started_at::date
        ) ds
        ) AS daily_breakdown
      FROM public.users u
      JOIN public.monitoring_screen_rows((p_start_date - 1)::timestamptz, (p_end_date + 2)::timestamptz) ups
        ON ups.user_id = u.id AND ups.started_at::date BETWEEN p_start_date AND p_end_date
      WHERE u.archived_at IS NULL
      GROUP BY u.id
    ) sub
    CROSS JOIN LATERAL (
      SELECT jsonb_build_object(
        'user_id', sub.user_id,
        'firstname', sub.firstname,
        'lastname', sub.lastname,
        'color', sub.color,
        'avatar_url', sub.avatar_url,
        'code_gestionnaire', sub.code_gestionnaire,
        'days_active', sub.days_active,
        'total_screen_time_ms', sub.total_screen_time_ms,
        'avg_daily_screen_time_ms', sub.avg_daily_screen_time_ms,
        'interventions_created', sub.interventions_created,
        'interventions_completed', sub.interventions_completed,
        'devis_sent', sub.devis_sent,
        'total_actions', sub.total_actions,
        'daily_breakdown', sub.daily_breakdown
      ) AS user_data
    ) lat
  );
END;
$$;

-- ========================================
-- 4) get_team_connections (source = monitoring_screen_rows) — reserve dev
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
          FROM public.monitoring_screen_rows((p_date_start - 1)::timestamptz, (p_date_end + 2)::timestamptz, u.id) ups
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
        FROM public.monitoring_screen_rows((p_date_start - 1)::timestamptz, (p_date_end + 2)::timestamptz, u.id) ups2
        WHERE ups2.user_id = u.id
          AND ups2.started_at::date >= p_date_start
          AND ups2.started_at::date <= p_date_end
      )
  ) users_sub;

  RETURN result;
END;
$$;
