-- ========================================
-- MIGRATION 99030: Status transitions — trigger as single source of truth (PR1b)
-- ========================================
-- Branche : fix/status-transitions-trigger-migration
-- Pré-requis STRICT : PR1a (code) déjà déployée en prod — web + edge
--   interventions-v2 (v20) — et §1E vérifiée (aucune écriture applicative
--   source='api'). Si cette migration passait AVANT le code, l'ancien flux
--   create/upsert web supprimerait encore la ligne trigger pendant que la RPC
--   no-op ne recréerait rien → création sans transition.
--
-- Cette migration (migration-only, non destructive) :
--   1) log_intervention_status_transition_on_insert : dater la transition de
--      création à l'heure réelle (created_at/now()) au lieu de NEW.date, qui
--      produisait un faux horaire « 02:00 » (date planifiée à minuit, TZ Paris).
--   2) Neutraliser EN NO-OP les deux RPC écrivains applicatives, désormais
--      inutilisées depuis PR1a :
--        - create_automatic_status_transitions_on_creation (appelée par l'edge)
--        - log_status_transition_from_api (appelée par le web ET l'edge)
--      PAS de DROP ici (un rollback edge/web reste plausible) — le DROP est
--      repoussé à PR2. Signatures + attributs identiques aux originales pour
--      rester appelables sans erreur par tout client non redéployé ; le retour
--      no-op (0 / NULL) est sûr car PR1a a supprimé les sites qui
--      déréférençaient ces retours.
-- ========================================

-- 1) Trigger insert : dater à l'heure réelle (created_at) au lieu de NEW.date
CREATE OR REPLACE FUNCTION public.log_intervention_status_transition_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
  actor_id uuid;
BEGIN
  IF NEW.statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  actor_id := public.resolve_actor_user_id(NEW.created_by, NEW.updated_by);

  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, NULL, NEW.statut_id, NULL, to_status_code,
    actor_id,
    COALESCE(NEW.created_at, now()),   -- PR1b : heure réelle de création (plus de NEW.date / faux 02:00)
    'trigger',
    jsonb_build_object('date_termine', NEW.date_termine, 'created_at', NEW.created_at,
      'note', 'Auto recorded by trigger on creation')
  );

  RETURN NEW;
END;
$$;

-- 2a) NO-OP : create_automatic_status_transitions_on_creation (appelée par l'edge)
CREATE OR REPLACE FUNCTION public.create_automatic_status_transitions_on_creation(
  p_intervention_id uuid,
  p_to_status_code text,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DEPRECATED : le trigger on_insert est l'unique écrivain (PR1a/PR1b). No-op.
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.create_automatic_status_transitions_on_creation(uuid, text, uuid, jsonb) IS
  'DEPRECATED (fix/status-transitions-single-source): no-op. Le trigger on_insert est l''unique écrivain. À DROP en PR2 une fois edge/web redéployés et le grep des appelants vide.';

-- 2b) NO-OP : log_status_transition_from_api (appelée par le web ET l'edge)
CREATE OR REPLACE FUNCTION public.log_status_transition_from_api(
  p_intervention_id uuid,
  p_from_status_id uuid,
  p_to_status_id uuid,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DEPRECATED : le trigger safety est l'unique écrivain (PR1a/PR1b). No-op.
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.log_status_transition_from_api(uuid, uuid, uuid, uuid, jsonb) IS
  'DEPRECATED (fix/status-transitions-single-source): no-op. Le trigger safety est l''unique écrivain. À DROP en PR2 une fois edge/web redéployés et le grep des appelants vide.';

-- Recharger le cache de schéma PostgREST (par sécurité après REPLACE)
NOTIFY pgrst, 'reload schema';
