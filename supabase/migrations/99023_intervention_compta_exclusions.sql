-- ========================================
-- Table pour exclure des interventions de la vue comptabilité
-- Issue #20 : suppression de lignes dans le tableau compta
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_compta_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES auth.users(id),
  excluded_at timestamptz DEFAULT now(),
  UNIQUE(intervention_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_compta_exclusions_intervention ON public.intervention_compta_exclusions(intervention_id);

-- RLS
ALTER TABLE public.intervention_compta_exclusions ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Anyone can read compta exclusions" ON public.intervention_compta_exclusions
  FOR SELECT USING (true);

-- Insertion pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert compta exclusions" ON public.intervention_compta_exclusions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Suppression pour les utilisateurs authentifiés (pour restaurer une ligne)
CREATE POLICY "Authenticated users can delete compta exclusions" ON public.intervention_compta_exclusions
  FOR DELETE USING (auth.uid() IS NOT NULL);
