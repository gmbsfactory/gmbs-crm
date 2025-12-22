-- ========================================
-- Add avatar_url column to users table
-- ========================================
-- Cette migration ajoute la colonne avatar_url pour stocker l'URL de la photo de profil des utilisateurs

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.users.avatar_url IS 'URL de la photo de profil de l''utilisateur (stockée dans Supabase Storage)';