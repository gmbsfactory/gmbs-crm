-- ========================================
-- Add daily breakdown to get_team_weekly_stats
-- ========================================
-- Ajoute un champ daily_breakdown a chaque membre : tableau de jours
-- avec first_seen_at, screen_time, stats, et repartition par page.

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
        -- Daily breakdown: first build day_date list, then enrich via LATERAL
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
                     FROM public.user_page_sessions
                     WHERE user_id = u.id AND started_at::date = ds.day_date
                     GROUP BY page_name
                   ) p_sub)
        ) ORDER BY ds.day_date), '[]'::jsonb)
        FROM (
          SELECT
            ups2.started_at::date AS day_date,
            MIN(ups2.started_at) AS first_seen_at,
            COALESCE(SUM(ups2.duration_ms), 0) AS screen_time_ms
          FROM public.user_page_sessions ups2
          WHERE ups2.user_id = u.id
            AND ups2.started_at::date BETWEEN p_start_date AND p_end_date
          GROUP BY ups2.started_at::date
        ) ds
        ) AS daily_breakdown
      FROM public.users u
      JOIN public.user_page_sessions ups ON ups.user_id = u.id
        AND ups.started_at::date BETWEEN p_start_date AND p_end_date
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
