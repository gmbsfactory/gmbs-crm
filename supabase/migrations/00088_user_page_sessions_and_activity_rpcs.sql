-- ========================================
-- User Page Sessions & Activity Tracking RPCs
-- ========================================
-- Version: 1.0
-- Date: 2026-02-17
-- Description: Table de tracking des sessions par page et RPCs pour
--   les statistiques d'activite des gestionnaires.

-- ========================================
-- 1) TABLE: user_page_sessions
-- ========================================

CREATE TABLE IF NOT EXISTS public.user_page_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  page_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer,
  intervention_id text, -- ID intervention si modal ouvert
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ups_user_date ON public.user_page_sessions (user_id, started_at DESC);
CREATE INDEX idx_ups_page ON public.user_page_sessions (page_name, started_at DESC);
CREATE INDEX idx_ups_date ON public.user_page_sessions (started_at DESC);

COMMENT ON TABLE public.user_page_sessions IS 'Tracking des sessions par page pour le suivi d''activite des gestionnaires';
COMMENT ON COLUMN public.user_page_sessions.duration_ms IS 'Duree de la session en millisecondes, calculee a la fin de la session';
COMMENT ON COLUMN public.user_page_sessions.intervention_id IS 'ID de l''intervention si un modal intervention etait ouvert durant la session';

-- ========================================
-- 2) RLS: user_page_sessions
-- ========================================

ALTER TABLE public.user_page_sessions ENABLE ROW LEVEL SECURITY;

-- Admins ont acces complet (lecture/ecriture)
DROP POLICY IF EXISTS ups_admin_full_access ON public.user_page_sessions;
CREATE POLICY ups_admin_full_access ON public.user_page_sessions
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Chaque utilisateur peut voir et inserer ses propres sessions
DROP POLICY IF EXISTS ups_user_own_sessions ON public.user_page_sessions;
CREATE POLICY ups_user_own_sessions ON public.user_page_sessions
  FOR ALL TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());

-- ========================================
-- 3) RPC: get_user_daily_activity
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
        AND to_status_code IN ('TERMINEE', 'CLOTUREE')
        AND transition_date::date = p_date
    ),
    'recent_actions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action_type', action_type,
        'intervention_id', intervention_id,
        'occurred_at', occurred_at,
        'changed_fields', changed_fields
      ) ORDER BY occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT action_type, intervention_id, occurred_at, changed_fields
        FROM public.intervention_audit_log
        WHERE actor_user_id = p_user_id AND occurred_at::date = p_date
        ORDER BY occurred_at DESC
        LIMIT 50
      ) sub3
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_user_daily_activity(uuid, date) IS
  'Retourne un resume JSON de l''activite quotidienne d''un gestionnaire (temps ecran, pages visitees, actions interventions)';

-- ========================================
-- 4) RPC: get_team_daily_overview
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
           AND ist.to_status_code IN ('TERMINEE', 'CLOTUREE')
           AND ist.transition_date::date = p_date) AS interventions_completed
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
        'interventions_completed', sub.interventions_completed
      ) AS user_data
    ) lat
  );
END;
$$;

COMMENT ON FUNCTION public.get_team_daily_overview(date) IS
  'Retourne un apercu JSON de l''activite de toute l''equipe pour une journee donnee';

-- ========================================
-- 5) RPC: get_team_weekly_stats
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
           AND ist.to_status_code IN ('TERMINEE', 'CLOTUREE')
           AND ist.transition_date::date BETWEEN p_start_date AND p_end_date) AS interventions_completed,
        (SELECT COUNT(*) FROM public.intervention_audit_log ial
         WHERE ial.actor_user_id = u.id
           AND ial.occurred_at::date BETWEEN p_start_date AND p_end_date) AS total_actions
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
        'total_actions', sub.total_actions
      ) AS user_data
    ) lat
  );
END;
$$;

COMMENT ON FUNCTION public.get_team_weekly_stats(date, date) IS
  'Retourne les statistiques hebdomadaires d''activite de l''equipe pour une plage de dates';
