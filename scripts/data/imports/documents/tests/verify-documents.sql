-- ========================================
-- REQUÊTES SQL POUR VÉRIFIER LES DOCUMENTS INSÉRÉS
-- ========================================

-- Documents récemment importés avec source de stockage
SELECT 
  ia.filename,
  ia.kind,
  ia.url,
  CASE 
    WHEN ia.url LIKE '%drive.google.com%' THEN 'Google Drive'
    WHEN ia.url LIKE '%storage/v1/object/public/documents%' THEN 'Supabase Storage'
    ELSE 'Autre'
  END as source_stockage
FROM public.intervention_attachments ia
WHERE ia.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ia.created_at DESC
LIMIT 50;

-- 1. Vue d'ensemble : Nombre total de documents par kind
SELECT 
  kind,
  COUNT(*) as nombre_documents,
  COUNT(DISTINCT artisan_id) as nombre_artisans,
  SUM(file_size) as taille_totale_bytes,
  ROUND(AVG(file_size), 2) as taille_moyenne_bytes
FROM public.artisan_attachments
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'  -- Documents des 7 derniers jours
GROUP BY kind
ORDER BY nombre_documents DESC;

-- 2. Documents récemment insérés (dernières 24h)
SELECT 
  aa.id,
  aa.filename,
  aa.kind,
  aa.url,
  aa.file_size,
  aa.created_at,
  a.plain_nom as artisan_nom,
  a.id as artisan_id
FROM public.artisan_attachments aa
JOIN public.artisans a ON aa.artisan_id = a.id
WHERE aa.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY aa.created_at DESC
LIMIT 50;

-- 3. Documents "à classifier" (non classifiés automatiquement)
SELECT 
  aa.id,
  aa.filename,
  aa.url,
  aa.file_size,
  aa.created_at,
  a.plain_nom as artisan_nom
FROM public.artisan_attachments aa
JOIN public.artisans a ON aa.artisan_id = a.id
WHERE aa.kind = 'à classifier'
ORDER BY aa.created_at DESC;

-- 4. Statistiques par artisan (top 20 avec le plus de documents)
SELECT 
  a.plain_nom as artisan_nom,
  a.id as artisan_id,
  COUNT(aa.id) as nombre_documents,
  COUNT(DISTINCT aa.kind) as nombre_types_differents,
  STRING_AGG(DISTINCT aa.kind, ', ' ORDER BY aa.kind) as types_documents
FROM public.artisans a
LEFT JOIN public.artisan_attachments aa ON a.id = aa.artisan_id
WHERE aa.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY a.id, a.plain_nom
HAVING COUNT(aa.id) > 0
ORDER BY nombre_documents DESC
LIMIT 20;

-- 5. Vérifier les doublons potentiels (même nom de fichier pour le même artisan)
SELECT 
  a.plain_nom as artisan_nom,
  aa.filename,
  COUNT(*) as nombre_occurrences,
  STRING_AGG(aa.id::text, ', ') as ids_documents
FROM public.artisan_attachments aa
JOIN public.artisans a ON aa.artisan_id = a.id
WHERE aa.filename IS NOT NULL
GROUP BY a.id, a.plain_nom, aa.filename
HAVING COUNT(*) > 1
ORDER BY nombre_occurrences DESC;

-- 6. Documents avec URL Google Drive
SELECT 
  aa.id,
  aa.filename,
  aa.kind,
  aa.url,
  a.plain_nom as artisan_nom,
  CASE 
    WHEN aa.url LIKE '%drive.google.com%' THEN 'Google Drive'
    WHEN aa.url LIKE '%supabase%' THEN 'Supabase Storage'
    ELSE 'Autre'
  END as source_stockage
FROM public.artisan_attachments aa
JOIN public.artisans a ON aa.artisan_id = a.id
WHERE aa.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY aa.created_at DESC;

-- 7. Répartition des types de documents (kind) avec pourcentages
SELECT 
  kind,
  COUNT(*) as nombre,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM public.artisan_attachments
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY kind
ORDER BY nombre DESC;

-- 8. Documents d'un artisan spécifique (remplacer l'ID)
-- SELECT 
--   aa.id,
--   aa.filename,
--   aa.kind,
--   aa.url,
--   aa.file_size,
--   aa.created_at,
--   a.plain_nom as artisan_nom
-- FROM public.artisan_attachments aa
-- JOIN public.artisans a ON aa.artisan_id = a.id
-- WHERE a.id = 'VOTRE_ARTISAN_ID_ICI'
-- ORDER BY aa.created_at DESC;

-- 9. Vérifier les documents sans nom de fichier
SELECT 
  aa.id,
  aa.kind,
  aa.url,
  aa.created_at,
  a.plain_nom as artisan_nom
FROM public.artisan_attachments aa
JOIN public.artisans a ON aa.artisan_id = a.id
WHERE aa.filename IS NULL OR aa.filename = ''
ORDER BY aa.created_at DESC;

-- 10. Statistiques globales (tous les documents)
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT artisan_id) as nombre_artisans_avec_documents,
  COUNT(DISTINCT kind) as nombre_types_differents,
  SUM(file_size) as taille_totale_bytes,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as taille_totale_mb,
  MIN(created_at) as premier_document,
  MAX(created_at) as dernier_document
FROM public.artisan_attachments;

-- 11. Documents par type MIME
SELECT 
  mime_type,
  COUNT(*) as nombre,
  STRING_AGG(DISTINCT kind, ', ') as kinds_associes
FROM public.artisan_attachments
WHERE mime_type IS NOT NULL
GROUP BY mime_type
ORDER BY nombre DESC;

-- 12. Artisans sans documents récents (pour vérifier les échecs d'insertion)
-- Utiliser avec le fichier JSON de matches pour comparer
SELECT 
  a.id,
  a.plain_nom,
  COUNT(aa.id) as nombre_documents
FROM public.artisans a
LEFT JOIN public.artisan_attachments aa ON a.id = aa.artisan_id
WHERE aa.created_at >= CURRENT_DATE - INTERVAL '7 days' OR aa.id IS NULL
GROUP BY a.id, a.plain_nom
HAVING COUNT(aa.id) = 0
ORDER BY a.plain_nom;

