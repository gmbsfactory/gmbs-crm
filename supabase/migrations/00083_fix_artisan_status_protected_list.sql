-- ========================================
-- Migration 00083: Correction des statuts proteges artisan
-- ========================================
-- BUG: La migration 00077 a ajoute CANDIDAT, ONE_SHOT et INACTIF dans
-- la liste des statuts proteges, empechant toute progression automatique.
--
-- Le frontend (statusRules.ts) definit que seul ARCHIVE est gele.
-- CANDIDAT, ONE_SHOT et INACTIF doivent pouvoir progresser automatiquement
-- en fonction du nombre d'interventions terminees.
--
-- Seuils (source de verite: src/lib/artisans/statusRules.ts) :
--   0  intervention  -> POTENTIEL
--   1+ intervention  -> NOVICE
--   3+ interventions -> FORMATION
--   6+ interventions -> CONFIRME
--  10+ interventions -> EXPERT
--
-- Seul ARCHIVE reste gele (pas de progression automatique).
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
  -- Seul ARCHIVE est gele (alignement avec le frontend statusRules.ts)
  v_protected_statuses text[] := ARRAY['ARCHIVE', 'ARCHIVER'];
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

  -- Statuts proteges : ne pas modifier automatiquement (seul ARCHIVE)
  IF v_current_status_code = ANY(v_protected_statuses) THEN
    RETURN 'PROTECTED:' || v_current_status_code;
  END IF;

  -- Compter TOUTES les interventions terminees de l'artisan
  -- (sans filtre is_primary pour inclure primaires ET secondaires)
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
    -- 0 intervention terminee = POTENTIEL (downgrade possible)
    v_new_status_code := 'POTENTIEL';
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
'Recalcule le statut artisan base sur le nombre d''interventions terminees. Seul ARCHIVE est protege (gele). CANDIDAT, ONE_SHOT et INACTIF progressent automatiquement.';

-- ========================================
-- Recalculer tous les artisans dont le statut etait bloque a tort
-- (CANDIDAT, ONE_SHOT, INACTIF qui ont des interventions terminees)
-- ========================================
DO $$
DECLARE
  v_artisan RECORD;
  v_result text;
  v_count int := 0;
BEGIN
  FOR v_artisan IN
    SELECT a.id, a.nom, a.prenom, s.code as current_status
    FROM artisans a
    LEFT JOIN artisan_statuses s ON s.id = a.statut_id
    WHERE s.code IN ('CANDIDAT', 'ONE_SHOT', 'INACTIF')
      AND a.is_active = true
  LOOP
    v_result := recalculate_artisan_status(v_artisan.id);
    v_count := v_count + 1;
    RAISE NOTICE 'Artisan % % (%) : %', v_artisan.prenom, v_artisan.nom, v_artisan.current_status, v_result;
  END LOOP;

  RAISE NOTICE '=== Migration 00083: % artisans recalcules ===', v_count;
END;
$$;
