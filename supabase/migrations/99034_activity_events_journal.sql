-- ============================================================
-- Migration 99034: Journal d'événements d'activité (temps d'écran précis)
--
-- Remplace le calcul de durée côté client (table user_page_sessions, sujette
-- aux sessions fantômes de veille et aux orphelines) par un JOURNAL
-- D'ÉVÉNEMENTS horodaté SERVEUR. Le client n'émet que des événements ; les
-- durées sont recalculées côté serveur en bornant chaque intervalle par un
-- MAX_GAP (≈ heartbeat), ce qui exclut structurellement la veille, le temps
-- offline et les orphelines.
--
-- L'algorithme est le miroir exact de src/lib/monitoring/active-time.ts
-- (testé à 100 %). Cf. docs/maintenance/monitoring.md.
--
-- Cette migration ne touche PAS user_page_sessions ni les RPC existantes :
-- la bascule des RPC (lecture events >= cutover, sessions avant) est faite
-- dans une migration ultérieure une fois la collecte d'événements en place.
-- ============================================================

-- ========================================
-- 1) TABLE: user_activity_events (append-only)
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Regroupe une "session navigateur" (un onglet / une connexion) → trace les reconnexions.
  session_id      uuid NOT NULL,
  kind            text NOT NULL CHECK (kind IN (
                    'connect','heartbeat','page','idle','hidden','visible','focus','blur','disconnect'
                  )),
  page_name       text,
  intervention_id text,
  -- Horodatage SERVEUR = source de vérité du calcul (défaut now()).
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  -- Horodatage CLIENT = diagnostic uniquement, jamais utilisé pour les durées.
  client_ts       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uae_user_time ON public.user_activity_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_uae_session  ON public.user_activity_events (session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_uae_time     ON public.user_activity_events (occurred_at DESC);

COMMENT ON TABLE public.user_activity_events IS
  'Journal append-only des événements d''activité (temps d''écran). Durées recalculées côté serveur (cf. monitoring_active_intervals).';
COMMENT ON COLUMN public.user_activity_events.occurred_at IS
  'Horodatage serveur (défaut now()) — source de vérité du calcul de durée.';
COMMENT ON COLUMN public.user_activity_events.client_ts IS
  'Horodatage client — diagnostic uniquement, jamais utilisé pour le calcul.';

-- ========================================
-- 2) RLS (calquée sur user_page_sessions, cf. 00088)
-- ========================================
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uae_admin_full_access ON public.user_activity_events;
CREATE POLICY uae_admin_full_access ON public.user_activity_events
  FOR ALL TO authenticated
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

DROP POLICY IF EXISTS uae_user_own_events ON public.user_activity_events;
CREATE POLICY uae_user_own_events ON public.user_activity_events
  FOR ALL TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());

-- ========================================
-- 3) FONCTION: monitoring_active_intervals
--    Miroir SQL de computeActiveIntervals (active-time.ts).
--    Pour chaque marqueur ACTIF d'une session, crédite l'écart jusqu'à
--    l'événement suivant, plafonné à 90 s (anti-veille/crash).
--    Helper interne : NON accordé à authenticated (appelé par les RPC
--    SECURITY DEFINER qui portent leurs propres gardes de rôle).
-- ========================================
CREATE OR REPLACE FUNCTION public.monitoring_active_intervals(
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
  WITH ordered AS (
    SELECT
      e.user_id,
      e.page_name,
      e.intervention_id,
      e.kind,
      e.occurred_at,
      LEAD(e.occurred_at) OVER (
        PARTITION BY e.session_id ORDER BY e.occurred_at, e.id
      ) AS next_at
    FROM public.user_activity_events e
    WHERE e.occurred_at >= p_from
      AND e.occurred_at <  p_to
      AND (p_user_id IS NULL OR e.user_id = p_user_id)
  )
  SELECT
    o.user_id,
    o.page_name,
    o.intervention_id,
    o.occurred_at AS started_at,
    o.occurred_at + LEAST(o.next_at - o.occurred_at, interval '90 seconds') AS ended_at,
    (EXTRACT(EPOCH FROM LEAST(o.next_at - o.occurred_at, interval '90 seconds')) * 1000)::bigint AS duration_ms
  FROM ordered o
  WHERE o.next_at IS NOT NULL
    AND o.next_at > o.occurred_at
    AND o.kind IN ('connect','heartbeat','page','visible','focus');
$$;

COMMENT ON FUNCTION public.monitoring_active_intervals(timestamptz, timestamptz, uuid) IS
  'Intervalles de temps actif derives du journal d''evenements (bornage MAX_GAP=90s). Miroir de active-time.ts. p_user_id NULL = toute l''equipe. Helper des RPC monitoring.';

REVOKE ALL ON FUNCTION public.monitoring_active_intervals(timestamptz, timestamptz, uuid) FROM PUBLIC;
