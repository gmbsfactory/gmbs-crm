-- ========================================
-- Correction : Ajout des colonnes manquantes pour les métadonnées d'avatar
-- Cette migration garantit que les colonnes content_hash, derived_sizes et mime_preferred existent
-- ========================================

DO $$ 
BEGIN
  -- Vérifier et ajouter content_hash si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'artisan_attachments' 
    AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE public.artisan_attachments
    ADD COLUMN content_hash TEXT;
    
    RAISE NOTICE 'Colonne content_hash ajoutée à artisan_attachments';
  END IF;

  -- Vérifier et ajouter derived_sizes si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'artisan_attachments' 
    AND column_name = 'derived_sizes'
  ) THEN
    ALTER TABLE public.artisan_attachments
    ADD COLUMN derived_sizes JSONB DEFAULT '{}'::jsonb;
    
    RAISE NOTICE 'Colonne derived_sizes ajoutée à artisan_attachments';
  END IF;

  -- Vérifier et ajouter mime_preferred si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'artisan_attachments' 
    AND column_name = 'mime_preferred'
  ) THEN
    ALTER TABLE public.artisan_attachments
    ADD COLUMN mime_preferred TEXT;
    
    RAISE NOTICE 'Colonne mime_preferred ajoutée à artisan_attachments';
  END IF;
END $$;

-- Créer les index s'ils n'existent pas déjà
CREATE INDEX IF NOT EXISTS idx_artisan_attachments_content_hash 
ON public.artisan_attachments(content_hash) 
WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artisan_attachments_kind 
ON public.artisan_attachments(kind) 
WHERE kind = 'photo_profil';

-- Ajouter les commentaires pour documentation
COMMENT ON COLUMN public.artisan_attachments.content_hash IS 'Hash SHA-256 du contenu de l''image pour déduplication et versioning';
COMMENT ON COLUMN public.artisan_attachments.derived_sizes IS 'URLs des dérivés générés : {"40": "url", "80": "url", "160": "url"}';
COMMENT ON COLUMN public.artisan_attachments.mime_preferred IS 'Format MIME préféré pour l''affichage (image/webp ou image/jpeg)';


