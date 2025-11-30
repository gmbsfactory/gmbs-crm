-- ========================================
-- Artisan Status & Dossier Triggers
-- ========================================

-- ========================================
-- FONCTION: Calculer le statut de dossier
-- ========================================

CREATE OR REPLACE FUNCTION calculate_artisan_dossier_status(artisan_uuid uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  required_kinds text[] := ARRAY['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
  present_kinds text[];
  missing_count int;
  has_intervention boolean;
  kind text;
BEGIN
  SELECT array_agg(DISTINCT LOWER(artisan_attachments.kind))
  INTO present_kinds
  FROM artisan_attachments
  WHERE artisan_attachments.artisan_id = artisan_uuid
    AND artisan_attachments.kind IS NOT NULL
    AND artisan_attachments.kind != 'autre';

  IF present_kinds IS NULL THEN
    present_kinds := ARRAY[]::text[];
  END IF;

  missing_count := 0;
  FOREACH kind IN ARRAY required_kinds
  LOOP
    IF NOT (LOWER(kind) = ANY(present_kinds)) THEN
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  SELECT EXISTS (
    SELECT 1
    FROM intervention_artisans ia
    JOIN interventions i ON i.id = ia.intervention_id
    JOIN intervention_statuses ist ON ist.id = i.statut_id
    WHERE ia.artisan_id = artisan_uuid
      AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
  ) INTO has_intervention;

  IF missing_count = 0 THEN
    RETURN 'COMPLET';
  ELSIF has_intervention AND (missing_count = array_length(required_kinds, 1) OR missing_count = 1) THEN
    RETURN 'À compléter';
  ELSE
    RETURN 'INCOMPLET';
  END IF;
END;
$$;

COMMENT ON FUNCTION calculate_artisan_dossier_status IS 'Calcule le statut de dossier d''un artisan basé sur ses documents et ses interventions terminées';

-- ========================================
-- TRIGGER: Mise à jour statut dossier sur changement d'attachments
-- ========================================

CREATE OR REPLACE FUNCTION update_artisan_dossier_status_on_attachment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  artisan_uuid uuid;
  new_dossier_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    artisan_uuid := OLD.artisan_id;
  ELSE
    artisan_uuid := NEW.artisan_id;
  END IF;

  SELECT calculate_artisan_dossier_status(artisan_uuid)
  INTO new_dossier_status;

  UPDATE artisans
  SET statut_dossier = new_dossier_status,
      updated_at = now()
  WHERE id = artisan_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_insert ON artisan_attachments;
CREATE TRIGGER trigger_update_dossier_status_on_attachment_insert
  AFTER INSERT ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change();

DROP TRIGGER IF EXISTS trigger_update_dossier_status_on_attachment_delete ON artisan_attachments;
CREATE TRIGGER trigger_update_dossier_status_on_attachment_delete
  AFTER DELETE ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change();

-- ========================================
-- TRIGGER: Mise à jour statut artisan sur intervention terminée
-- ========================================

CREATE OR REPLACE FUNCTION update_artisan_status_on_intervention_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  terminated_status_ids uuid[];
  is_terminated boolean;
  artisan_ids uuid[];
  artisan_id uuid;
  completed_count int;
  current_status_id uuid;
  current_status_code text;
  new_status_code text;
  new_status_id uuid;
  current_dossier_status text;
  new_dossier_status text;
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

  IF OLD.statut_id = ANY(terminated_status_ids) THEN
    RETURN NEW;
  END IF;

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

  FOREACH artisan_id IN ARRAY artisan_ids
  LOOP
    IF artisan_id IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      SELECT statut_id, statut_dossier
      INTO current_status_id, current_dossier_status
      FROM artisans
      WHERE id = artisan_id;

      IF current_status_id IS NULL AND current_dossier_status IS NULL THEN
        CONTINUE;
      END IF;

      current_status_code := NULL;
      IF current_status_id IS NOT NULL THEN
        SELECT code INTO current_status_code
        FROM artisan_statuses
        WHERE id = current_status_id;
      END IF;

      IF current_status_code IN ('ONE_SHOT', 'ARCHIVE') THEN
        SELECT calculate_artisan_dossier_status(artisan_id)
        INTO new_dossier_status;
        
        IF new_dossier_status != COALESCE(current_dossier_status, 'INCOMPLET') THEN
          UPDATE artisans
          SET statut_dossier = new_dossier_status,
              updated_at = now()
          WHERE id = artisan_id;
        END IF;
        
        CONTINUE;
      END IF;

      SELECT COUNT(*)
      INTO completed_count
      FROM intervention_artisans ia
      JOIN interventions i ON i.id = ia.intervention_id
      WHERE ia.artisan_id = artisan_id
        AND ia.is_primary = true
        AND i.statut_id = ANY(terminated_status_ids);

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

      IF new_status_code = current_status_code THEN
        SELECT calculate_artisan_dossier_status(artisan_id)
        INTO new_dossier_status;

        IF new_dossier_status != COALESCE(current_dossier_status, 'INCOMPLET') THEN
          UPDATE artisans
          SET statut_dossier = new_dossier_status,
              updated_at = now()
          WHERE id = artisan_id;
        END IF;

        CONTINUE;
      END IF;

      SELECT id INTO new_status_id
      FROM artisan_statuses
      WHERE code = new_status_code;

      IF new_status_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT calculate_artisan_dossier_status(artisan_id)
      INTO new_dossier_status;

      IF COALESCE(current_dossier_status, 'INCOMPLET') = 'INCOMPLET' AND new_status_code = 'NOVICE' AND current_status_code != 'NOVICE' THEN
        new_dossier_status := 'À compléter';
      END IF;

      UPDATE artisans
      SET statut_id = new_status_id,
          statut_dossier = new_dossier_status,
          updated_at = now()
      WHERE id = artisan_id;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur lors de la mise à jour du statut de l''artisan % pour l''intervention %: %', artisan_id, NEW.id, SQLERRM;
        CONTINUE;
    END;

  END LOOP;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans update_artisan_status_on_intervention_completion pour intervention %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_artisan_status_on_intervention_completion IS 'Met à jour automatiquement les statuts d''artisans quand une intervention passe à un statut terminé';

DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_completion ON interventions;
CREATE TRIGGER trigger_update_artisan_status_on_intervention_completion
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS DISTINCT FROM OLD.statut_id AND NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion();

-- ========================================
-- INITIALISATION: Statut dossier pour artisans existants
-- ========================================

UPDATE artisans
SET statut_dossier = calculate_artisan_dossier_status(id)
WHERE statut_dossier IS NULL;

