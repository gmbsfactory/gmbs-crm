-- ========================================
-- Migration 99010: Fusionner ARCHIVER dans ARCHIVE
-- ========================================
-- Il existe deux statuts doublons : ARCHIVE et ARCHIVER.
-- Cette migration :
--   1. Migre tous les artisans de ARCHIVER vers ARCHIVE
--   2. Migre l'historique artisan_status_history de ARCHIVER vers ARCHIVE
--   3. Supprime le statut ARCHIVER
--   4. Met a jour la fonction recalculate_artisan_status pour ne referencer que ARCHIVE
-- ========================================

DO $$
DECLARE
  v_archive_id uuid;
  v_archiver_id uuid;
  v_migrated int;
  v_history_migrated int;
BEGIN
  -- Recuperer les IDs des deux statuts
  SELECT id INTO v_archive_id FROM artisan_statuses WHERE code = 'ARCHIVE';
  SELECT id INTO v_archiver_id FROM artisan_statuses WHERE code = 'ARCHIVER';

  -- Si ARCHIVER n'existe pas, rien a faire
  IF v_archiver_id IS NULL THEN
    RAISE NOTICE 'Statut ARCHIVER introuvable, rien a migrer.';
    RETURN;
  END IF;

  -- Si ARCHIVE n'existe pas non plus, on renomme simplement ARCHIVER en ARCHIVE
  IF v_archive_id IS NULL THEN
    UPDATE artisan_statuses SET code = 'ARCHIVE', label = 'Archivé' WHERE id = v_archiver_id;
    RAISE NOTICE 'ARCHIVER renomme en ARCHIVE (pas de doublon).';
    RETURN;
  END IF;

  -- 1. Migrer tous les artisans de ARCHIVER vers ARCHIVE
  UPDATE artisans
  SET statut_id = v_archive_id, updated_at = now()
  WHERE statut_id = v_archiver_id;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  RAISE NOTICE '% artisan(s) migre(s) de ARCHIVER vers ARCHIVE.', v_migrated;

  -- 2. Migrer l'historique (artisan_status_history) de ARCHIVER vers ARCHIVE
  UPDATE artisan_status_history
  SET old_status_id = v_archive_id
  WHERE old_status_id = v_archiver_id;

  UPDATE artisan_status_history
  SET new_status_id = v_archive_id
  WHERE new_status_id = v_archiver_id;

  GET DIAGNOSTICS v_history_migrated = ROW_COUNT;
  RAISE NOTICE 'Historique artisan_status_history migre (% lignes new_status_id).', v_history_migrated;

  -- 3. Supprimer le statut ARCHIVER (plus aucune FK ne le reference)
  DELETE FROM artisan_statuses WHERE id = v_archiver_id;
  RAISE NOTICE 'Statut ARCHIVER supprime.';
END;
$$;

-- ========================================
-- Mettre a jour recalculate_artisan_status : ne plus referencer ARCHIVER
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
  -- Seul ARCHIVE est gele
  v_protected_statuses text[] := ARRAY['ARCHIVE'];
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

  -- Statuts proteges : ne pas modifier automatiquement
  IF v_current_status_code = ANY(v_protected_statuses) THEN
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
'Recalcule le statut artisan base sur le nombre d''interventions terminees. Seul ARCHIVE est protege (gele).';
