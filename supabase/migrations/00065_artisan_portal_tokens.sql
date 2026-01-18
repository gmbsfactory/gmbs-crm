-- Migration: Artisan Portal Tokens
-- Permet aux artisans d'accéder à leur portail via un lien unique

-- Table pour stocker les tokens d'accès au portail artisan
CREATE TABLE IF NOT EXISTS public.artisan_portal_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year'),
    last_accessed_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    
    -- Contrainte : un seul token actif par artisan
    CONSTRAINT unique_active_token_per_artisan UNIQUE (artisan_id, is_active) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS idx_artisan_portal_tokens_token ON public.artisan_portal_tokens(token) WHERE is_active = true;

-- Index pour recherche par artisan
CREATE INDEX IF NOT EXISTS idx_artisan_portal_tokens_artisan_id ON public.artisan_portal_tokens(artisan_id);

-- Commentaires
COMMENT ON TABLE public.artisan_portal_tokens IS 'Tokens d accès au portail artisan externe';
COMMENT ON COLUMN public.artisan_portal_tokens.token IS 'Token unique pour l accès au portail (format: uuid v4)';
COMMENT ON COLUMN public.artisan_portal_tokens.expires_at IS 'Date d expiration du token (défaut: 1 an)';
COMMENT ON COLUMN public.artisan_portal_tokens.last_accessed_at IS 'Dernière utilisation du token';
COMMENT ON COLUMN public.artisan_portal_tokens.is_active IS 'Permet de désactiver un token sans le supprimer';

-- Enable RLS
ALTER TABLE public.artisan_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Policies pour les utilisateurs authentifiés (CRM)
CREATE POLICY "CRM users can manage portal tokens" ON public.artisan_portal_tokens
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy pour accès anonyme (lecture seule pour validation du token)
CREATE POLICY "Anonymous can validate tokens" ON public.artisan_portal_tokens
    FOR SELECT
    TO anon
    USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Fonction pour générer un nouveau token pour un artisan
CREATE OR REPLACE FUNCTION generate_artisan_portal_token(p_artisan_id UUID, p_created_by UUID DEFAULT NULL)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ) AS $$
DECLARE
    v_new_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Générer un token unique
    v_new_token := encode(gen_random_bytes(32), 'hex');
    v_expires := now() + INTERVAL '1 year';
    
    -- Désactiver les anciens tokens actifs pour cet artisan
    UPDATE public.artisan_portal_tokens
    SET is_active = false
    WHERE artisan_portal_tokens.artisan_id = p_artisan_id AND artisan_portal_tokens.is_active = true;
    
    -- Insérer le nouveau token
    INSERT INTO public.artisan_portal_tokens (artisan_id, token, expires_at, created_by)
    VALUES (p_artisan_id, v_new_token, v_expires, p_created_by);
    
    RETURN QUERY SELECT v_new_token, v_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour valider un token et retourner l'artisan_id
CREATE OR REPLACE FUNCTION validate_artisan_portal_token(p_token TEXT)
RETURNS TABLE(artisan_id UUID, is_valid BOOLEAN) AS $$
DECLARE
    v_artisan_id UUID;
    v_is_valid BOOLEAN := false;
BEGIN
    -- Chercher le token actif et non expiré
    SELECT apt.artisan_id INTO v_artisan_id
    FROM public.artisan_portal_tokens apt
    WHERE apt.token = p_token 
      AND apt.is_active = true 
      AND (apt.expires_at IS NULL OR apt.expires_at > now());
    
    IF v_artisan_id IS NOT NULL THEN
        v_is_valid := true;
        
        -- Mettre à jour last_accessed_at
        UPDATE public.artisan_portal_tokens
        SET last_accessed_at = now()
        WHERE artisan_portal_tokens.token = p_token;
    END IF;
    
    RETURN QUERY SELECT v_artisan_id, v_is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION generate_artisan_portal_token(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_artisan_portal_token(TEXT) TO anon, authenticated;
