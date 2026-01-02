-- ========================================
-- Migration: Ajouter triggers INSERT pour calcul statut artisan
-- ========================================
-- Date: 2024-12-XX
-- Problème: Les interventions créées directement avec statut INTER_TERMINEE
-- ou les artisans liés après coup ne déclenchent pas le recalcul du statut
-- Solution: 
-- 1. Modifier la fonction pour gérer INSERT (OLD peut être NULL)
-- 2. Créer une fonction réutilisable pour le recalcul
-- 3. Ajouter un trigger sur INSERT de interventions
-- 4. Ajouter un trigger sur INSERT/UPDATE de intervention_artisans

-- ========================================
-- FONCTION RÉUTILISABLE: Recalculer le statut d'un artisan
-- ========================================
-- Cette fonction centralise la logique de recalcul pour éviter la duplication
-- et peut être appelée depuis plusieurs triggers

CREATE OR REPLACE FUNCTION recalculate_artisan_status(artisan_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  terminated_status_ids uuid[];
  completed_count int;
  current_status_id uuid;
  current_status_code text;
  new_status_code text;
  new_status_id uuid;
  current_dossier_status text;
  new_dossier_status text;
BEGIN
  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Récupérer le statut actuel de l'artisan
  SELECT statut_id, statut_dossier
  INTO current_status_id, current_dossier_status
  FROM artisans
  WHERE id = artisan_uuid;

  IF current_status_id IS NULL AND current_dossier_status IS NULL THEN
    RETURN;
  END IF;

  current_status_code := NULL;
  IF current_status_id IS NOT NULL THEN
    SELECT code INTO current_status_code
    FROM artisan_statuses
    WHERE id = current_status_id;
  END IF;

  -- Si l'artisan est ARCHIVE ou ONE_SHOT, on ne met à jour que le dossier
  IF current_status_code IN ('ONE_SHOT', 'ARCHIVE') THEN
    SELECT calculate_artisan_dossier_status(artisan_uuid)
    INTO new_dossier_status;
    
    IF new_dossier_status != COALESCE(current_dossier_status, 'INCOMPLET') THEN
      UPDATE artisans
      SET statut_dossier = new_dossier_status,
          updated_at = now()
      WHERE id = artisan_uuid;
    END IF;
    
    RETURN;
  END IF;

  -- Compter toutes les interventions terminées PRIMARY de l'artisan
  SELECT COUNT(*)
  INTO completed_count
  FROM intervention_artisans ia
  JOIN interventions i ON i.id = ia.intervention_id
  WHERE ia.artisan_id = artisan_uuid
    AND ia.is_primary = true
    AND i.statut_id = ANY(terminated_status_ids);

  -- Déterminer le nouveau statut selon les seuils
  new_status_code := NULL;
  IF completed_count >= 10 THEN
    new_status_code := 'EXPERT';
  ELSIF completed_count >= 6 THEN
    new_status_code := 'CONFIRME';
  ELSIF completed_count >= 3 THEN
    new_status_code := 'FORMATION';
  ELSIF completed_count >= 1 THEN
    IF current_status_code IN ('CANDIDAT', 'POTENTIEL') OR current_status_code IS NULL THEN
      new_status_code := 'NOVICE';
    ELSE
      new_status_code := current_status_code;
    END IF;
  ELSE
    new_status_code := COALESCE(current_status_code, 'CANDIDAT');
  END IF;

  -- Si le statut ne change pas, on peut quand même mettre à jour le dossier
  IF new_status_code = current_status_code THEN
    SELECT calculate_artisan_dossier_status(artisan_uuid)
    INTO new_dossier_status;

    IF new_dossier_status != COALESCE(current_dossier_status, 'INCOMPLET') THEN
      UPDATE artisans
      SET statut_dossier = new_dossier_status,
          updated_at = now()
      WHERE id = artisan_uuid;
    END IF;

    RETURN;
  END IF;

  -- Récupérer l'ID du nouveau statut
  SELECT id INTO new_status_id
  FROM artisan_statuses
  WHERE code = new_status_code;

  IF new_status_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculer le nouveau statut de dossier
  SELECT calculate_artisan_dossier_status(artisan_uuid)
  INTO new_dossier_status;

  -- Règle ARC-002 : Si dossier INCOMPLET ET passage à NOVICE → "À compléter"
  IF COALESCE(current_dossier_status, 'INCOMPLET') = 'INCOMPLET' 
     AND new_status_code = 'NOVICE' 
     AND current_status_code != 'NOVICE' THEN
    new_dossier_status := 'À compléter';
  END IF;

  -- Mettre à jour l'artisan
  UPDATE artisans
  SET statut_id = new_status_id,
      statut_dossier = new_dossier_status,
      updated_at = now()
  WHERE id = artisan_uuid;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors du recalcul du statut de l''artisan %: %', artisan_uuid, SQLERRM;
END;
$$;

COMMENT ON FUNCTION recalculate_artisan_status IS 'Recalcule le statut d''un artisan basé sur ses interventions terminées PRIMARY. Peut être appelée depuis plusieurs triggers.';

-- ========================================
-- MODIFIER LA FONCTION pour gérer INSERT (OLD peut être NULL)
-- ========================================
-- Utilise CREATE OR REPLACE donc sûr même si la fonction existe déjà

CREATE OR REPLACE FUNCTION update_artisan_status_on_intervention_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  terminated_status_ids uuid[];
  is_terminated boolean;
  artisan_ids uuid[];
  artisan_id uuid;
  was_already_terminated boolean;
BEGIN
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  is_terminated := NEW.statut_id = ANY(terminated_status_ids);

  IF NOT is_terminated THEN
    RETURN NEW;
  END IF;

  -- Gérer le cas INSERT (OLD est NULL) et UPDATE
  -- Si OLD existe et était déjà terminé, on ne fait rien (pas de changement)
  was_already_terminated := FALSE;
  IF TG_OP = 'UPDATE' AND OLD.statut_id IS NOT NULL THEN
    was_already_terminated := OLD.statut_id = ANY(terminated_status_ids);
  END IF;

  IF was_already_terminated THEN
    RETURN NEW;
  END IF;

  -- Récupérer les artisans PRIMARY de l'intervention
  SELECT array_agg(DISTINCT ia.artisan_id)
  INTO artisan_ids
  FROM intervention_artisans ia
  WHERE ia.intervention_id = NEW.id
    AND (
      ia.is_primary = true 
      OR NOT EXISTS (
        SELECT 1 FROM intervention_artisans ia2 
        WHERE ia2.intervention_id = NEW.id AND ia2.is_primary = true
      )
    );

  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Recalculer le statut pour chaque artisan
  FOREACH artisan_id IN ARRAY artisan_ids
  LOOP
    PERFORM recalculate_artisan_status(artisan_id);
  END LOOP;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans update_artisan_status_on_intervention_completion pour intervention %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_artisan_status_on_intervention_completion IS 'Met à jour automatiquement les statuts d''artisans quand une intervention passe à un statut terminé (INSERT ou UPDATE)';

-- ========================================
-- TRIGGER SUR INSERT de interventions
-- ========================================
-- Ce trigger gère le cas où une intervention est créée directement avec un statut terminé

DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_insert ON interventions;
CREATE TRIGGER trigger_update_artisan_status_on_intervention_insert
  AFTER INSERT ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion();

-- Le trigger UPDATE existant reste inchangé
-- (déjà défini dans 00008_artisan_triggers.sql)

-- ========================================
-- TRIGGER SUR INSERT/UPDATE de intervention_artisans
-- ========================================
-- Ce trigger gère le cas où un artisan est lié à une intervention terminée
-- après la création de l'intervention

CREATE OR REPLACE FUNCTION update_artisan_status_on_artisan_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  intervention_statut_id uuid;
  terminated_status_ids uuid[];
  is_terminated boolean;
  is_primary_artisan boolean;
BEGIN
  -- Récupérer le statut de l'intervention
  SELECT statut_id INTO intervention_statut_id
  FROM interventions
  WHERE id = NEW.intervention_id;

  IF intervention_statut_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier si l'intervention est terminée
  is_terminated := intervention_statut_id = ANY(terminated_status_ids);

  IF NOT is_terminated THEN
    RETURN NEW;
  END IF;

  -- Vérifier si l'artisan est PRIMARY
  -- Si aucun PRIMARY n'existe pour cette intervention, on considère tous les artisans
  is_primary_artisan := NEW.is_primary = true;
  
  IF NOT is_primary_artisan THEN
    -- Vérifier s'il existe un PRIMARY pour cette intervention
    IF EXISTS (
      SELECT 1 FROM intervention_artisans ia
      WHERE ia.intervention_id = NEW.intervention_id
        AND ia.is_primary = true
        AND (TG_OP = 'INSERT' OR ia.id != NEW.id)
    ) THEN
      -- Il existe un PRIMARY, donc on ignore ce non-PRIMARY
      RETURN NEW;
    END IF;
    -- Sinon, pas de PRIMARY, donc on traite cet artisan
  END IF;

  -- Recalculer le statut de l'artisan
  PERFORM recalculate_artisan_status(NEW.artisan_id);

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans update_artisan_status_on_artisan_link pour artisan % intervention %: %', NEW.artisan_id, NEW.intervention_id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_artisan_status_on_artisan_link IS 'Met à jour le statut d''un artisan quand il est lié à une intervention terminée';

DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_insert ON intervention_artisans;
CREATE TRIGGER trigger_update_artisan_status_on_artisan_link_insert
  AFTER INSERT ON intervention_artisans
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_status_on_artisan_link();

DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_update ON intervention_artisans;
CREATE TRIGGER trigger_update_artisan_status_on_artisan_link_update
  AFTER UPDATE OF is_primary ON intervention_artisans
  FOR EACH ROW
  WHEN (NEW.is_primary IS DISTINCT FROM OLD.is_primary)
  EXECUTE FUNCTION update_artisan_status_on_artisan_link();

