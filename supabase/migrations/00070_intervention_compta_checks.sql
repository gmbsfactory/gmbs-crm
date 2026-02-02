-- ========================================
-- Table pour marquer les interventions gérées en comptabilité
-- Tâche #182 : Surlignage des lignes dans la page comptabilité
-- ========================================

CREATE TABLE IF NOT EXISTS public.intervention_compta_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  checked_by uuid REFERENCES auth.users(id),
  checked_at timestamptz DEFAULT now(),
  UNIQUE(intervention_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_compta_checks_intervention ON public.intervention_compta_checks(intervention_id);

-- RLS
ALTER TABLE public.intervention_compta_checks ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Anyone can read compta checks" ON public.intervention_compta_checks
  FOR SELECT USING (true);

-- Insertion pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert compta checks" ON public.intervention_compta_checks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Suppression pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can delete compta checks" ON public.intervention_compta_checks
  FOR DELETE USING (auth.uid() IS NOT NULL);
