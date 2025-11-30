-- Vérifier les documents Drive importés
-- ======================================

-- 1. Compter les documents Drive
SELECT 
  COUNT(*) as total_documents,
  COUNT(CASE WHEN kind = 'drive' THEN 1 END) as drive_documents
FROM artisan_attachments;

-- 2. Lister les documents Drive avec les artisans
SELECT 
  a.prenom, a.nom, a.email,
  aa.kind, aa.filename, aa.url,
  aa.created_at
FROM artisans a
JOIN artisan_attachments aa ON a.id = aa.artisan_id
WHERE aa.kind = 'drive'
ORDER BY aa.created_at DESC 
LIMIT 20;

-- 3. Vérifier les artisans avec documents vs sans documents
SELECT 
  'Avec documents' as type,
  COUNT(DISTINCT a.id) as count
FROM artisans a
JOIN artisan_attachments aa ON a.id = aa.artisan_id
WHERE aa.kind = 'drive'

UNION ALL

SELECT 
  'Sans documents' as type,
  COUNT(DISTINCT a.id) as count
FROM artisans a
LEFT JOIN artisan_attachments aa ON a.id = aa.artisan_id AND aa.kind = 'drive'
WHERE aa.id IS NULL;

-- 4. Détails des documents par artisan
SELECT 
  a.prenom, a.nom,
  COUNT(aa.id) as nb_documents,
  STRING_AGG(aa.filename, ', ') as documents
FROM artisans a
LEFT JOIN artisan_attachments aa ON a.id = aa.artisan_id AND aa.kind = 'drive'
GROUP BY a.id, a.prenom, a.nom
HAVING COUNT(aa.id) > 0
ORDER BY nb_documents DESC
LIMIT 10;