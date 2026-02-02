-- ========================================
-- Migration 00078: Optimiser le trigger de recalcul statut artisan
-- ========================================
-- Ne recalculer que si on ENTRE ou SORT d'un statut terminé
-- (évite les recalculs inutiles sur les autres transitions)

CREATE OR REPLACE FUNCTION fn_trigger_artisan_status_on_intervention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terminated_status_ids uuid[];
  v_artisan_ids uuid[];
  v_artisan_id uuid;
  v_result text;
BEGIN
  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO v_terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF v_terminated_status_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne recalculer que si on ENTRE ou SORT d'un statut terminé
  IF NOT (
    (OLD.statut_id IS NOT NULL AND OLD.statut_id = ANY(v_terminated_status_ids))
    OR (NEW.statut_id IS NOT NULL AND NEW.statut_id = ANY(v_terminated_status_ids))
  ) THEN
    RETURN NEW;
  END IF;

  -- Récupérer tous les artisans liés à cette intervention
  SELECT array_agg(DISTINCT ia.artisan_id)
  INTO v_artisan_ids
  FROM intervention_artisans ia
  WHERE ia.intervention_id = NEW.id
    AND ia.artisan_id IS NOT NULL;

  IF v_artisan_ids IS NULL OR array_length(v_artisan_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Recalculer pour chaque artisan
  FOREACH v_artisan_id IN ARRAY v_artisan_ids
  LOOP
    v_result := recalculate_artisan_status(v_artisan_id);
    RAISE NOTICE 'Artisan % recalculé: %', v_artisan_id, v_result;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_trigger_artisan_status_on_intervention() IS
'Trigger optimisé: recalcule le statut artisan uniquement quand une intervention entre ou sort d''un statut terminé';
