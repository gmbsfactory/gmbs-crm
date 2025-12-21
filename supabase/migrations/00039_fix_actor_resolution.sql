-- ========================================
-- FIX: Actor resolution - Re-sync auth_user_id et améliorer la résolution
-- ========================================

-- 1) Re-synchroniser tous les auth_user_id via l'email
UPDATE public.users u
SET auth_user_id = au.id
FROM auth.users au
WHERE LOWER(u.email) = LOWER(au.email)
  AND (u.auth_user_id IS NULL OR u.auth_user_id != au.id);

-- 2) Améliorer get_current_user_id pour chercher aussi via auth.uid() direct
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_auth_id uuid;
  resolved_user_id uuid;
BEGIN
  current_auth_id := auth.uid();
  
  IF current_auth_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- 1. Chercher via auth_user_id (mapping correct)
  SELECT u.id INTO resolved_user_id
  FROM public.users u
  WHERE u.auth_user_id = current_auth_id
  LIMIT 1;
  
  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;
  
  -- 2. Fallback: chercher via l'email de auth.users
  SELECT u.id INTO resolved_user_id
  FROM public.users u
  JOIN auth.users au ON LOWER(u.email) = LOWER(au.email)
  WHERE au.id = current_auth_id
  LIMIT 1;
  
  IF resolved_user_id IS NOT NULL THEN
    -- Synchroniser le mapping pour les prochaines fois
    UPDATE public.users SET auth_user_id = current_auth_id WHERE id = resolved_user_id;
    RETURN resolved_user_id;
  END IF;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_current_user_id IS 
  'Retourne public.users.id depuis auth.uid() via auth_user_id ou email, avec auto-sync';

-- 3) Améliorer resolve_actor_user_id pour utiliser la version améliorée
CREATE OR REPLACE FUNCTION public.resolve_actor_user_id(
  p_explicit_user_id uuid DEFAULT NULL,
  p_fallback_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  resolved_user_id uuid;
  current_auth_id uuid;
BEGIN
  -- 1. Priorité à l'acteur explicite passé par l'API
  IF p_explicit_user_id IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = p_explicit_user_id OR u.auth_user_id = p_explicit_user_id
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  -- 2. Utiliser le mapping auth.uid() → public.users via get_current_user_id() amélioré
  resolved_user_id := public.get_current_user_id();
  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;

  -- 3. Fallback direct sur auth.uid() = public.users.id (ancien système)
  current_auth_id := auth.uid();
  IF current_auth_id IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = current_auth_id
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  -- 4. Fallback sur le paramètre fallback
  IF p_fallback_user_id IS NOT NULL THEN
    SELECT u.id INTO resolved_user_id
    FROM public.users u
    WHERE u.id = p_fallback_user_id OR u.auth_user_id = p_fallback_user_id
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN resolved_user_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.resolve_actor_user_id IS
  'Résout public.users.id: explicit > auth mapping (avec auto-sync) > auth.uid direct > fallback > NULL';

