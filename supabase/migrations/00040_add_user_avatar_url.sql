-- ========================================
-- Ajout de la colonne avatar_url pour les photos de profil utilisateurs
-- ========================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.users.avatar_url IS 'URL de la photo de profil de l''utilisateur stockée dans Supabase Storage';
