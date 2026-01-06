-- =====================================================
-- Migration: Historique des changements de statut artisan
-- Date: 2025-12-25
-- Description:
--   - Création de la table artisan_status_history pour tracer tous les changements de statut
--   - Trigger automatique pour enregistrer les changements lors des UPDATE
--   - Permet de retrouver le statut précédent d'un artisan (notamment pour ONE_SHOT)
-- =====================================================

-- Table pour l'historique des changements de statut
CREATE TABLE IF NOT EXISTS artisan_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  old_status_id UUID REFERENCES artisan_statuses(id),
  new_status_id UUID NOT NULL REFERENCES artisan_statuses(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES users(id),
  change_reason TEXT, -- 'manual', 'automatic', 'one_shot_return', etc.
  completed_interventions_count INTEGER, -- Nombre d'interventions au moment du changement
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_artisan_status_history_artisan_id ON artisan_status_history(artisan_id);
CREATE INDEX IF NOT EXISTS idx_artisan_status_history_changed_at ON artisan_status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_status_history_artisan_changed ON artisan_status_history(artisan_id, changed_at DESC);

-- Commentaires
COMMENT ON TABLE artisan_status_history IS 'Historique des changements de statut des artisans pour traçabilité et récupération du statut précédent';
COMMENT ON COLUMN artisan_status_history.old_status_id IS 'Statut avant le changement (NULL si création)';
COMMENT ON COLUMN artisan_status_history.new_status_id IS 'Statut après le changement';
COMMENT ON COLUMN artisan_status_history.change_reason IS 'Raison du changement: manual, automatic, one_shot_return, etc.';
COMMENT ON COLUMN artisan_status_history.completed_interventions_count IS 'Nombre d''interventions terminées au moment du changement';

-- =====================================================
-- Fonction trigger pour enregistrer automatiquement les changements
-- =====================================================
CREATE OR REPLACE FUNCTION log_artisan_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_intervention_count INTEGER;
  v_change_reason TEXT;
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
    -- Pour l'instant on met 'manual' par défaut, mais ça peut être enrichi
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

-- Trigger sur la table artisans
DROP TRIGGER IF EXISTS artisan_status_change_trigger ON artisans;
CREATE TRIGGER artisan_status_change_trigger
  AFTER INSERT OR UPDATE OF statut_id ON artisans
  FOR EACH ROW
  EXECUTE FUNCTION log_artisan_status_change();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================
ALTER TABLE artisan_status_history ENABLE ROW LEVEL SECURITY;

-- Policy de lecture : tous les utilisateurs authentifiés peuvent voir l'historique
CREATE POLICY "Authenticated users can view status history"
  ON artisan_status_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy d'insertion : via trigger uniquement (security definer)
-- Les utilisateurs ne peuvent pas insérer manuellement
CREATE POLICY "Status history can only be inserted by trigger"
  ON artisan_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- =====================================================
-- Fonction helper pour récupérer le statut précédent
-- =====================================================
CREATE OR REPLACE FUNCTION get_artisan_previous_status(p_artisan_id UUID, p_before_status_code TEXT DEFAULT NULL)
RETURNS TABLE (
  status_id UUID,
  status_code TEXT,
  status_label TEXT,
  changed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ash.old_status_id,
    ast.code,
    ast.label,
    ash.changed_at
  FROM artisan_status_history ash
  LEFT JOIN artisan_statuses ast ON ash.old_status_id = ast.id
  WHERE ash.artisan_id = p_artisan_id
    AND ash.old_status_id IS NOT NULL
    AND (p_before_status_code IS NULL OR ast.code = p_before_status_code)
  ORDER BY ash.changed_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_artisan_previous_status IS 'Récupère le statut précédent d''un artisan. Paramètres: artisan_id, before_status_code (optionnel pour filtrer)';

-- =====================================================
-- Migration des données existantes (optionnel)
-- =====================================================
-- Créer une entrée historique pour tous les artisans existants
-- avec leur statut actuel comme "création"
INSERT INTO artisan_status_history (
  artisan_id,
  old_status_id,
  new_status_id,
  changed_at,
  changed_by,
  change_reason,
  completed_interventions_count
)
SELECT
  a.id,
  NULL, -- Pas de statut précédent (création)
  a.statut_id,
  COALESCE(a.created_at, NOW()),
  NULL, -- Pas d'information sur qui a créé (migration)
  'migration_initial_status',
  (
    SELECT COUNT(DISTINCT i.id)
    FROM interventions i
    INNER JOIN intervention_statuses ist ON i.statut_id = ist.id
    INNER JOIN intervention_artisans ia ON ia.intervention_id = i.id
    WHERE ia.artisan_id = a.id
      AND ia.is_primary = true
      AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
  )
FROM artisans a
WHERE a.statut_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM artisan_status_history ash
    WHERE ash.artisan_id = a.id
  );
