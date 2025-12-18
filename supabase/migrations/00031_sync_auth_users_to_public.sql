-- ========================================
-- ✅ Synchronisation auth.users <-> public.users via email
-- ========================================
-- Cette migration ajoute une colonne auth_user_id pour lier les utilisateurs
-- et met à jour les policies RLS pour utiliser cette liaison

-- 1. Ajouter la colonne auth_user_id si elle n'existe pas
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

-- 2. Créer un index pour la recherche rapide
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- 3. Synchroniser les auth_user_id via l'email
-- Cette requête lie les utilisateurs public.users avec auth.users via leur email
UPDATE public.users u
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(u.email) = LOWER(au.email)
  AND u.auth_user_id IS NULL;

-- 4. Créer une fonction pour obtenir le public.users.id depuis auth.uid()
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT u.id 
  FROM public.users u 
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 5. Mettre à jour les policies RLS de intervention_reminders pour utiliser cette fonction
-- D'abord, supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can view own reminders and mentions" ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can create own reminders" ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.intervention_reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.intervention_reminders;

-- 6. Recréer les policies avec la nouvelle logique
CREATE POLICY "Users can view own reminders and mentions"
  ON public.intervention_reminders FOR SELECT
  USING (
    user_id = public.get_current_user_id() 
    OR public.get_current_user_id() = ANY(mentioned_user_ids)
  );

CREATE POLICY "Users can create own reminders"
  ON public.intervention_reminders FOR INSERT
  WITH CHECK (user_id = public.get_current_user_id());

CREATE POLICY "Users can update own reminders"
  ON public.intervention_reminders FOR UPDATE
  USING (user_id = public.get_current_user_id());

CREATE POLICY "Users can delete own reminders"
  ON public.intervention_reminders FOR DELETE
  USING (user_id = public.get_current_user_id());

-- 7. Créer un trigger pour synchroniser automatiquement les nouveaux utilisateurs
CREATE OR REPLACE FUNCTION public.sync_auth_user_on_signin()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour auth_user_id si l'email correspond
  UPDATE public.users
  SET auth_user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND auth_user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Le trigger sur auth.users nécessite des permissions spéciales
-- Il sera créé manuellement dans Supabase Dashboard si nécessaire

COMMENT ON COLUMN public.users.auth_user_id IS 'UUID de auth.users pour lier les comptes - synchronisé via email';
COMMENT ON FUNCTION public.get_current_user_id() IS 'Retourne le public.users.id correspondant à auth.uid() via auth_user_id';

