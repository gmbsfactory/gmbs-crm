-- ========================================
-- Migration: Corriger le trigger pour downgrade
-- ========================================
-- Date: 2025-02-02
-- Problème: Le trigger ne se déclenche pas quand on passe d'un statut terminé
-- vers un statut non-terminé (downgrade).
-- Solution: Modifier la condition du trigger pour se déclencher sur tout
-- changement de statut_id.

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_recalculate_artisan_status_on_status_change ON interventions;

-- Recréer avec une meilleure condition
-- Se déclenche quand statut_id change (dans les deux sens)
CREATE TRIGGER trigger_recalculate_artisan_status_on_status_change
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (OLD.statut_id IS DISTINCT FROM NEW.statut_id)
  EXECUTE FUNCTION trigger_recalculate_artisan_status();

-- Trigger séparé pour INSERT (nouveau)
DROP TRIGGER IF EXISTS trigger_recalculate_artisan_status_on_insert ON interventions;
CREATE TRIGGER trigger_recalculate_artisan_status_on_insert
  AFTER INSERT ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS NOT NULL)
  EXECUTE FUNCTION trigger_recalculate_artisan_status();
