-- ========================================
-- Migration 00079: Trigger simple sur intervention_status_transitions
-- ========================================
-- Recalcule le statut artisan quand une transition de statut est insérée
-- Plus fiable que le trigger sur interventions (pas de problème RLS)

-- Fonction trigger
CREATE OR REPLACE FUNCTION fn_recalculate_artisan_on_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terminated_codes text[] := ARRAY['TERMINE', 'INTER_TERMINEE'];
  v_artisan_id uuid;
BEGIN
  -- Ne recalculer que si la transition implique un statut terminé
  IF NOT (
    NEW.from_status_code = ANY(v_terminated_codes)
    OR NEW.to_status_code = ANY(v_terminated_codes)
  ) THEN
    RETURN NEW;
  END IF;

  -- Recalculer pour chaque artisan lié à l'intervention
  FOR v_artisan_id IN
    SELECT DISTINCT ia.artisan_id
    FROM intervention_artisans ia
    WHERE ia.intervention_id = NEW.intervention_id
      AND ia.artisan_id IS NOT NULL
  LOOP
    PERFORM recalculate_artisan_status(v_artisan_id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trg_recalculate_artisan_on_transition ON intervention_status_transitions;

-- Créer le nouveau trigger
CREATE TRIGGER trg_recalculate_artisan_on_transition
  AFTER INSERT ON intervention_status_transitions
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalculate_artisan_on_transition();

COMMENT ON FUNCTION fn_recalculate_artisan_on_transition() IS
'Recalcule le statut artisan après chaque transition de statut intervention (via intervention_status_transitions)';
