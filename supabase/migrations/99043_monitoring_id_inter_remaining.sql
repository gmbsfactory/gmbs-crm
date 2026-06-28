-- ============================================================================
-- 99043 — Monitoring : id_inter partout (plus reference_agence)
-- ============================================================================
-- 99039 corrigeait get_top_entities, mais get_global_activity_feed,
-- get_user_daily_activity et get_team_daily_overview exposaient encore
-- reference_agence comme libellé/numéro de dossier. On aligne toutes les sorties
-- visibles sur id_inter, avec le fallback provisoire INT-<uuid>.
-- ============================================================================

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
      ial.id,
      ial.action_type,
      'intervention'::text AS entity_type,
      ial.intervention_id AS entity_id,
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
      ial.new_values
    FROM public.intervention_audit_log ial
    LEFT JOIN public.interventions i ON i.id = ial.intervention_id
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE ial.occurred_at >= p_date_start
      AND ial.occurred_at <= p_date_end

    UNION ALL

    SELECT
      aal.id,
      aal.action_type,
      'artisan'::text AS entity_type,
      aal.artisan_id AS entity_id,
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
      aal.new_values
    FROM public.artisan_audit_log aal
    LEFT JOIN public.artisans a ON a.id = aal.artisan_id
    LEFT JOIN public.artisan_statuses ast ON ast.id = a.statut_id
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

CREATE OR REPLACE FUNCTION public.get_user_daily_activity(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'Europe/Paris'
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
          COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8)) AS entity_label,
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

CREATE OR REPLACE FUNCTION public.get_team_daily_overview(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET timezone = 'Europe/Paris'
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
          'numero', COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8))
        ) ORDER BY ial.occurred_at DESC), '[]'::jsonb)
         FROM public.intervention_audit_log ial
         JOIN public.interventions i ON i.id = ial.intervention_id
         WHERE ial.actor_user_id = u.id AND ial.action_type = 'CREATE' AND ial.occurred_at::date = p_date
        ) AS created_ids,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ist.intervention_id,
          'numero', COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8))
        ) ORDER BY ist.transition_date DESC), '[]'::jsonb)
         FROM public.intervention_status_transitions ist
         JOIN public.interventions i ON i.id = ist.intervention_id
         WHERE ist.changed_by_user_id = u.id
           AND ist.to_status_code = 'INTER_TERMINEE'
           AND ist.transition_date::date = p_date
        ) AS completed_ids,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', ist.intervention_id,
          'numero', COALESCE(i.id_inter, 'INT-' || substring(i.id::text, 1, 8))
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

GRANT EXECUTE ON FUNCTION public.get_global_activity_feed(timestamptz, timestamptz, uuid[], text[], text[], int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_daily_activity(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_daily_overview(date) TO authenticated;
