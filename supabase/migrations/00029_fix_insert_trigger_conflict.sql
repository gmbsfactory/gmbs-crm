-- ========================================
-- Fix du trigger INSERT pour éviter le conflit avec automaticTransitionService
-- ========================================
-- Le trigger log_intervention_status_transition_on_insert créait systématiquement
-- une transition NULL → statut_actuel lors d'un INSERT.
--
-- Problème: automaticTransitionService crée déjà la chaîne complète de transitions
-- (NULL → DEMANDE → ... → statut_final), ce qui causait un doublon.
--
-- Solution: Ne créer la transition de sécurité QUE si aucune transition
-- n'a été créée dans les 2 dernières secondes (indiquant qu'automaticTransitionService
-- n'a pas fait son travail).
-- ========================================

CREATE OR REPLACE FUNCTION log_intervention_status_transition_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  to_status_code text;
  existing_transition_id uuid;
  any_recent_transition_id uuid;
BEGIN
  -- 1. Vérifier si une transition vers ce statut existe déjà (dans les 2 dernières secondes)
  SELECT id INTO existing_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND to_status_id = NEW.statut_id
    AND transition_date > now() - INTERVAL '2 seconds'
  LIMIT 1;

  -- Si une transition vers ce statut existe déjà, ne rien faire
  IF existing_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 2. NOUVEAU: Vérifier si N'IMPORTE QUELLE transition a été créée récemment
  -- Cela indique que automaticTransitionService a fait son travail
  SELECT id INTO any_recent_transition_id
  FROM public.intervention_status_transitions
  WHERE intervention_id = NEW.id
    AND created_at > now() - INTERVAL '2 seconds'
  LIMIT 1;

  -- Si des transitions ont été créées récemment, ne rien faire
  -- (automaticTransitionService a créé la chaîne complète)
  IF any_recent_transition_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Récupérer le code du statut
  SELECT code INTO to_status_code
  FROM public.intervention_statuses
  WHERE id = NEW.statut_id;

  IF to_status_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Créer la transition de sécurité NULL → statut_actuel
  -- (uniquement si automaticTransitionService n'a rien créé)
  INSERT INTO public.intervention_status_transitions (
    intervention_id, from_status_id, to_status_id, from_status_code, to_status_code,
    changed_by_user_id, transition_date, source, metadata
  ) VALUES (
    NEW.id, NULL, NEW.statut_id, NULL, to_status_code, NULL,
    COALESCE(NEW.date, NEW.created_at, now()), 'trigger',
    jsonb_build_object(
      'date_termine', NEW.date_termine,
      'created_at', NEW.created_at,
      'note', 'Transition de sécurité créée par trigger (automaticTransitionService n''a pas créé de transitions)'
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION log_intervention_status_transition_on_insert IS
  'Trigger de sécurité: crée une transition NULL → statut_actuel lors d''un INSERT UNIQUEMENT si automaticTransitionService n''a pas déjà créé de transitions';

-- Le trigger existe déjà, pas besoin de le recréer
-- Il a été créé dans la migration 00010_status_transitions.sql
