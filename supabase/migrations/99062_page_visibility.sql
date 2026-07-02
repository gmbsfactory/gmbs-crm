-- ============================================================================
-- Migration 99062 : visibilité configurable des pages dev (page_visibility)
-- ============================================================================
-- La page /bilan-s1 est réservée au rôle « dev », mais les devs peuvent en
-- ouvrir la visibilité à des rôles (admin, manager, gestionnaire) ou à des
-- utilisateurs précis, de façon permanente ou temporaire (expires_at).
-- Le rôle dev a TOUJOURS accès, quelle que soit la configuration.
--
-- Écritures : uniquement via la route API serveur (service role). Aucune
-- policy INSERT/UPDATE/DELETE n'est donc créée.
-- Lectures : les clients authentifiés peuvent lire (la sidebar et la page
-- vérifient l'accès), cf. policy SELECT ci-dessous.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_visibility (
  page_key text PRIMARY KEY,
  allowed_roles text[] NOT NULL DEFAULT '{}',
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.page_visibility IS
  'Visibilité configurable des pages réservées (ex: bilan-s1). Le rôle dev a toujours accès. '
  'expires_at non nul = ouverture temporaire ; passé expires_at, retour au dev-only.';
COMMENT ON COLUMN public.page_visibility.allowed_roles IS
  'Rôles autorisés en plus de dev (admin, manager, gestionnaire).';
COMMENT ON COLUMN public.page_visibility.allowed_user_ids IS
  'Utilisateurs autorisés individuellement (public.users.id), en plus des rôles.';

INSERT INTO public.page_visibility (page_key)
VALUES ('bilan-s1')
ON CONFLICT (page_key) DO NOTHING;

ALTER TABLE public.page_visibility ENABLE ROW LEVEL SECURITY;

-- Lecture pour les utilisateurs connectés (nécessaire au gate client/sidebar).
-- Pas de policy d'écriture : seules les routes serveur (service role) écrivent.
DROP POLICY IF EXISTS page_visibility_select_authenticated ON public.page_visibility;
CREATE POLICY page_visibility_select_authenticated
  ON public.page_visibility
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- FIN MIGRATION 99062
-- ============================================================================
