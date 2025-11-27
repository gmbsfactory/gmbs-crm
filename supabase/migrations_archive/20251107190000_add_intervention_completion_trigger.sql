-- Migration: Trigger pour mettre à jour automatiquement les statuts d'artisans
-- quand une intervention passe à un statut terminé
-- 
-- Ce trigger garantit que les statuts sont mis à jour même si la mise à jour
-- se fait directement via Supabase (pas via l'Edge Function)

-- Fonction qui sera appelée par le trigger
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
  required_kinds text[] := ARRAY['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
  present_kinds text[];
  missing_count int;
  has_intervention boolean;
  i int;
BEGIN
  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  -- Si aucun statut terminé n'existe, ne rien faire
  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier si le nouveau statut est un statut terminé
  is_terminated := NEW.statut_id = ANY(terminated_status_ids);

  -- Si le statut n'est pas terminé, ne rien faire
  IF NOT is_terminated THEN
    RETURN NEW;
  END IF;

  -- Si le statut était déjà terminé avant, ne rien faire (pas de changement)
  IF OLD.statut_id = ANY(terminated_status_ids) THEN
    RETURN NEW;
  END IF;

  -- Récupérer les artisans liés à cette intervention (priorité aux primaires)
  -- Si aucun artisan primaire, prendre tous les artisans
  SELECT array_agg(DISTINCT artisan_id)
  INTO artisan_ids
  FROM intervention_artisans
  WHERE intervention_id = NEW.id
    AND (
      is_primary = true 
      OR NOT EXISTS (
        SELECT 1 FROM intervention_artisans ia2 
        WHERE ia2.intervention_id = NEW.id AND ia2.is_primary = true
      )
    );

  -- Si aucun artisan n'est lié, ne rien faire
  IF artisan_ids IS NULL OR array_length(artisan_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Traiter chaque artisan
  FOREACH artisan_id IN ARRAY artisan_ids
  LOOP
    -- Ignorer si artisan_id est NULL
    IF artisan_id IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      -- Récupérer le statut actuel de l'artisan et son statut de dossier
      SELECT statut_id, statut_dossier
      INTO current_status_id, current_dossier_status
      FROM artisans
      WHERE id = artisan_id;

      -- Si l'artisan n'existe pas, passer au suivant
      IF current_status_id IS NULL AND current_dossier_status IS NULL THEN
        CONTINUE;
      END IF;

      -- Récupérer le code du statut actuel
      current_status_code := NULL;
      IF current_status_id IS NOT NULL THEN
        SELECT code INTO current_status_code
        FROM artisan_statuses
        WHERE id = current_status_id;
      END IF;

      -- Ne pas modifier les statuts ONE_SHOT et ARCHIVE automatiquement
      -- Ces statuts sont gérés manuellement uniquement
      IF current_status_code IN ('ONE_SHOT', 'ARCHIVE') THEN
        -- Mettre à jour uniquement le statut de dossier si nécessaire
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

      -- Compter les interventions terminées de cet artisan (uniquement primaires)
      SELECT COUNT(*)
      INTO completed_count
      FROM intervention_artisans ia
      JOIN interventions i ON i.id = ia.intervention_id
      WHERE ia.artisan_id = artisan_id
        AND ia.is_primary = true
        AND i.statut_id = ANY(terminated_status_ids);

      -- Calculer le nouveau statut selon les règles
      new_status_code := NULL;
      IF completed_count >= 10 THEN
        new_status_code := 'EXPERT';
      ELSIF completed_count >= 6 THEN
        new_status_code := 'CONFIRME';
      ELSIF completed_count >= 3 THEN
        new_status_code := 'FORMATION';
      ELSIF completed_count >= 1 THEN
        -- Si CANDIDAT ou POTENTIEL → NOVICE après 1 intervention
        IF current_status_code IN ('CANDIDAT', 'POTENTIEL') OR current_status_code IS NULL THEN
          new_status_code := 'NOVICE';
        ELSE
          -- Pour les autres statuts, garder le statut actuel jusqu'au seuil suivant
          new_status_code := current_status_code;
        END IF;
      ELSE
        -- Moins de 1 intervention → reste CANDIDAT ou POTENTIEL
        new_status_code := COALESCE(current_status_code, 'CANDIDAT');
      END IF;

      -- Si le statut n'a pas changé, vérifier quand même le statut de dossier
      IF new_status_code = current_status_code THEN
        -- Calculer le statut de dossier
        SELECT array_agg(DISTINCT LOWER(kind))
        INTO present_kinds
        FROM artisan_attachments
        WHERE artisan_id = artisan_id
          AND kind IS NOT NULL
          AND kind != 'autre';

        IF present_kinds IS NULL THEN
          present_kinds := ARRAY[]::text[];
        END IF;

        -- Compter les documents manquants
        missing_count := 0;
        IF array_length(required_kinds, 1) IS NOT NULL THEN
          FOR i IN 1..array_length(required_kinds, 1)
          LOOP
            IF NOT (LOWER(required_kinds[i]) = ANY(present_kinds)) THEN
              missing_count := missing_count + 1;
            END IF;
          END LOOP;
        END IF;

        SELECT EXISTS (
          SELECT 1
          FROM intervention_artisans ia
          JOIN interventions i ON i.id = ia.intervention_id
          JOIN intervention_statuses ist ON ist.id = i.statut_id
          WHERE ia.artisan_id = artisan_id
            AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
        ) INTO has_intervention;

        IF missing_count = 0 THEN
          new_dossier_status := 'COMPLET';
        ELSIF missing_count = 1 OR has_intervention THEN
          new_dossier_status := 'À compléter';
        ELSE
          new_dossier_status := 'INCOMPLET';
        END IF;

        -- Mettre à jour uniquement le statut de dossier si nécessaire
        IF new_dossier_status != COALESCE(current_dossier_status, 'INCOMPLET') THEN
          UPDATE artisans
          SET statut_dossier = new_dossier_status,
              updated_at = now()
          WHERE id = artisan_id;
        END IF;

        CONTINUE;
      END IF;

      -- Récupérer l'ID du nouveau statut
      SELECT id INTO new_status_id
      FROM artisan_statuses
      WHERE code = new_status_code;

      -- Si le statut n'existe pas, ne rien faire
      IF new_status_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Calculer le statut de dossier
      SELECT array_agg(DISTINCT LOWER(kind))
      INTO present_kinds
      FROM artisan_attachments
      WHERE artisan_id = artisan_id
        AND kind IS NOT NULL
        AND kind != 'autre';

      IF present_kinds IS NULL THEN
        present_kinds := ARRAY[]::text[];
      END IF;

      -- Compter les documents manquants
      missing_count := 0;
      IF array_length(required_kinds, 1) IS NOT NULL THEN
        FOR i IN 1..array_length(required_kinds, 1)
        LOOP
          IF NOT (LOWER(required_kinds[i]) = ANY(present_kinds)) THEN
            missing_count := missing_count + 1;
          END IF;
        END LOOP;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM intervention_artisans ia
        JOIN interventions i ON i.id = ia.intervention_id
        JOIN intervention_statuses ist ON ist.id = i.statut_id
        WHERE ia.artisan_id = artisan_id
          AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
      ) INTO has_intervention;

      IF missing_count = 0 THEN
        new_dossier_status := 'COMPLET';
      ELSIF has_intervention AND (missing_count = array_length(required_kinds, 1) OR missing_count = 1) THEN
        -- À compléter : dossier vide (tous manquants) OU 1 seul fichier manquant ET artisan a effectué une intervention
        new_dossier_status := 'À compléter';
      ELSE
        new_dossier_status := 'INCOMPLET';
      END IF;

      -- Règle ARC-002 : Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"
      IF COALESCE(current_dossier_status, 'INCOMPLET') = 'INCOMPLET' AND new_status_code = 'NOVICE' AND current_status_code != 'NOVICE' THEN
        new_dossier_status := 'À compléter';
      END IF;

      -- Mettre à jour l'artisan
      UPDATE artisans
      SET statut_id = new_status_id,
          statut_dossier = new_dossier_status,
          updated_at = now()
      WHERE id = artisan_id;

    EXCEPTION
      WHEN OTHERS THEN
        -- En cas d'erreur pour cet artisan, logger et continuer avec le suivant
        RAISE WARNING 'Erreur lors de la mise à jour du statut de l''artisan % pour l''intervention %: %', artisan_id, NEW.id, SQLERRM;
        CONTINUE;
    END;

  END LOOP;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur globale, logger et retourner NEW pour ne pas bloquer la mise à jour de l'intervention
    RAISE WARNING 'Erreur dans update_artisan_status_on_intervention_completion pour intervention %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_artisan_status_on_intervention_completion IS 'Met à jour automatiquement les statuts d''artisans quand une intervention passe à un statut terminé';

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_update_artisan_status_on_intervention_completion ON interventions;
CREATE TRIGGER trigger_update_artisan_status_on_intervention_completion
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS DISTINCT FROM OLD.statut_id AND NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion();
