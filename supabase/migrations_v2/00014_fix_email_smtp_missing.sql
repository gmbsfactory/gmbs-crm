-- ========================================
-- Fix: Éléments manquants pour email SMTP
-- ========================================
-- Cette migration ajoute les éléments manquants de l'ancienne migration
-- 20251012_add_email_smtp_fields.sql

-- ========================================
-- 1. Colonne email_password_encrypted sur users
-- ========================================
-- L'ancienne migration avait email_password_encrypted (différent de email_smtp_password_encrypted)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_password_encrypted text;

COMMENT ON COLUMN public.users.email_password_encrypted IS 'Mot de passe d''application Gmail chiffré avec AES-256 (legacy)';

-- ========================================
-- 2. Politiques RLS pour email SMTP sur users
-- ========================================
-- Ces politiques permettent aux utilisateurs de voir/modifier uniquement leurs propres credentials email

DROP POLICY IF EXISTS users_email_smtp_select ON public.users;
CREATE POLICY users_email_smtp_select ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_email_smtp_update ON public.users;
CREATE POLICY users_email_smtp_update ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

