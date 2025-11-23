-- ========================================
-- Migration: Ajout des champs email SMTP pour l'envoi d'emails
-- Date: 2025-01-19
-- Feature: 004-mail
-- ========================================

-- Activer l'extension pgcrypto pour le chiffrement (si nécessaire côté DB)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- Table users: Ajout des colonnes pour l'email SMTP
-- ========================================

-- Ajouter les colonnes pour l'email SMTP
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_smtp text,
ADD COLUMN IF NOT EXISTS email_password_encrypted text;

-- Commentaires pour documentation
COMMENT ON COLUMN public.users.email_smtp IS 'Adresse email Gmail utilisée pour l''envoi d''emails (ex: gestionnaire@gmail.com)';
COMMENT ON COLUMN public.users.email_password_encrypted IS 'Mot de passe d''application Gmail chiffré avec AES-256';

-- Index pour les recherches par email SMTP
CREATE INDEX IF NOT EXISTS idx_users_email_smtp ON public.users(email_smtp) WHERE email_smtp IS NOT NULL;

-- RLS: L'utilisateur ne peut voir/modifier que ses propres credentials email
DROP POLICY IF EXISTS users_email_smtp_select ON public.users;
CREATE POLICY users_email_smtp_select ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_email_smtp_update ON public.users;
CREATE POLICY users_email_smtp_update ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ========================================
-- Table email_logs: Logs des envois d'emails
-- ========================================

-- Table pour les logs d'envoi d'emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message_html text,
  email_type text CHECK (email_type IN ('devis', 'intervention')),
  attachments_count int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_email_logs_intervention ON public.email_logs(intervention_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_artisan ON public.email_logs(artisan_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON public.email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);

-- RLS pour email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres logs d'envoi
DROP POLICY IF EXISTS email_logs_select_own ON public.email_logs;
CREATE POLICY email_logs_select_own ON public.email_logs
  FOR SELECT
  USING (auth.uid() = sent_by);

-- Politique: Les admins peuvent voir tous les logs
DROP POLICY IF EXISTS email_logs_select_admin ON public.email_logs;
CREATE POLICY email_logs_select_admin ON public.email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Commentaires pour documentation
COMMENT ON TABLE public.email_logs IS 'Logs des emails envoyés depuis le CRM';
COMMENT ON COLUMN public.email_logs.email_type IS 'Type d''email: devis (visite technique) ou intervention';
COMMENT ON COLUMN public.email_logs.status IS 'Statut: sent (envoyé), failed (échec), pending (en attente - réservé pour future évolution asynchrone)';



