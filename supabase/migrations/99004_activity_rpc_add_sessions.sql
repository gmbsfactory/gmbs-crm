-- ========================================
-- Add raw sessions to get_user_daily_activity
-- ========================================
-- Ajoute le champ `sessions` contenant les sessions brutes
-- (page_name, started_at, ended_at, duration_ms) pour
-- alimenter le timeline horizontal Apple Screen Time-style.

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
      SELECT MIN(started_at) FROM public.user_page_sessions
      WHERE user_id = p_user_id AND started_at::date = p_date
    ),
    'last_seen_at', (
      SELECT MAX(COALESCE(ended_at, started_at)) FROM public.user_page_sessions
      WHERE user_id = p_user_id AND started_at::date = p_date
    ),
    'total_screen_time_ms', (
      SELECT COALESCE(SUM(duration_ms), 0) FROM public.user_page_sessions
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
        FROM public.user_page_sessions
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
      FROM public.user_page_sessions ups
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
