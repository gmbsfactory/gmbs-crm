-- Migration: Ajouter les politiques RLS pour gestionnaire_targets
-- Objectif: Permettre aux admins et managers d'accéder à la table gestionnaire_targets
-- Date: 2025-01-15

-- Activer RLS sur la table
ALTER TABLE IF EXISTS public.gestionnaire_targets ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
-- (pour que les gestionnaires puissent voir leurs propres objectifs)
DROP POLICY IF EXISTS gestionnaire_targets_select ON public.gestionnaire_targets;
CREATE POLICY gestionnaire_targets_select ON public.gestionnaire_targets
  FOR SELECT
  TO authenticated
  USING (true); -- Tous les utilisateurs authentifiés peuvent lire

-- Politique pour permettre l'insertion/update aux admins et managers uniquement
DROP POLICY IF EXISTS gestionnaire_targets_insert ON public.gestionnaire_targets;
CREATE POLICY gestionnaire_targets_insert ON public.gestionnaire_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  );

DROP POLICY IF EXISTS gestionnaire_targets_update ON public.gestionnaire_targets;
CREATE POLICY gestionnaire_targets_update ON public.gestionnaire_targets
  FOR UPDATE
  TO authenticated
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

-- Politique pour permettre la suppression aux admins et managers uniquement
DROP POLICY IF EXISTS gestionnaire_targets_delete ON public.gestionnaire_targets;
CREATE POLICY gestionnaire_targets_delete ON public.gestionnaire_targets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND (r.name = 'admin' OR r.name = 'manager')
    )
  );

