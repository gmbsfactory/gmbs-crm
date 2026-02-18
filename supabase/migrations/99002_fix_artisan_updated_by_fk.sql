-- ========================================
-- Fix: drop FK constraints on updated_by / created_by
-- ========================================
-- getAuthUserId() retourne l'UUID auth.users (Supabase Auth),
-- pas l'UUID public.users. Le trigger resolve_actor_user_id()
-- gere deja le mapping auth_user_id -> public.users.id.
-- On supprime les FK pour permettre de stocker l'auth UUID.

ALTER TABLE public.artisans DROP CONSTRAINT IF EXISTS artisans_updated_by_fkey;
ALTER TABLE public.artisans DROP CONSTRAINT IF EXISTS artisans_created_by_fkey;
