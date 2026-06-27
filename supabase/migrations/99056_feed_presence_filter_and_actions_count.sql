-- ========================================
-- Monitoring Dev : cohérence des compteurs d'actions
-- ----------------------------------------
-- 1) get_global_activity_feed : le bloc "présence" ne remonte QUE les événements
--    réellement affichables (Connexion / Déconnexion / Reconnexion). Les IDLE_START,
--    PRESENCE_START, fermetures d'onglet, etc. ne sortent plus de la base : ils ne
--    polluent donc plus le `total` ni la pagination du flux (le filtre était jusque-là
--    fait côté React, trop tard).
-- 2) get_team_weekly_stats : la colonne "Actions" (total_actions + daily_breakdown.actions)
--    compte désormais intervention_audit_log + artisan_audit_log, comme la timeline horaire
--    et le flux — pour que les 3 compteurs reposent sur la même base métier. La présence
--    n'est JAMAIS comptée comme action.
-- ========================================

-- 1) Flux : présence filtrée au SQL
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
      -- Seuls les événements de présence AFFICHABLES remontent (le reste — IDLE_START,
      -- PRESENCE_START, fermeture d'onglet, reprise d'inactivité — reste hors flux).
      AND (
        upe.kind = 'AUTH_LOGIN'
        OR (upe.kind = 'PRESENCE_RESUME' AND upe.metadata ->> 'previous_state' = 'offline')
        OR (upe.kind = 'PRESENCE_END' AND upe.metadata ->> 'reason' IN ('logout', 'offline_threshold'))
      )
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

GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated, service_role;

-- 2) Colonne "Actions" : intervention + artisan (cohérent avec timeline/flux)
CREATE OR REPLACE FUNCTION public.get_team_weekly_stats(p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET "TimeZone" TO 'Europe/Paris'
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
        -- Actions métier = interventions + artisans (la présence n'est jamais comptée)
        ((SELECT COUNT(*) FROM public.intervention_audit_log ial
          WHERE ial.actor_user_id = u.id
            AND ial.occurred_at::date BETWEEN p_start_date AND p_end_date)
         + (SELECT COUNT(*) FROM public.artisan_audit_log aal
          WHERE aal.actor_user_id = u.id
            AND aal.occurred_at::date BETWEEN p_start_date AND p_end_date)) AS total_actions,
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
          'actions', ((SELECT COUNT(*) FROM public.intervention_audit_log ial3
                       WHERE ial3.actor_user_id = u.id
                         AND ial3.occurred_at::date = ds.day_date)
                      + (SELECT COUNT(*) FROM public.artisan_audit_log aal3
                       WHERE aal3.actor_user_id = u.id
                         AND aal3.occurred_at::date = ds.day_date)),
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
