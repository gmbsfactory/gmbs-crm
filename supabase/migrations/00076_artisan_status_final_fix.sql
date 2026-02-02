-- ========================================
-- Migration 00076: Correction définitive du système de statut artisan
-- ========================================
-- Date: 2025-02-02
--
-- Cette migration corrige tous les problèmes précédents en :
-- 1. Supprimant TOUS les triggers et fonctions conflictuels
-- 2. Recréant une fonction RPC propre avec support upgrade ET downgrade
-- 3. Créant des triggers qui fonctionnent dans les deux sens
--
-- Seuils :
--   0  intervention terminée → POTENTIEL (downgrade)
--   1+ intervention terminée → NOVICE
--   3+ interventions terminées → FORMATION
--   6+ interventions terminées → CONFIRME
--  10+ interventions terminées → EXPERT
-- ========================================

-- ========================================
-- ÉTAPE 1: Nettoyage complet des anciens triggers
-- ========================================
DROP TRIGGER IF EXISTS trigger_recalculate_artisan_status_on_status_change ON interventions;
DROP TRIGGER IF EXISTS trigger_recalculate_artisan_status_on_insert ON interventions;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_completion ON interventions;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_insert ON interventions;
DROP TRIGGER IF EXISTS trigger_recalculate_artisan_on_link_change ON intervention_artisans;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_insert ON intervention_artisans;
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_update ON intervention_artisans;

-- ========================================
-- ÉTAPE 2: Supprimer les anciennes fonctions
-- ========================================
DROP FUNCTION IF EXISTS recalculate_artisan_status(uuid);
DROP FUNCTION IF EXISTS trigger_recalculate_artisan_status();
DROP FUNCTION IF EXISTS update_artisan_status_on_intervention_completion();
DROP FUNCTION IF EXISTS update_artisan_status_on_artisan_link();
DROP FUNCTION IF EXISTS trigger_recalculate_on_artisan_link();

-- ========================================
-- ÉTAPE 3: Fonction RPC principale
-- ========================================
-- Retourne un texte descriptif pour faciliter le débogage
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

  -- ARCHIVE est gelé, on ne touche pas
  IF v_current_status_code = 'ARCHIVE' THEN
    RETURN 'FROZEN:ARCHIVE';
  END IF;

  -- Compter TOUTES les interventions terminées de l'artisan
  -- (sans filtre is_primary pour inclure primaires ET secondaires)
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
'Recalcule le statut artisan basé sur le nombre d''interventions terminées. Supporte upgrade ET downgrade.';

-- ========================================
-- ÉTAPE 4: Fonction trigger pour changement de statut intervention
-- ========================================
CREATE OR REPLACE FUNCTION fn_trigger_artisan_status_on_intervention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artisan_ids uuid[];
  v_artisan_id uuid;
  v_result text;
BEGIN
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
    -- Log le résultat (visible dans les logs Postgres)
    RAISE NOTICE 'Artisan % recalculé: %', v_artisan_id, v_result;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ========================================
-- ÉTAPE 5: Fonction trigger pour lien artisan-intervention
-- ========================================
CREATE OR REPLACE FUNCTION fn_trigger_artisan_status_on_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_result := recalculate_artisan_status(OLD.artisan_id);
    RAISE NOTICE 'Artisan % recalculé (DELETE): %', OLD.artisan_id, v_result;
    RETURN OLD;
  ELSE
    v_result := recalculate_artisan_status(NEW.artisan_id);
    RAISE NOTICE 'Artisan % recalculé (%): %', NEW.artisan_id, TG_OP, v_result;
    RETURN NEW;
  END IF;
END;
$$;

-- ========================================
-- ÉTAPE 6: Créer les triggers
-- ========================================

-- Trigger sur UPDATE du statut d'une intervention
CREATE TRIGGER trg_artisan_status_on_intervention_update
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (OLD.statut_id IS DISTINCT FROM NEW.statut_id)
  EXECUTE FUNCTION fn_trigger_artisan_status_on_intervention();

-- Trigger sur INSERT d'une intervention (si elle a déjà un statut)
CREATE TRIGGER trg_artisan_status_on_intervention_insert
  AFTER INSERT ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION fn_trigger_artisan_status_on_intervention();

-- Trigger sur changement de lien artisan-intervention
CREATE TRIGGER trg_artisan_status_on_link_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_artisans
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_artisan_status_on_link();

-- ========================================
-- ÉTAPE 7: Permissions
-- ========================================
GRANT EXECUTE ON FUNCTION recalculate_artisan_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_artisan_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION recalculate_artisan_status(uuid) TO anon;

-- ========================================
-- VÉRIFICATION
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration 00076 appliquée ===';
  RAISE NOTICE 'Fonction recalculate_artisan_status(uuid) créée';
  RAISE NOTICE 'Triggers sur interventions: trg_artisan_status_on_intervention_update, trg_artisan_status_on_intervention_insert';
  RAISE NOTICE 'Trigger sur intervention_artisans: trg_artisan_status_on_link_change';
  RAISE NOTICE 'Testez avec: SELECT recalculate_artisan_status(''uuid-artisan'');';
END;
$$;
