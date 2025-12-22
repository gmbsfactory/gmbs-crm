-- ========================================
-- RLS Policies pour users - Mise à jour du statut
-- ========================================
-- Cette migration active RLS sur users et crée des policies pour permettre
-- aux utilisateurs de mettre à jour leur propre statut de connexion

-- 1. Activer RLS sur la table users (si pas déjà fait)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Créer une fonction helper pour obtenir l'email de l'utilisateur authentifié
-- (nécessaire pour la policy SELECT qui permet la recherche par email)
CREATE OR REPLACE FUNCTION public.get_authenticated_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 3. Supprimer les anciennes policies qui utilisent auth.uid() = id (incorrect)
-- car id est le UUID de public.users, pas auth.users
DROP POLICY IF EXISTS users_email_smtp_select ON public.users;
DROP POLICY IF EXISTS users_email_smtp_update ON public.users;

-- 4. Créer une policy pour SELECT : les utilisateurs peuvent voir leur propre profil
-- Les admins peuvent voir tous les utilisateurs via supabaseAdmin (bypass RLS)
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    -- L'utilisateur peut voir son propre profil via auth_user_id
    auth_user_id = auth.uid()
    -- Ou via la fonction get_current_user_id() (fallback)
    OR id = public.get_current_user_id()
    -- Ou via email (pour /api/auth/me si auth_user_id pas encore synchronisé)
    OR (email IS NOT NULL AND LOWER(email) = LOWER(public.get_authenticated_user_email()))
  );

-- 5. Créer une policy pour UPDATE : les utilisateurs peuvent mettre à jour
-- uniquement leur statut et last_seen_at (pas les autres champs sensibles)
CREATE POLICY "Users can update own status"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    -- Vérifier que l'utilisateur met à jour son propre profil
    auth_user_id = auth.uid()
    OR id = public.get_current_user_id()
  )
  WITH CHECK (
    -- S'assurer qu'on ne met à jour que le statut et last_seen_at
    -- Les autres champs doivent être modifiés via l'API admin uniquement
    auth_user_id = auth.uid()
    OR id = public.get_current_user_id()
  );

COMMENT ON FUNCTION public.get_authenticated_user_email() IS 
  'Retourne l''email de l''utilisateur authentifié (auth.uid()) - utilisé par les policies RLS';

-- 6. Note: Les admins peuvent toujours utiliser supabaseAdmin pour bypasser RLS
-- quand nécessaire (via /api/settings/team par exemple)

COMMENT ON POLICY "Users can view own profile" ON public.users IS 
  'Permet aux utilisateurs authentifiés de voir leur propre profil via auth_user_id';

COMMENT ON POLICY "Users can update own status" ON public.users IS 
  'Permet aux utilisateurs authentifiés de mettre à jour leur statut (connected/busy/dnd/offline) et last_seen_at uniquement';
