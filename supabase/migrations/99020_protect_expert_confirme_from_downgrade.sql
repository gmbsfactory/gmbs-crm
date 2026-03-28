-- ========================================
-- Migration 99020: Protection EXPERT, CONFIRME et FORMATION contre le downgrade automatique
-- ========================================
-- CONTEXTE : lors d'un import depuis Google Sheets, toutes les interventions
-- ne sont pas nécessairement importées. Un artisan EXPERT, CONFIRME ou FORMATION
-- dans le sheet peut se retrouver avec moins d'interventions terminées en base
-- que ce que ses seuils requièrent, entraînant un downgrade injustifié.
--
-- RÈGLE : recalculate_artisan_status() ne peut qu'upgrader EXPERT, CONFIRME
-- et FORMATION, jamais les rétrograder. Seule une action manuelle peut downgrader
-- ces statuts.
--
-- Hiérarchie des protections :
--   ARCHIVE   : gelé totalement (aucune modification automatique)
--   EXPERT    : upgrade uniquement (ne peut pas descendre)
--   CONFIRME  : upgrade uniquement vers EXPERT (ne peut pas descendre)
--   FORMATION : upgrade uniquement vers CONFIRME ou EXPERT (ne peut pas descendre)
-- ========================================

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
  -- Statuts gelés : pas de modification automatique possible
  v_frozen_statuses text[] := ARRAY['ARCHIVE', 'ARCHIVER'];
  -- Ordre des statuts (du plus bas au plus haut) pour comparer
  -- FORMATION=3, CONFIRME=4, EXPERT=5
BEGIN
  -- Verifier que l'artisan existe
  IF NOT EXISTS(SELECT 1 FROM artisans WHERE id = artisan_uuid) THEN
    RETURN 'ERROR:ARTISAN_NOT_FOUND';
  END IF;

  -- Recuperer les IDs des statuts termines
  SELECT array_agg(id)
  INTO v_terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF v_terminated_status_ids IS NULL OR array_length(v_terminated_status_ids, 1) = 0 THEN
    RETURN 'ERROR:NO_TERMINATED_STATUSES_FOUND';
  END IF;

  -- Recuperer le statut actuel
  SELECT statut_id INTO v_current_status_id
  FROM artisans WHERE id = artisan_uuid;

  -- Recuperer le code du statut actuel
  v_current_status_code := NULL;
  IF v_current_status_id IS NOT NULL THEN
    SELECT code INTO v_current_status_code
    FROM artisan_statuses WHERE id = v_current_status_id;
  END IF;

  -- Statuts gelés : ne pas modifier du tout (ARCHIVE)
  IF v_current_status_code = ANY(v_frozen_statuses) THEN
    RETURN 'PROTECTED:' || v_current_status_code;
  END IF;

  -- Compter TOUTES les interventions terminees de l'artisan
  SELECT COUNT(*)
  INTO v_completed_count
  FROM intervention_artisans ia
  JOIN interventions i ON i.id = ia.intervention_id
  WHERE ia.artisan_id = artisan_uuid
    AND i.statut_id = ANY(v_terminated_status_ids);

  -- Determiner le nouveau statut selon les seuils
  IF v_completed_count >= 10 THEN
    v_new_status_code := 'EXPERT';
  ELSIF v_completed_count >= 6 THEN
    v_new_status_code := 'CONFIRME';
  ELSIF v_completed_count >= 3 THEN
    v_new_status_code := 'FORMATION';
  ELSIF v_completed_count >= 1 THEN
    v_new_status_code := 'NOVICE';
  ELSE
    -- 0 intervention terminée : conserver le statut actuel si connu
    v_new_status_code := COALESCE(v_current_status_code, 'POTENTIEL');
  END IF;

  -- Protection anti-downgrade pour EXPERT, CONFIRME et FORMATION :
  -- le statut calculé ne peut être inférieur au statut actuel pour ces statuts.
  --
  -- Ordre hiérarchique : EXPERT(3) > CONFIRME(2) > FORMATION(1) > autres
  IF v_current_status_code = 'EXPERT' AND v_new_status_code != 'EXPERT' THEN
    RETURN 'PROTECTED_NO_DOWNGRADE:EXPERT->' || v_new_status_code || '(' || v_completed_count || ') kept EXPERT';
  END IF;

  IF v_current_status_code = 'CONFIRME' AND v_new_status_code NOT IN ('EXPERT', 'CONFIRME') THEN
    RETURN 'PROTECTED_NO_DOWNGRADE:CONFIRME->' || v_new_status_code || '(' || v_completed_count || ') kept CONFIRME';
  END IF;

  IF v_current_status_code = 'FORMATION' AND v_new_status_code NOT IN ('EXPERT', 'CONFIRME', 'FORMATION') THEN
    RETURN 'PROTECTED_NO_DOWNGRADE:FORMATION->' || v_new_status_code || '(' || v_completed_count || ') kept FORMATION';
  END IF;

  -- Si pas de changement, on sort
  IF v_new_status_code = v_current_status_code THEN
    RETURN 'NO_CHANGE:' || COALESCE(v_current_status_code, 'NULL') || '(' || v_completed_count || ')';
  END IF;

  -- Recuperer l'ID du nouveau statut
  SELECT id INTO v_new_status_id
  FROM artisan_statuses WHERE code = v_new_status_code;

  IF v_new_status_id IS NULL THEN
    RETURN 'ERROR:STATUS_NOT_FOUND:' || v_new_status_code;
  END IF;

  -- Mettre a jour l'artisan
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
'Recalcule le statut artisan basé sur le nombre d''interventions terminées.
Statuts gelés (aucune modification) : ARCHIVE.
Statuts protégés contre le downgrade (upgrade uniquement) : EXPERT, CONFIRME, FORMATION.
Raison : lors d''un import partiel depuis Google Sheets, ces statuts reflètent
une réalité terrain qui ne doit pas être écrasée par un comptage incomplet.';
