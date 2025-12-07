-- ========================================
-- TESTS DE RECHERCHE D'INTERVENTIONS
-- ========================================
-- Ce fichier contient des requêtes SQL pour tester et diagnostiquer
-- la recherche d'interventions dans la vue matérialisée interventions_search_mv
--
-- Usage:
--   1. Vérifier l'état de la vue matérialisée
--   2. Tester la recherche avec différents termes
--   3. Diagnostiquer les problèmes de recherche
-- ========================================

-- ========================================
-- 1. VÉRIFICATION DE LA VUE MATÉRIALISÉE
-- ========================================

-- Vérifier l'existence et les métadonnées de la vue
SELECT 
  schemaname, 
  matviewname, 
  hasindexes,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews 
WHERE matviewname = 'interventions_search_mv';

-- Compter le nombre d'interventions dans la vue
SELECT COUNT(*) as total_interventions
FROM interventions_search_mv;

-- Vérifier les index sur la vue
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'interventions_search_mv'
ORDER BY indexname;

-- ========================================
-- 2. RECHERCHE AVEC LA FONCTION RPC
-- ========================================

-- Test 1: Recherche "Flat" (comme dans le front-end)
-- Cette requête simule exactement ce que fait le front-end
SELECT * FROM search_interventions('Flat', 100, 0);

