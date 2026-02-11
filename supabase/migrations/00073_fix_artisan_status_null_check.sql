-- ========================================
-- Migration: Corriger la condition de sortie pour artisans sans statut
-- ========================================
-- Date: 2025-02-02
-- Problème: La fonction recalculate_artisan_status() sortait sans rien faire
-- si l'artisan n'avait pas de statut_id (NULL). Un artisan POTENTIEL ou nouveau
-- sans statut assigné ne pouvait donc jamais progresser.
--
-- Correction: Supprimer la condition de sortie incorrecte et permettre
-- le calcul du statut même si l'artisan n'a pas encore de statut.

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
  artisan_exists boolean;
BEGIN
  -- Vérifier que l'artisan existe
  SELECT EXISTS(SELECT 1 FROM artisans WHERE id = artisan_uuid) INTO artisan_exists;

  IF NOT artisan_exists THEN
    RETURN;
  END IF;

  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Récupérer le statut actuel de l'artisan (peut être NULL)
  SELECT statut_id
  INTO current_status_id
  FROM artisans
  WHERE id = artisan_uuid;

  -- Récupérer le code du statut actuel (peut être NULL si pas de statut)
  current_status_code := NULL;
  IF current_status_id IS NOT NULL THEN
    SELECT code INTO current_status_code
    FROM artisan_statuses
    WHERE id = current_status_id;
  END IF;

  -- Si l'artisan est ARCHIVE, on ne fait rien (statut gelé)
  IF current_status_code = 'ARCHIVE' THEN
    RETURN;
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
    -- Pas d'intervention terminée, on ne change rien
    RETURN;
  END IF;

  -- Si le statut ne change pas, on ne fait rien
  IF new_status_code = current_status_code THEN
    RETURN;
  END IF;

  -- Récupérer l'ID du nouveau statut
  SELECT id INTO new_status_id
  FROM artisan_statuses
  WHERE code = new_status_code;

  IF new_status_id IS NULL THEN
    RAISE WARNING 'Statut % non trouvé dans artisan_statuses', new_status_code;
    RETURN;
  END IF;

  -- Mettre à jour l'artisan
  UPDATE artisans
  SET statut_id = new_status_id,
      updated_at = now()
  WHERE id = artisan_uuid;

  RAISE NOTICE 'Artisan % mis à jour: % -> % (% interventions terminées)',
    artisan_uuid, COALESCE(current_status_code, 'NULL'), new_status_code, completed_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur lors du recalcul du statut de l''artisan %: %', artisan_uuid, SQLERRM;
END;
$$;

COMMENT ON FUNCTION recalculate_artisan_status IS 'Recalcule le statut d''un artisan basé sur ses interventions terminées. Fonctionne même si l''artisan n''a pas de statut initial.';

-- ========================================
-- FONCTION TRIGGER simplifiée
-- ========================================

CREATE OR REPLACE FUNCTION update_artisan_status_on_intervention_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  terminated_status_ids uuid[];
  is_terminated boolean;
  was_already_terminated boolean;
  artisan_ids uuid[];
  artisan_id uuid;
BEGIN
  -- Récupérer les IDs des statuts terminés
  SELECT array_agg(id)
  INTO terminated_status_ids
  FROM intervention_statuses
  WHERE code IN ('TERMINE', 'INTER_TERMINEE');

  IF terminated_status_ids IS NULL OR array_length(terminated_status_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Vérifier si l'intervention est maintenant terminée
  is_terminated := NEW.statut_id = ANY(terminated_status_ids);

  IF NOT is_terminated THEN
    RETURN NEW;
  END IF;

  -- Gérer le cas INSERT (OLD est NULL) et UPDATE
  was_already_terminated := FALSE;
  IF TG_OP = 'UPDATE' AND OLD.statut_id IS NOT NULL THEN
    was_already_terminated := OLD.statut_id = ANY(terminated_status_ids);
  END IF;

  -- Si déjà terminée, pas besoin de recalculer
  IF was_already_terminated THEN
    RETURN NEW;
  END IF;

  -- Récupérer TOUS les artisans liés à l'intervention
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
    RAISE WARNING 'Erreur dans trigger intervention completion pour %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ========================================
-- FONCTION TRIGGER pour lien artisan
-- ========================================

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

  IF terminated_status_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si l'intervention est terminée
  is_terminated := intervention_statut_id = ANY(terminated_status_ids);

  IF NOT is_terminated THEN
    RETURN NEW;
  END IF;

  -- Recalculer le statut de l'artisan
  PERFORM recalculate_artisan_status(NEW.artisan_id);

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur dans trigger artisan link pour artisan %: %', NEW.artisan_id, SQLERRM;
    RETURN NEW;
END;
$$;
