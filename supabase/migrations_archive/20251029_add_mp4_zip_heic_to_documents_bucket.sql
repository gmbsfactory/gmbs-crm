-- ========================================
-- Migration: Ajout des formats mp4, zip et heic au bucket documents
-- Date: 2025-01-16
-- Description: Ajoute les types MIME video/mp4, application/zip, image/heic et image/heif
--              aux types autorisés dans le bucket storage 'documents'
-- ========================================

-- Mettre à jour les types MIME autorisés pour le bucket documents
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'video/mp4',
  'text/plain',
  'text/csv'
]
WHERE id = 'documents';

