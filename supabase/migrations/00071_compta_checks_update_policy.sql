-- ========================================
-- Ajout de la policy UPDATE pour intervention_compta_checks
-- Nécessaire pour le fonctionnement de l'upsert
-- ========================================

-- Policy UPDATE pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can update compta checks" ON public.intervention_compta_checks
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
