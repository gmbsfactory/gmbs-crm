-- ========================================
-- MIGRATION 99031: Status transitions — trigger single source (PR1b RÉ-APPLICATION)
-- ========================================
-- ⚠️ Pourquoi 99031 : la migration PR1b initiale `99030_status_transitions_trigger_single_source.sql`
--    est entrée en COLLISION de version avec `99030_intervention_import_jobs` (enregistrée
--    en premier dans supabase_migrations.schema_migrations). Conséquence : la PR1b a été
--    SAUTÉE en prod (jamais appliquée). Les 3 fonctions étaient restées dans leur état d'origine
--    (on_insert datant avec NEW.date -> faux 02:00 ; RPC écrivains NON neutralisées).
--    Cette migration ré-applique PR1b sous un numéro non collisionné.
--
-- Contenu (identique à PR1b, non destructif, idempotent) :
--   1) log_intervention_status_transition_on_insert : dater la création à l'heure réelle
--      (created_at/now()) au lieu de NEW.date (faux « 02:00 », date planifiée à minuit TZ Paris).
--   2) No-op des 2 RPC écrivains désormais inutilisées (PR1a) :
--      create_automatic_status_transitions_on_creation, log_status_transition_from_api.
--      Pas de DROP (rollback edge/web plausible). Signatures/attributs identiques aux originales.
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
  'DEPRECATED (fix/status-transitions-single-source): no-op. Le trigger on_insert est l''unique écrivain.';

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
  'DEPRECATED (fix/status-transitions-single-source): no-op. Le trigger safety est l''unique écrivain.';

NOTIFY pgrst, 'reload schema';
