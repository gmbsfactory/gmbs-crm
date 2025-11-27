-- ========================================
-- Gestionnaire Targets (Objectifs)
-- ========================================

-- Table des objectifs gestionnaires
CREATE TABLE IF NOT EXISTS public.gestionnaire_targets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_type target_period_type NOT NULL,
  margin_target numeric(12, 2) DEFAULT 5000.00,
  performance_target numeric(5, 2) DEFAULT 40.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, period_type)
);

CREATE INDEX IF NOT EXISTS idx_gestionnaire_targets_user_id ON public.gestionnaire_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_gestionnaire_targets_period_type ON public.gestionnaire_targets(period_type);

-- Trigger updated_at
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

-- RLS
ALTER TABLE public.gestionnaire_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY gestionnaire_targets_select ON public.gestionnaire_targets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY gestionnaire_targets_insert ON public.gestionnaire_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  );

CREATE POLICY gestionnaire_targets_update ON public.gestionnaire_targets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  );

CREATE POLICY gestionnaire_targets_delete ON public.gestionnaire_targets
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  );

-- Comments
COMMENT ON TABLE public.gestionnaire_targets IS 'Objectifs de marge et performance pour chaque gestionnaire par période';
COMMENT ON COLUMN public.gestionnaire_targets.user_id IS 'ID du gestionnaire concerné';
COMMENT ON COLUMN public.gestionnaire_targets.period_type IS 'Type de période : week (semaine), month (mois), year (année)';
COMMENT ON COLUMN public.gestionnaire_targets.margin_target IS 'Objectif de marge totale en euros pour la période';
COMMENT ON COLUMN public.gestionnaire_targets.performance_target IS 'Objectif de performance en pourcentage (optionnel)';
COMMENT ON COLUMN public.gestionnaire_targets.created_by IS 'ID de l''utilisateur qui a créé/modifié l''objectif';