-- Test 2: Recherche "Flatlooker" (nom d'agence complet)
SELECT * FROM search_interventions('Flatlooker', 100, 0);

-- Test 3: Recherche avec limite et offset (pagination)
SELECT * FROM search_interventions('Flat', 20, 0);  -- Première page
SELECT * FROM search_interventions('Flat', 20, 20);  -- Deuxième page

-- ========================================
-- 3. RECHERCHE DIRECTE DANS LA VUE
-- ========================================

-- Test 1: Recherche "Flat" avec tous les détails
SELECT
  id,
  id_inter,
  agence_label,
  agence_code,
  contexte_intervention,
  adresse,
  ville,
  artisan_plain_nom,
  statut_label,
  date_formatted,
  ts_rank(search_vector, websearch_to_tsquery('french', unaccent('Flat'))) AS rank
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flat'))
ORDER BY rank DESC, date DESC
LIMIT 100;

-- Test 2: Recherche "Flatlooker" avec focus sur les agences
SELECT
  id,
  id_inter,
  agence_label,
  agence_code,
  contexte_intervention,
  ville,
  ts_rank(search_vector, websearch_to_tsquery('french', unaccent('Flatlooker'))) AS rank
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flatlooker'))
  AND agence_label ILIKE '%Flat%'
ORDER BY rank DESC
LIMIT 20;

-- Test 3: Vérifier si le terme est dans le vecteur de recherche
SELECT
  id,
  id_inter,
  agence_label,
  contexte_intervention,
  ts_rank(search_vector, websearch_to_tsquery('french', unaccent('Flat'))) AS rank,
  search_vector @@ websearch_to_tsquery('french', unaccent('Flat')) AS matches
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flat'))
ORDER BY rank DESC, date DESC
LIMIT 50;

-- ========================================
-- 4. VÉRIFICATION DES DONNÉES SOURCES
-- ========================================

-- Vérifier si des interventions avec "Flatlooker" existent dans la table source
SELECT 
  i.id,
  i.id_inter,
  a.label as agence_nom,
  a.code as agence_code,
  i.contexte_intervention,
  i.date,
  i.is_active
FROM interventions i
LEFT JOIN agencies a ON i.agence_id = a.id
WHERE a.label ILIKE '%Flatlooker%'
  AND i.is_active = true
ORDER BY i.date DESC
LIMIT 10;

-- Vérifier toutes les agences contenant "Flat"
SELECT 
  id,
  code,
  label,
  region
FROM agencies
WHERE label ILIKE '%Flat%'
ORDER BY label;

-- Compter les interventions par agence contenant "Flat"
SELECT 
  a.label as agence_nom,
  COUNT(*) as nombre_interventions
FROM interventions i
LEFT JOIN agencies a ON i.agence_id = a.id
WHERE a.label ILIKE '%Flat%'
  AND i.is_active = true
GROUP BY a.label
ORDER BY nombre_interventions DESC;

-- ========================================
-- 5. COMPARAISON VUE MATÉRIALISÉE vs SOURCE
-- ========================================

-- Vérifier si les interventions "Flatlooker" sont dans la vue matérialisée
SELECT 
  isv.id,
  isv.id_inter,
  isv.agence_label,
  isv.contexte_intervention,
  isv.date_formatted
FROM interventions_search_mv isv
WHERE isv.agence_label ILIKE '%Flatlooker%'
ORDER BY isv.date DESC
LIMIT 10;

-- Comparer le nombre d'interventions actives vs la vue
SELECT 
  'Source (interventions)' as source,
  COUNT(*) as count
FROM interventions
WHERE is_active = true
UNION ALL
SELECT 
  'Vue matérialisée' as source,
  COUNT(*) as count
FROM interventions_search_mv;

-- ========================================
-- 6. DIAGNOSTIC DU VECTEUR DE RECHERCHE
-- ========================================

-- Vérifier le contenu du vecteur de recherche pour une intervention spécifique
-- (Remplacer l'ID par un ID réel d'une intervention Flatlooker)
SELECT
  id,
  id_inter,
  agence_label,
  -- Afficher le vecteur de recherche (peut être long)
  search_vector,
  -- Vérifier si "Flat" est dans le vecteur
  search_vector @@ websearch_to_tsquery('french', unaccent('Flat')) as matches_flat,
  -- Vérifier si "Flatlooker" est dans le vecteur
  search_vector @@ websearch_to_tsquery('french', unaccent('Flatlooker')) as matches_flatlooker
FROM interventions_search_mv
WHERE agence_label ILIKE '%Flat%'
LIMIT 5;

-- ========================================
-- 7. TESTS DE PERFORMANCE
-- ========================================

-- Mesurer le temps d'exécution de la recherche
EXPLAIN ANALYZE
SELECT * FROM search_interventions('Flat', 100, 0);

-- Vérifier l'utilisation de l'index GIN
EXPLAIN ANALYZE
SELECT
  id,
  agence_label,
  ts_rank(search_vector, websearch_to_tsquery('french', unaccent('Flat'))) AS rank
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flat'))
ORDER BY rank DESC
LIMIT 100;

-- ========================================
-- 8. RAFRAÎCHISSEMENT DE LA VUE
-- ========================================

-- ⚠️ ATTENTION: Cette commande peut prendre du temps sur une grande base
-- Utiliser CONCURRENTLY pour éviter de bloquer les lectures
-- REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;

-- Version sans CONCURRENTLY (plus rapide mais bloque les lectures)
-- REFRESH MATERIALIZED VIEW interventions_search_mv;

-- Vérifier la dernière date de modification des interventions
SELECT 
  MAX(updated_at) as derniere_modification,
  COUNT(*) as total_actives
FROM interventions
WHERE is_active = true;

-- ========================================
-- 9. TESTS AVEC DIFFÉRENTS TERMES DE RECHERCHE
-- ========================================

-- Test avec un terme partiel
SELECT * FROM search_interventions('Flat', 10, 0);

-- Test avec un terme complet
SELECT * FROM search_interventions('Flatlooker', 10, 0);

-- Test avec plusieurs mots (AND)
SELECT * FROM search_interventions('Flat Paris', 10, 0);

-- Test avec recherche de phrase (guillemets)
SELECT * FROM search_interventions('"Flatlooker"', 10, 0);

-- Test avec OR
SELECT * FROM search_interventions('Flat OR Flatlooker', 10, 0);

-- ========================================
-- 10. STATISTIQUES DE RECHERCHE
-- ========================================

-- Compter les résultats pour différents termes
SELECT 
  'Flat' as terme,
  COUNT(*) as nombre_resultats
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flat'))
UNION ALL
SELECT 
  'Flatlooker' as terme,
  COUNT(*) as nombre_resultats
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('Flatlooker'))
UNION ALL
SELECT 
  'agence' as terme,
  COUNT(*) as nombre_resultats
FROM interventions_search_mv
WHERE search_vector @@ websearch_to_tsquery('french', unaccent('agence'));

-- ========================================
-- NOTES
-- ========================================
-- 
-- Si la recherche ne retourne pas de résultats pour "Flatlooker":
--   1. Vérifier que la vue matérialisée contient bien les données (requête #1)
--   2. Vérifier que les interventions existent dans la table source (requête #4)
--   3. Rafraîchir la vue matérialisée si nécessaire (section #8)
--   4. Vérifier que le vecteur de recherche contient bien le terme (requête #6)
--
-- La vue matérialisée inclut le nom de l'agence (agence_label) dans le vecteur
-- de recherche avec un poids B (poids moyen), donc la recherche devrait fonctionner.
--
-- Si le problème persiste après rafraîchissement, vérifier:
--   - Que la fonction unaccent() fonctionne correctement
--   - Que le dictionnaire 'french' est installé
--   - Les logs de l'Edge Function pour voir les erreurs éventuelles
-- ========================================

