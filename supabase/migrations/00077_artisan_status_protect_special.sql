-- ========================================
-- Migration 00077: Protéger les statuts spéciaux
-- ========================================
-- Les statuts suivants ne doivent PAS être modifiés automatiquement :
-- - ARCHIVE / ARCHIVER : artisans archivés
-- - ONE_SHOT : artisans ponctuels
-- - INACTIF : artisans inactifs
-- - CANDIDAT : artisans en cours de validation

CREATE OR REPLACE FUNCTION recalculate_artisan_status(artisan_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terminated_status_ids uuid[];
  v_completed_count int;
  v_current_status_id uuid;
  v_current_status_code text;
  v_new_status_code text;
  v_new_status_id uuid;
  v_protected_statuses text[] := ARRAY['ARCHIVE', 'ARCHIVER', 'ONE_SHOT', 'INACTIF', 'CANDIDAT'];
BEGIN
  -- Vérifier que l'artisan existe
  IF NOT EXISTS(SELECT 1 FROM artisans WHERE id = artisan_uuid) THEN
    RETURN 'ERROR:ARTISAN_NOT_FOUND';
  END IF;

  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO v_terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF v_terminated_status_ids IS NULL OR array_length(v_terminated_status_ids, 1) = 0 THEN
    RETURN 'ERROR:NO_TERMINATED_STATUSES_FOUND';
  END IF;

  -- Récupérer le statut actuel
  SELECT statut_id INTO v_current_status_id
  FROM artisans WHERE id = artisan_uuid;

  -- Récupérer le code du statut actuel
  v_current_status_code := NULL;
  IF v_current_status_id IS NOT NULL THEN
    SELECT code INTO v_current_status_code
    FROM artisan_statuses WHERE id = v_current_status_id;
  END IF;

  -- Statuts protégés : ne pas modifier automatiquement
  IF v_current_status_code = ANY(v_protected_statuses) THEN
    RETURN 'PROTECTED:' || v_current_status_code;
  END IF;

  -- Compter TOUTES les interventions terminées de l'artisan
  SELECT COUNT(*)
  INTO v_completed_count
  FROM intervention_artisans ia
  JOIN interventions i ON i.id = ia.intervention_id
  WHERE ia.artisan_id = artisan_uuid
    AND i.statut_id = ANY(v_terminated_status_ids);

  -- Déterminer le nouveau statut selon les seuils
  IF v_completed_count >= 10 THEN
    v_new_status_code := 'EXPERT';
  ELSIF v_completed_count >= 6 THEN
    v_new_status_code := 'CONFIRME';
  ELSIF v_completed_count >= 3 THEN
    v_new_status_code := 'FORMATION';
  ELSIF v_completed_count >= 1 THEN
    v_new_status_code := 'NOVICE';
  ELSE
    -- 0 intervention terminée = POTENTIEL (downgrade possible)
    v_new_status_code := 'POTENTIEL';
  END IF;

  -- Si pas de changement, on sort
  IF v_new_status_code = v_current_status_code THEN
    RETURN 'NO_CHANGE:' || COALESCE(v_current_status_code, 'NULL') || '(' || v_completed_count || ')';
  END IF;

  -- Récupérer l'ID du nouveau statut
  SELECT id INTO v_new_status_id
  FROM artisan_statuses WHERE code = v_new_status_code;

  IF v_new_status_id IS NULL THEN
    RETURN 'ERROR:STATUS_NOT_FOUND:' || v_new_status_code;
  END IF;

  -- Mettre à jour l'artisan
  UPDATE artisans
  SET statut_id = v_new_status_id, updated_at = now()
  WHERE id = artisan_uuid;

  RETURN 'UPDATED:' || COALESCE(v_current_status_code, 'NULL') || '->' || v_new_status_code || '(' || v_completed_count || ')';

EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR:' || SQLERRM;
END;
$$;

COMMENT ON FUNCTION recalculate_artisan_status(uuid) IS
'Recalcule le statut artisan. Protège ARCHIVE, ARCHIVER, ONE_SHOT, INACTIF, CANDIDAT.';
