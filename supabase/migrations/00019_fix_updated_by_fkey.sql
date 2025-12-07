-- ========================================
-- FIX: interventions_updated_by_fkey constraint violation
-- ========================================
-- Problème: Les triggers set_intervention_updated_by et set_intervention_created_by
-- utilisent auth.uid() pour définir updated_by, mais si l'utilisateur n'existe pas
-- dans la table public.users, la contrainte de clé étrangère échoue.
--
-- Solution: Vérifier que l'utilisateur existe dans public.users avant de définir updated_by

-- ========================================
-- TRIGGER UPDATE: Vérifier l'existence de l'utilisateur
-- ========================================

CREATE OR REPLACE FUNCTION set_intervention_updated_by()
RETURNS trigger AS $$
DECLARE
  current_user_id uuid;
  user_exists boolean;
BEGIN
  current_user_id := auth.uid();
  
  -- Vérifier si l'utilisateur existe dans public.users
  IF current_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = current_user_id) INTO user_exists;
    
    IF user_exists THEN
      NEW.updated_by = current_user_id;
    ELSE
      -- L'utilisateur n'existe pas dans public.users, garder la valeur précédente ou NULL
      NEW.updated_by = OLD.updated_by;
    END IF;
  ELSE
    -- Pas d'utilisateur authentifié, garder la valeur précédente
    NEW.updated_by = OLD.updated_by;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- TRIGGER INSERT: Vérifier l'existence de l'utilisateur
-- ========================================

CREATE OR REPLACE FUNCTION set_intervention_created_by()
RETURNS trigger AS $$
DECLARE
  current_user_id uuid;
  user_exists boolean;
BEGIN
  IF NEW.updated_by IS NULL THEN
    current_user_id := auth.uid();
    
    -- Vérifier si l'utilisateur existe dans public.users
    IF current_user_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.users WHERE id = current_user_id) INTO user_exists;
      
      IF user_exists THEN
        NEW.updated_by = current_user_id;
      END IF;
      -- Si l'utilisateur n'existe pas, updated_by reste NULL (ce qui est acceptable)
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- OPTIONNEL: Trigger pour synchroniser auth.users -> public.users
-- Décommentez si vous voulez créer automatiquement les utilisateurs
-- ========================================

-- CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   INSERT INTO public.users (id, email, username)
--   VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))
--   ON CONFLICT (id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ========================================
-- Vérification: Afficher les utilisateurs orphelins
-- ========================================

-- Pour diagnostiquer, vous pouvez exécuter cette requête dans Supabase SQL Editor:
-- SELECT au.id, au.email 
-- FROM auth.users au 
-- LEFT JOIN public.users pu ON au.id = pu.id 
-- WHERE pu.id IS NULL;

