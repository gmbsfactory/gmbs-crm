-- ========================================
-- TESTS DE RECHERCHE GLOBALE
-- ========================================
-- Ce fichier contient des requêtes SQL pour tester et diagnostiquer
-- la recherche globale (interventions + artisans) dans la vue matérialisée global_search_mv
--
-- Date: 2025-01-XX
-- Migration: 00020_search_materialized_views.sql
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
WHERE matviewname = 'global_search_mv';

-- Compter le nombre d'entités dans la vue
SELECT 
  entity_type,
  COUNT(*) as nombre_entites
FROM global_search_mv
GROUP BY entity_type;

-- ========================================
-- 2. RECHERCHE AVEC LA FONCTION RPC
-- ========================================

-- Test 1: Recherche globale (tous types)
SELECT * FROM search_global('Dupont', 20, 0, NULL);

-- Test 2: Recherche uniquement interventions
SELECT * FROM search_global('Flat', 20, 0, 'intervention');

-- Test 3: Recherche uniquement artisans
SELECT * FROM search_global('Dupont', 20, 0, 'artisan');

-- Test 4: Recherche avec limite et offset (pagination)
SELECT * FROM search_global('Dupont', 10, 0, NULL);   -- Première page
SELECT * FROM search_global('Dupont', 10, 10, NULL);  -- Deuxième page

-- ========================================
-- 3. TESTS DE CORRESPONDANCES PARTIELLES
-- ========================================

-- Test 1: Recherche partielle sur interventions (agence)
-- "Flat" devrait trouver "Flatlooker"
SELECT 
  'Test 1: Recherche "Flat" (interventions)' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN entity_type = 'intervention' THEN 1 END) as interventions,
  COUNT(CASE WHEN entity_type = 'artisan' THEN 1 END) as artisans,
  COUNT(CASE WHEN entity_type = 'intervention' AND (metadata->>'agence')::text ILIKE '%Flatlooker%' THEN 1 END) as avec_flatlooker
FROM search_global('Flat', 50, 0, NULL);

-- Test 2: Recherche partielle sur artisans (nom)
-- "Dup" devrait trouver "Dupont"
SELECT 
  'Test 2: Recherche "Dup" (artisans)' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN entity_type = 'artisan' THEN 1 END) as artisans,
  COUNT(CASE WHEN entity_type = 'artisan' AND (metadata->>'plain_nom')::text ILIKE '%Dupont%' THEN 1 END) as avec_dupont
FROM search_global('Dup', 50, 0, NULL);

-- Afficher les résultats détaillés
SELECT 
  entity_type,
  entity_id,
  metadata->>'agence' as agence,
  metadata->>'plain_nom' as nom_artisan,
  metadata->>'numero_associe' as numero,
  metadata->>'contexte' as contexte,
  rank
FROM search_global('Flat', 20, 0, NULL)
ORDER BY rank DESC;

-- ========================================
-- 4. COMPARAISON AVANT/APRÈS
-- ========================================

-- Test 1: Comparer les résultats avec recherche partielle vs complète
WITH partial_results AS (
  SELECT entity_id, entity_type, metadata, rank as rank_partial
  FROM search_global('Flat', 50, 0, NULL)
),
full_results AS (
  SELECT entity_id, entity_type, metadata, rank as rank_full
  FROM search_global('Flatlooker', 50, 0, NULL)
)
SELECT 
  COALESCE(p.entity_type, f.entity_type) as type,
  CASE 
    WHEN p.entity_type = 'intervention' THEN (p.metadata->>'agence')::text
    WHEN p.entity_type = 'artisan' THEN (p.metadata->>'plain_nom')::text
    ELSE (f.metadata->>'agence')::text
  END as nom,
  CASE WHEN p.entity_id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_partiel,
  CASE WHEN f.entity_id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_complet,
  p.rank_partial,
  f.rank_full
FROM partial_results p
FULL OUTER JOIN full_results f ON p.entity_id = f.entity_id AND p.entity_type = f.entity_type
ORDER BY 
  CASE WHEN p.entity_id IS NOT NULL AND f.entity_id IS NOT NULL THEN 1
       WHEN p.entity_id IS NOT NULL THEN 2
       ELSE 3 END,
  COALESCE(p.rank_partial, f.rank_full) DESC;

-- ========================================
-- 5. TESTS DE FILTRAGE PAR TYPE
-- ========================================

-- Test 1: Recherche uniquement interventions
SELECT 
  'Recherche interventions uniquement' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(DISTINCT entity_id) as interventions_uniques
FROM search_global('Flat', 50, 0, 'intervention');

-- Test 2: Recherche uniquement artisans
SELECT 
  'Recherche artisans uniquement' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(DISTINCT entity_id) as artisans_uniques
