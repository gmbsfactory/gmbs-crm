-- Migration: Fix artisan portal tokens constraint
-- La contrainte UNIQUE (artisan_id, is_active) est problématique car elle empêche
-- d'avoir plusieurs tokens inactifs pour le même artisan.
-- On la remplace par un index unique partiel qui ne s'applique qu'aux tokens actifs.

-- Supprimer la contrainte existante
ALTER TABLE public.artisan_portal_tokens 
DROP CONSTRAINT IF EXISTS unique_active_token_per_artisan;

-- Créer un index unique partiel pour garantir un seul token actif par artisan
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_token_per_artisan 
ON public.artisan_portal_tokens (artisan_id) 
WHERE is_active = true;

-- Commentaire sur l'index
COMMENT ON INDEX idx_unique_active_token_per_artisan IS 'Garantit un seul token actif par artisan';
