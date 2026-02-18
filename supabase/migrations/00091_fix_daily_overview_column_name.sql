-- ========================================
-- Fix: column name numero_associe -> reference_agence
-- ========================================
-- La migration 00090 utilisait i.numero_associe qui n'existe pas.
-- Le vrai nom de colonne est i.reference_agence.

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
           AND ist.to_status_code IN ('TERMINEE', 'CLOTUREE')
           AND ist.transition_date::date = p_date) AS interventions_completed,
        (SELECT COUNT(*) FROM public.intervention_status_transitions ist
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'DEVIS_ENVOYE'
           AND ist.transition_date::date = p_date) AS devis_sent,
        -- Liste des interventions creees (id + reference)
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ial.intervention_id,
          'numero', i.reference_agence
        ) ORDER BY ial.occurred_at DESC), '[]'::jsonb)
         FROM public.intervention_audit_log ial
         JOIN public.interventions i ON i.id = ial.intervention_id
         WHERE ial.actor_user_id = u.id AND ial.action_type = 'CREATE' AND ial.occurred_at::date = p_date
        ) AS created_ids,
        -- Liste des interventions terminees (id + reference)
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ist.intervention_id,
          'numero', i.reference_agence
        ) ORDER BY ist.transition_date DESC), '[]'::jsonb)
         FROM public.intervention_status_transitions ist
         JOIN public.interventions i ON i.id = ist.intervention_id
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code IN ('TERMINEE', 'CLOTUREE')
           AND ist.transition_date::date = p_date
        ) AS completed_ids,
        -- Liste des interventions devis envoyes (id + reference)
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
      JOIN public.user_page_sessions ups ON ups.user_id = u.id AND ups.started_at::date = p_date
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
