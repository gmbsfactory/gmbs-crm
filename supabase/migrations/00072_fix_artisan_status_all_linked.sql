-- ========================================
-- Migration: Corriger le calcul du statut artisan pour tous les artisans liés
-- ========================================
-- Date: 2025-02-02
-- Problème: Le calcul du statut artisan ne comptait que les artisans PRIMARY,
-- alors qu'il devrait compter TOUS les artisans liés à une intervention terminée
-- (qu'ils soient primaires ou secondaires).
--
-- Logique corrigée:
-- 1. Quand une intervention passe en TERMINE ou INTER_TERMINEE
-- 2. On récupère TOUS les artisans liés (via intervention_artisans)
-- 3. Pour chaque artisan, on compte TOUTES ses interventions terminées
-- 4. On applique les seuils pour calculer le nouveau statut

-- ========================================
-- FONCTION RÉUTILISABLE: Recalculer le statut d'un artisan
-- ========================================
-- CORRECTION: Suppression du filtre is_primary = true dans le comptage

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

  -- CORRECTION: Compter TOUTES les interventions terminées de l'artisan
  -- (sans filtrer sur is_primary)
  SELECT COUNT(*)
  INTO completed_count
  FROM intervention_artisans ia
  JOIN interventions i ON i.id = ia.intervention_id
  WHERE ia.artisan_id = artisan_uuid
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

COMMENT ON FUNCTION recalculate_artisan_status IS 'Recalcule le statut d''un artisan basé sur TOUTES ses interventions terminées (primaires ET secondaires).';

-- ========================================
-- FONCTION TRIGGER: Mise à jour sur completion d'intervention
-- ========================================
-- CORRECTION: Récupère TOUS les artisans liés, pas seulement les primaires

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
  was_already_terminated := FALSE;
  IF TG_OP = 'UPDATE' AND OLD.statut_id IS NOT NULL THEN
    was_already_terminated := OLD.statut_id = ANY(terminated_status_ids);
  END IF;

  IF was_already_terminated THEN
    RETURN NEW;
  END IF;

  -- CORRECTION: Récupérer TOUS les artisans liés à l'intervention
  -- (sans filtrer sur is_primary)
  SELECT array_agg(DISTINCT ia.artisan_id)
  INTO artisan_ids
  FROM intervention_artisans ia
  WHERE ia.intervention_id = NEW.id
    AND ia.artisan_id IS NOT NULL;

  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Recalculer le statut pour chaque artisan lié
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

COMMENT ON FUNCTION update_artisan_status_on_intervention_completion IS 'Met à jour automatiquement les statuts de TOUS les artisans liés quand une intervention passe à un statut terminé';

-- ========================================
-- FONCTION TRIGGER: Mise à jour sur lien artisan
-- ========================================
-- CORRECTION: Traite tous les artisans liés, pas seulement les primaires

CREATE OR REPLACE FUNCTION update_artisan_status_on_artisan_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  intervention_statut_id uuid;
  terminated_status_ids uuid[];
  is_terminated boolean;
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

  -- CORRECTION: Recalculer le statut de l'artisan lié
  -- (qu'il soit primaire ou secondaire)
  PERFORM recalculate_artisan_status(NEW.artisan_id);

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans update_artisan_status_on_artisan_link pour artisan % intervention %: %', NEW.artisan_id, NEW.intervention_id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_artisan_status_on_artisan_link IS 'Met à jour le statut d''un artisan quand il est lié à une intervention terminée (primaire OU secondaire)';

-- ========================================
-- RECRÉER LES TRIGGERS (au cas où ils auraient été modifiés)
-- ========================================

-- Trigger sur UPDATE d'intervention
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_completion ON interventions;
CREATE TRIGGER trigger_update_artisan_status_on_intervention_completion
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS DISTINCT FROM OLD.statut_id AND NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion();

-- Trigger sur INSERT d'intervention
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_insert ON interventions;
CREATE TRIGGER trigger_update_artisan_status_on_intervention_insert
  AFTER INSERT ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion();

-- Trigger sur INSERT de lien artisan
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_insert ON intervention_artisans;
CREATE TRIGGER trigger_update_artisan_status_on_artisan_link_insert
  AFTER INSERT ON intervention_artisans
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_status_on_artisan_link();

-- Trigger sur UPDATE de lien artisan (quand l'artisan_id change)
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_artisan_link_update ON intervention_artisans;
CREATE TRIGGER trigger_update_artisan_status_on_artisan_link_update
  AFTER UPDATE OF artisan_id ON intervention_artisans
  FOR EACH ROW
  WHEN (NEW.artisan_id IS DISTINCT FROM OLD.artisan_id)
  EXECUTE FUNCTION update_artisan_status_on_artisan_link();

-- ========================================
-- CORRECTION: Fonction d'historique (log_artisan_status_change)
-- ========================================
-- Le comptage des interventions dans l'historique doit aussi inclure
-- toutes les interventions (primaires ET secondaires) pour cohérence

CREATE OR REPLACE FUNCTION log_artisan_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_intervention_count INTEGER;
  v_change_reason TEXT;
BEGIN
  -- Uniquement si le statut a changé
  IF (TG_OP = 'UPDATE' AND OLD.statut_id IS DISTINCT FROM NEW.statut_id) OR
     (TG_OP = 'INSERT' AND NEW.statut_id IS NOT NULL) THEN

    -- CORRECTION: Compter TOUTES les interventions terminées (primaires ET secondaires)
    SELECT COUNT(DISTINCT i.id) INTO v_intervention_count
    FROM interventions i
    INNER JOIN intervention_statuses ist ON i.statut_id = ist.id
    INNER JOIN intervention_artisans ia ON ia.intervention_id = i.id
    WHERE ia.artisan_id = NEW.id
      AND ist.code IN ('TERMINE', 'INTER_TERMINEE');

    -- Déterminer la raison du changement
    v_change_reason := COALESCE(
      current_setting('app.status_change_reason', true),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'creation'
        ELSE 'manual'
      END
    );

    -- Insérer dans l'historique
    INSERT INTO artisan_status_history (
      artisan_id,
      old_status_id,
      new_status_id,
      changed_at,
      changed_by,
      change_reason,
      completed_interventions_count
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.statut_id ELSE NULL END,
      NEW.statut_id,
      NOW(),
      (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
      v_change_reason,
      v_intervention_count
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_artisan_status_change IS 'Enregistre les changements de statut artisan avec le comptage de TOUTES les interventions terminées';
