-- Migration: Configuration Email pour les Retards
-- Description: Crée une table pour stocker la configuration email globale des notifications de retard
-- Date: 2026-01-13

-- ========================================
-- Table lateness_email_config
-- Configuration globale pour l'envoi d'emails de retard
-- ========================================

CREATE TABLE IF NOT EXISTS public.lateness_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_smtp text NOT NULL,
  email_password_encrypted text NOT NULL,
  is_enabled boolean DEFAULT true,
  motivation_message text DEFAULT 'Ne t''inquiète pas, demain sera meilleur ! 💪',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Commentaires pour documentation
COMMENT ON TABLE public.lateness_email_config IS 'Configuration globale pour l''envoi d''emails de notification de retard aux utilisateurs';
COMMENT ON COLUMN public.lateness_email_config.email_smtp IS 'Adresse email Gmail utilisée pour l''envoi des notifications de retard';
COMMENT ON COLUMN public.lateness_email_config.email_password_encrypted IS 'Mot de passe d''application Gmail chiffré avec AES-256';
COMMENT ON COLUMN public.lateness_email_config.is_enabled IS 'Active/désactive l''envoi automatique des emails de retard';
COMMENT ON COLUMN public.lateness_email_config.motivation_message IS 'Message de motivation personnalisable inclus dans l''email de retard';

-- ========================================
-- Trigger pour updated_at
-- ========================================

CREATE OR REPLACE FUNCTION update_lateness_email_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lateness_email_config_updated_at ON public.lateness_email_config;
CREATE TRIGGER trigger_lateness_email_config_updated_at
  BEFORE UPDATE ON public.lateness_email_config
  FOR EACH ROW
  EXECUTE FUNCTION update_lateness_email_config_updated_at();

-- ========================================
-- RLS Policies
-- Seuls les admins peuvent voir/modifier cette config
-- ========================================

ALTER TABLE public.lateness_email_config ENABLE ROW LEVEL SECURITY;

-- Policy de lecture : admins uniquement
DROP POLICY IF EXISTS lateness_email_config_select_admin ON public.lateness_email_config;
CREATE POLICY lateness_email_config_select_admin ON public.lateness_email_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Policy d'insertion : admins uniquement
DROP POLICY IF EXISTS lateness_email_config_insert_admin ON public.lateness_email_config;
CREATE POLICY lateness_email_config_insert_admin ON public.lateness_email_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Policy de mise à jour : admins uniquement
DROP POLICY IF EXISTS lateness_email_config_update_admin ON public.lateness_email_config;
CREATE POLICY lateness_email_config_update_admin ON public.lateness_email_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Policy de suppression : admins uniquement
DROP POLICY IF EXISTS lateness_email_config_delete_admin ON public.lateness_email_config;
CREATE POLICY lateness_email_config_delete_admin ON public.lateness_email_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- ========================================
-- Ajouter colonne pour tracker si l'email de retard a été envoyé
-- ========================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lateness_email_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.users.lateness_email_sent_at IS 'Timestamp du dernier email de retard envoyé. Permet d''éviter les doublons le même jour.';

-- Index pour les requêtes de vérification
CREATE INDEX IF NOT EXISTS idx_users_lateness_email_sent_at
  ON public.users(lateness_email_sent_at)
  WHERE lateness_email_sent_at IS NOT NULL;
