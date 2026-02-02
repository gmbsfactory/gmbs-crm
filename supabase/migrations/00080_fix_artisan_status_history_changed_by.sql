-- =====================================================
-- Migration 00080: Fix artisan_status_history changed_by constraint
-- =====================================================
-- Problème: Quand recalculate_artisan_status est appelé via RPC,
-- le trigger log_artisan_status_change essaie d'insérer avec un
-- changed_by qui n'existe pas dans la table users (ou est invalide).
--
-- Solution: Vérifier que l'UUID utilisateur existe avant de l'utiliser,
-- sinon utiliser NULL.
-- =====================================================

CREATE OR REPLACE FUNCTION log_artisan_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_intervention_count INTEGER;
  v_change_reason TEXT;
  v_changed_by UUID;
  v_jwt_sub TEXT;
BEGIN
  -- Uniquement si le statut a changé
  IF (TG_OP = 'UPDATE' AND OLD.statut_id IS DISTINCT FROM NEW.statut_id) OR
     (TG_OP = 'INSERT' AND NEW.statut_id IS NOT NULL) THEN

    -- Compter les interventions terminées (primaires uniquement)
    SELECT COUNT(DISTINCT i.id) INTO v_intervention_count
    FROM interventions i
    INNER JOIN intervention_statuses ist ON i.statut_id = ist.id
    INNER JOIN intervention_artisans ia ON ia.intervention_id = i.id
    WHERE ia.artisan_id = NEW.id
      AND ia.is_primary = true
      AND ist.code IN ('TERMINE', 'INTER_TERMINEE');

    -- Déterminer la raison du changement
    v_change_reason := COALESCE(
      current_setting('app.status_change_reason', true),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'creation'
        ELSE 'automatic' -- Par défaut 'automatic' car souvent appelé par trigger
      END
    );

    -- Récupérer l'UUID utilisateur de manière sécurisée
    v_changed_by := NULL;
    BEGIN
      -- Essayer d'extraire le sub du JWT
      v_jwt_sub := current_setting('request.jwt.claims', true)::json->>'sub';
      IF v_jwt_sub IS NOT NULL AND v_jwt_sub != '' THEN
        -- Vérifier que cet UUID existe dans la table users
        SELECT id INTO v_changed_by
        FROM users
        WHERE id = v_jwt_sub::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- En cas d'erreur (JWT invalide, conversion UUID échouée, etc.)
      v_changed_by := NULL;
    END;

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
      v_changed_by,
      v_change_reason,
      v_intervention_count
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_artisan_status_change IS 'Enregistre les changements de statut artisan dans l''historique. Gère gracieusement le cas où l''utilisateur n''est pas disponible (appel via RPC/trigger).';
