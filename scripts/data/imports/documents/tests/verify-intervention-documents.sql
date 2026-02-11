-- ========================================
-- Requêtes SQL pour vérifier les documents d'interventions
-- ========================================

-- 1. Vue d'ensemble des documents d'interventions
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT intervention_id) as interventions_avec_documents,
  COUNT(*) FILTER (WHERE kind = 'a_classe') as documents_a_classe,
  COUNT(*) FILTER (WHERE kind != 'a_classe') as documents_classifies
FROM public.intervention_attachments;

-- 2. Documents récemment insérés (dernières 24h)
SELECT 
  ia.id,
  ia.filename,
  ia.kind,
  ia.created_at,
  i.id_inter,
  i.date as date_intervention,
  i.adresse,
  i.ville
FROM public.intervention_attachments ia
JOIN public.interventions i ON ia.intervention_id = i.id
WHERE ia.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ia.created_at DESC
LIMIT 50;

-- 3. Documents "à classer" (a_classe) par intervention
SELECT 
  i.id_inter,
  COUNT(*) as nb_documents_a_classifier,
  STRING_AGG(ia.filename, ', ' ORDER BY ia.filename) as fichiers
FROM public.intervention_attachments ia
JOIN public.interventions i ON ia.intervention_id = i.id
WHERE ia.kind = 'a_classe'
GROUP BY i.id_inter
ORDER BY nb_documents_a_classifier DESC
LIMIT 20;

-- 4. Interventions avec le plus de documents
SELECT 
  i.id_inter,
  COUNT(*) as nb_documents,
  COUNT(*) FILTER (WHERE ia.kind = 'a_classe') as nb_a_classifier,
  COUNT(*) FILTER (WHERE ia.kind != 'a_classe') as nb_classifies,
  MIN(ia.created_at) as premier_document,
  MAX(ia.created_at) as dernier_document
FROM public.interventions i
LEFT JOIN public.intervention_attachments ia ON i.id = ia.intervention_id
GROUP BY i.id_inter
HAVING COUNT(*) > 0
ORDER BY nb_documents DESC
LIMIT 20;

-- 5. Répartition par type de document (kind)
SELECT 
  kind,
  COUNT(*) as nombre,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pourcentage
FROM public.intervention_attachments
GROUP BY kind
ORDER BY nombre DESC;

-- 6. Documents sans nom de fichier (problèmes potentiels)
SELECT 
  ia.id,
  ia.kind,
  ia.url,
  ia.created_at,
  i.id_inter
FROM public.intervention_attachments ia
JOIN public.interventions i ON ia.intervention_id = i.id
WHERE ia.filename IS NULL OR ia.filename = ''
ORDER BY ia.created_at DESC
LIMIT 20;

-- 7. Documents avec URLs Google Drive
SELECT 
  COUNT(*) as total_avec_drive_url,
  COUNT(*) FILTER (WHERE url LIKE '%drive.google.com%') as avec_drive_url
FROM public.intervention_attachments;

-- 8. Interventions sans documents
SELECT 
  i.id,
  i.id_inter,
  i.date,
  i.adresse,
  i.ville
FROM public.interventions i
LEFT JOIN public.intervention_attachments ia ON i.id = ia.intervention_id
WHERE ia.id IS NULL
ORDER BY i.date DESC
LIMIT 50;

-- 9. Documents dupliqués (même nom de fichier pour la même intervention)
SELECT 
  intervention_id,
  filename,
  COUNT(*) as occurrences,
  STRING_AGG(id::text, ', ') as ids_documents
FROM public.intervention_attachments
WHERE filename IS NOT NULL
GROUP BY intervention_id, filename
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- 10. Statistiques par mois d'intervention
SELECT 
  DATE_TRUNC('month', i.date) as mois,
  COUNT(DISTINCT i.id) as nb_interventions,
  COUNT(ia.id) as nb_documents,
  COUNT(*) FILTER (WHERE ia.kind = 'a_classe') as nb_a_classifier
FROM public.interventions i
LEFT JOIN public.intervention_attachments ia ON i.id = ia.intervention_id
WHERE i.date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', i.date)
ORDER BY mois DESC;

-- 11. Documents créés aujourd'hui
SELECT 
  COUNT(*) as documents_aujourdhui,
  COUNT(DISTINCT intervention_id) as interventions_aujourdhui
FROM public.intervention_attachments
WHERE DATE(created_at) = CURRENT_DATE;

-- 12. Top 10 des interventions avec le plus de documents "à classer" (a_classe)
SELECT 
  i.id_inter,
  COUNT(*) as nb_a_classifier,
  STRING_AGG(ia.filename, ', ' ORDER BY ia.filename LIMIT 5) as exemples_fichiers
FROM public.intervention_attachments ia
JOIN public.interventions i ON ia.intervention_id = i.id
WHERE ia.kind = 'a_classe'
GROUP BY i.id_inter
ORDER BY nb_a_classifier DESC
LIMIT 10;