FROM search_global('Dupont', 50, 0, 'artisan');

-- Test 3: Comparer avec recherche globale (tous types)
SELECT 
  'Recherche globale (tous types)' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN entity_type = 'intervention' THEN 1 END) as interventions,
  COUNT(CASE WHEN entity_type = 'artisan' THEN 1 END) as artisans
FROM search_global('Dupont', 50, 0, NULL);

-- ========================================
-- 6. TESTS DE PERFORMANCE
-- ========================================

-- Test 1: Mesurer le temps d'exécution
EXPLAIN ANALYZE
SELECT * FROM search_global('Dupont', 20, 0, NULL);

-- Test 2: Vérifier l'utilisation des index
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  entity_type,
  entity_id,
  rank
FROM search_global('Dupont', 20, 0, NULL)
ORDER BY rank DESC;

-- ========================================
-- 7. VALIDATION DES SCORES
-- ========================================

-- Test 1: Vérifier que les correspondances exactes ont un meilleur score
SELECT 
  entity_type,
  CASE 
    WHEN entity_type = 'intervention' THEN (metadata->>'agence')::text
    WHEN entity_type = 'artisan' THEN (metadata->>'plain_nom')::text
    ELSE 'N/A'
  END as nom,
  rank,
  CASE 
    WHEN entity_type = 'intervention' AND (metadata->>'agence')::text ILIKE '%Flat%' THEN 'Correspondance agence'
    WHEN entity_type = 'artisan' AND (metadata->>'numero_associe')::text ILIKE '%Dup%' THEN 'Correspondance numero_associe'
    WHEN entity_type = 'artisan' AND (metadata->>'plain_nom')::text ILIKE '%Dup%' THEN 'Correspondance plain_nom'
    ELSE 'Autre'
  END as type_correspondance
FROM search_global('Dup', 20, 0, NULL)
ORDER BY rank DESC;

-- Test 2: Vérifier les bonus de score selon le type
SELECT 
  entity_type,
  CASE 
    WHEN entity_type = 'intervention' THEN (metadata->>'agence')::text
    WHEN entity_type = 'artisan' THEN (metadata->>'plain_nom')::text
    ELSE 'N/A'
  END as nom,
  rank,
  CASE 
    WHEN entity_type = 'intervention' AND (metadata->>'agence')::text ILIKE '%Flat%' THEN 'Bonus agence (0.5)'
    WHEN entity_type = 'artisan' AND (metadata->>'numero_associe')::text ILIKE '%Dup%' THEN 'Bonus numero_associe (0.5)'
    WHEN entity_type = 'artisan' AND (metadata->>'plain_nom')::text ILIKE '%Dup%' THEN 'Bonus plain_nom (0.4)'
    ELSE 'Pas de bonus'
  END as bonus_applique
FROM search_global('Dup', 20, 0, NULL)
ORDER BY rank DESC
LIMIT 10;

-- ========================================
-- 8. TESTS AVEC DIFFÉRENTS TERMES
-- ========================================

-- Test 1: Recherche qui devrait trouver les deux types
SELECT 
  entity_type,
  COUNT(*) as nombre_resultats
FROM search_global('Paris', 50, 0, NULL)
GROUP BY entity_type;

-- Test 2: Recherche avec plusieurs mots
SELECT * FROM search_global('Dupont Paris', 10, 0, NULL);

-- Test 3: Recherche avec préfixe très court
SELECT 
  'Test 3: Recherche "Du"' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN entity_type = 'intervention' THEN 1 END) as interventions,
  COUNT(CASE WHEN entity_type = 'artisan' THEN 1 END) as artisans
FROM search_global('Du', 20, 0, NULL);

-- ========================================
-- 9. TESTS DE CAS LIMITES
-- ========================================

-- Test 1: Requête vide
SELECT * FROM search_global('', 10, 0, NULL);

-- Test 2: Requête avec seulement des espaces
SELECT * FROM search_global('   ', 10, 0, NULL);

-- Test 3: Filtre par type invalide
SELECT * FROM search_global('Dupont', 10, 0, 'invalid_type');

-- Test 4: Requête avec caractères spéciaux
SELECT * FROM search_global('Dupont-Martin', 10, 0, NULL);

-- ========================================
-- 10. STATISTIQUES DE RECHERCHE
-- ========================================

-- Test 1: Statistiques globales
SELECT 
  'Recherche "Dupont"' as terme,
  COUNT(*) as total_resultats,
  COUNT(CASE WHEN entity_type = 'intervention' THEN 1 END) as interventions,
  COUNT(CASE WHEN entity_type = 'artisan' THEN 1 END) as artisans,
  AVG(rank) as score_moyen,
  MAX(rank) as score_max,
  MIN(rank) as score_min
FROM search_global('Dupont', 100, 0, NULL);

