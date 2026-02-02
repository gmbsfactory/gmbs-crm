-- ========================================
-- Migration: Correction complète du système de statut artisan
-- ========================================
-- Date: 2025-02-02
--
-- Cette migration:
-- 1. Simplifie recalculate_artisan_status() pour supporter upgrade ET downgrade
-- 2. Ajoute un trigger pour recalculer quand une intervention QUITTE le statut terminé
-- 3. Expose la fonction via RPC pour que la edge function puisse l'appeler

-- Supprimer l'ancienne fonction (type de retour différent)
DROP FUNCTION IF EXISTS recalculate_artisan_status(uuid);

-- ========================================
-- FONCTION PRINCIPALE: Recalcul du statut artisan
-- ========================================
-- Logique simple:
-- - Compte les interventions terminées
-- - Applique les seuils (1=NOVICE, 3=FORMATION, 6=CONFIRME, 10=EXPERT)
-- - Si 0 intervention -> retour à POTENTIEL (downgrade)

CREATE OR REPLACE FUNCTION recalculate_artisan_status(artisan_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  terminated_status_ids uuid[];
  completed_count int;
  current_status_id uuid;
  current_status_code text;
  new_status_code text;
  new_status_id uuid;
BEGIN
  -- Vérifier que l'artisan existe
  IF NOT EXISTS(SELECT 1 FROM artisans WHERE id = artisan_uuid) THEN
    RETURN 'ARTISAN_NOT_FOUND';
  END IF;

  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL THEN
    RETURN 'NO_TERMINATED_STATUSES';
  END IF;

  -- Récupérer le statut actuel
  SELECT statut_id INTO current_status_id
  FROM artisans WHERE id = artisan_uuid;

  current_status_code := NULL;
  IF current_status_id IS NOT NULL THEN
    SELECT code INTO current_status_code
    FROM artisan_statuses WHERE id = current_status_id;
  END IF;

  -- ARCHIVE est gelé, on ne touche pas
  IF current_status_code = 'ARCHIVE' THEN
    RETURN 'ARCHIVE_FROZEN';
  END IF;

  -- Compter TOUTES les interventions terminées de l'artisan
  SELECT COUNT(*)
  INTO completed_count
  FROM intervention_artisans ia
  JOIN interventions i ON i.id = ia.intervention_id
  WHERE ia.artisan_id = artisan_uuid
    AND i.statut_id = ANY(terminated_status_ids);

  -- Déterminer le nouveau statut selon les seuils
  IF completed_count >= 10 THEN
    new_status_code := 'EXPERT';
  ELSIF completed_count >= 6 THEN
    new_status_code := 'CONFIRME';
  ELSIF completed_count >= 3 THEN
    new_status_code := 'FORMATION';
  ELSIF completed_count >= 1 THEN
    new_status_code := 'NOVICE';
  ELSE
    -- 0 intervention terminée = POTENTIEL (downgrade possible)
    new_status_code := 'POTENTIEL';
  END IF;

  -- Si pas de changement, on sort
  IF new_status_code = current_status_code THEN
    RETURN 'NO_CHANGE';
  END IF;

  -- Récupérer l'ID du nouveau statut
  SELECT id INTO new_status_id
  FROM artisan_statuses WHERE code = new_status_code;

  IF new_status_id IS NULL THEN
    RETURN 'STATUS_NOT_FOUND:' || new_status_code;
  END IF;

  -- Mettre à jour l'artisan
  UPDATE artisans
  SET statut_id = new_status_id, updated_at = now()
  WHERE id = artisan_uuid;

  RETURN 'UPDATED:' || COALESCE(current_status_code, 'NULL') || '->' || new_status_code || '(' || completed_count || ')';

EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR:' || SQLERRM;
END;
$$;

COMMENT ON FUNCTION recalculate_artisan_status(uuid) IS
'Recalcule le statut artisan. Retourne le résultat (UPDATED, NO_CHANGE, ERROR, etc.)';

-- ========================================
-- TRIGGER: Recalcul sur TOUT changement de statut intervention
-- ========================================
-- Se déclenche quand statut_id change (dans les deux sens)

CREATE OR REPLACE FUNCTION trigger_recalculate_artisan_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  artisan_ids uuid[];
  artisan_id uuid;
BEGIN
  -- Récupérer tous les artisans liés à cette intervention
  SELECT array_agg(DISTINCT ia.artisan_id)
  INTO artisan_ids
  FROM intervention_artisans ia
  WHERE ia.intervention_id = NEW.id
    AND ia.artisan_id IS NOT NULL;

  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Recalculer pour chaque artisan
  FOREACH artisan_id IN ARRAY artisan_ids
  LOOP
    PERFORM recalculate_artisan_status(artisan_id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Supprimer les anciens triggers
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_completion ON interventions;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_insert ON interventions;

-- Nouveau trigger unique: se déclenche sur TOUT changement de statut
CREATE TRIGGER trigger_recalculate_artisan_status_on_status_change
  AFTER INSERT OR UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION trigger_recalculate_artisan_status();

-- ========================================
-- TRIGGER: Recalcul quand un artisan est lié/délié
-- ========================================

CREATE OR REPLACE FUNCTION trigger_recalculate_on_artisan_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_artisan_status(OLD.artisan_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_artisan_status(NEW.artisan_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_insert ON intervention_artisans;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_update ON intervention_artisans;

CREATE TRIGGER trigger_recalculate_artisan_on_link_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_artisans
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_on_artisan_link();

-- ========================================
-- GRANT pour que la edge function puisse appeler via RPC
-- ========================================
GRANT EXECUTE ON FUNCTION recalculate_artisan_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_artisan_status(uuid) TO service_role;
