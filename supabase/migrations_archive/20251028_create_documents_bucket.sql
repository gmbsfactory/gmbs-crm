-- ========================================
-- Création du bucket pour les documents
-- ========================================

-- Créer le bucket 'documents' s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  104857600, -- 100 MB (augmenté pour permettre les vidéos)
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    -- OpenDocument (LibreOffice/OpenOffice)
    'application/vnd.oasis.opendocument.text',            -- .odt
    'application/vnd.oasis.opendocument.spreadsheet',     -- .ods
    'application/vnd.oasis.opendocument.presentation',    -- .odp
    'application/vnd.oasis.opendocument.graphics',        -- .odg
    'application/vnd.oasis.opendocument.formula',         -- .odf
    'application/vnd.oasis.opendocument.chart',           -- .odc
    'application/vnd.oasis.opendocument.database',        -- .odb
    'application/vnd.oasis.opendocument.image',           -- .odi
    'text/plain',
    'text/csv',
    -- Vidéos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo', -- AVI
    'video/webm',
    'video/x-matroska', -- MKV
    -- Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    -- Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    -- Autres formats courants
    'application/json',
    'application/xml',
    'text/xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- Politique pour permettre la lecture publique des documents
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public documents read access'
  ) THEN
    CREATE POLICY "Public documents read access"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'documents');
  END IF;
END $$;

-- Politique pour permettre l'upload des documents (authentifié)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload documents"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'documents' 
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Politique pour permettre la suppression des documents (authentifié)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete documents"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'documents' 
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- Politique pour permettre la mise à jour des documents (authentifié)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update documents'
  ) THEN
    CREATE POLICY "Authenticated users can update documents"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'documents' 
        AND auth.role() = 'authenticated'
      )
      WITH CHECK (
        bucket_id = 'documents' 
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