-- Test 2: Distribution des scores par type
SELECT 
  entity_type,
  CASE 
    WHEN rank >= 1.0 THEN 'Très élevé (>=1.0)'
    WHEN rank >= 0.5 THEN 'Élevé (0.5-1.0)'
    WHEN rank >= 0.2 THEN 'Moyen (0.2-0.5)'
    WHEN rank >= 0.1 THEN 'Faible (0.1-0.2)'
    ELSE 'Très faible (<0.1)'
  END as categorie_score,
  COUNT(*) as nombre_resultats
FROM search_global('Dupont', 100, 0, NULL)
GROUP BY entity_type, categorie_score
ORDER BY entity_type, MIN(rank) DESC;

-- ========================================
-- 11. VALIDATION FONCTIONNELLE
-- ========================================

-- Test 1: Vérifier qu'il n'y a pas de doublons
SELECT 
  'Test 1: Vérification doublons' as test_name,
  COUNT(*) as total_resultats,
  COUNT(DISTINCT entity_id) as resultats_uniques,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT entity_id) THEN '✅ Pas de doublons'
    ELSE '❌ Doublons détectés'
  END as statut
FROM search_global('Dupont', 100, 0, NULL);

-- Test 2: Vérifier que les résultats sont bien triés par pertinence
SELECT 
  'Test 2: Vérification tri' as test_name,
  COUNT(*) as total,
  COUNT(CASE WHEN rank >= LAG(rank) OVER (ORDER BY rank DESC) THEN 1 END) as violations_tri,
  CASE 
    WHEN COUNT(CASE WHEN rank >= LAG(rank) OVER (ORDER BY rank DESC) THEN 1 END) = 0 THEN '✅ Bien trié'
    ELSE '❌ Problème de tri'
  END as statut
FROM search_global('Dupont', 20, 0, NULL);

-- ========================================
-- 12. COMPARAISON AVEC RECHERCHES SPÉCIFIQUES
-- ========================================

-- Test 1: Comparer search_global vs search_interventions + search_artisans
WITH global_results AS (
  SELECT 
    entity_type,
    COUNT(*) as count_global
  FROM search_global('Dupont', 50, 0, NULL)
  GROUP BY entity_type
),
interventions_results AS (
  SELECT COUNT(*) as count_interventions
  FROM search_interventions('Dupont', 50, 0)
),
artisans_results AS (
  SELECT COUNT(*) as count_artisans
  FROM search_artisans('Dupont', 50, 0)
)
SELECT 
  'Recherche globale' as methode,
  COALESCE(gr.count_global, 0) as nombre_resultats
FROM global_results gr
WHERE gr.entity_type = 'intervention'
UNION ALL
SELECT 
  'search_interventions' as methode,
  ir.count_interventions as nombre_resultats
FROM interventions_results ir
UNION ALL
SELECT 
  'Recherche globale' as methode,
  COALESCE(gr.count_global, 0) as nombre_resultats
FROM global_results gr
WHERE gr.entity_type = 'artisan'
UNION ALL
SELECT 
  'search_artisans' as methode,
  ar.count_artisans as nombre_resultats
FROM artisans_results ar;

-- ========================================
-- NOTES ET INTERPRÉTATION
-- ========================================
-- 
-- Résultats attendus après la modification:
-- 
-- 1. Recherche partielle: "Flat" devrait trouver:
--    - Les interventions avec agence "Flatlooker" (via ILIKE sur metadata->>'agence')
--    - Les interventions avec "FLAT IRON" dans l'adresse (via full-text)
--
-- 2. Recherche partielle: "Dup" devrait trouver:
--    - Les artisans avec "Dupont" dans plain_nom (via ILIKE sur metadata->>'plain_nom')
--    - Les artisans avec "Dupré" dans plain_nom (via préfixe)
--
-- 3. Les scores devraient être:
--    - Plus élevés pour les correspondances exactes
--    - Moyens pour les correspondances avec préfixe
--    - Bonus selon le type d'entité et le champ:
--      * Interventions: 0.5 pour agence, 0.3 pour contexte
--      * Artisans: 0.5 pour numero_associe, 0.4 pour plain_nom, 0.3 pour raison_sociale
--
-- 4. Performance: La recherche combinée peut être légèrement plus lente
--    mais devrait rester acceptable (<500ms pour 100 résultats)
--
-- 5. Filtrage par type: p_entity_type permet de filtrer:
--    - NULL: tous les types
--    - 'intervention': uniquement interventions
--    - 'artisan': uniquement artisans
--
-- Si les tests échouent:
--   1. Vérifier que la migration a été appliquée correctement
--   2. Vérifier que la vue matérialisée a été rafraîchie
--   3. Vérifier les logs PostgreSQL pour les erreurs éventuelles
-- ========================================

