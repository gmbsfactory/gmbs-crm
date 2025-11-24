-- Migration: Ajouter la table gestionnaire_targets pour les objectifs de marge
-- Objectif: Permettre au président/admin de définir des objectifs de marge pour chaque gestionnaire sur différentes périodes
-- Date: 2025-01-15

-- Créer l'enum pour le type de période
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'target_period_type') THEN
    CREATE TYPE target_period_type AS ENUM ('week', 'month', 'year');
  END IF;
END $$;

-- Créer la table gestionnaire_targets
CREATE TABLE IF NOT EXISTS public.gestionnaire_targets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_type target_period_type NOT NULL,
  margin_target numeric(12, 2) DEFAULT 5000.00, -- Objectif de marge totale en euros
  performance_target numeric(5, 2) DEFAULT 40.00, -- Objectif de performance en pourcentage (optionnel)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Qui a créé/modifié l'objectif
  UNIQUE (user_id, period_type) -- Un seul objectif par gestionnaire et par période
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_gestionnaire_targets_user_id ON public.gestionnaire_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_gestionnaire_targets_period_type ON public.gestionnaire_targets(period_type);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_gestionnaire_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_gestionnaire_targets_updated_at ON public.gestionnaire_targets;
CREATE TRIGGER trigger_update_gestionnaire_targets_updated_at
  BEFORE UPDATE ON public.gestionnaire_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_gestionnaire_targets_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE public.gestionnaire_targets IS 'Objectifs de marge et performance pour chaque gestionnaire par période';
COMMENT ON COLUMN public.gestionnaire_targets.user_id IS 'ID du gestionnaire concerné';
COMMENT ON COLUMN public.gestionnaire_targets.period_type IS 'Type de période : week (semaine), month (mois), year (année)';
COMMENT ON COLUMN public.gestionnaire_targets.margin_target IS 'Objectif de marge totale en euros pour la période';
COMMENT ON COLUMN public.gestionnaire_targets.performance_target IS 'Objectif de performance en pourcentage (optionnel)';
COMMENT ON COLUMN public.gestionnaire_targets.created_by IS 'ID de l''utilisateur qui a créé/modifié l''objectif (généralement le président/admin)';

