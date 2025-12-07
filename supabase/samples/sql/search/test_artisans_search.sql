-- ========================================
-- TESTS DE RECHERCHE D'ARTISANS
-- ========================================
-- Ce fichier contient des requêtes SQL pour tester et diagnostiquer
-- la recherche d'artisans dans la vue matérialisée artisans_search_mv
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
WHERE matviewname = 'artisans_search_mv';

-- Compter le nombre d'artisans dans la vue
SELECT COUNT(*) as total_artisans
FROM artisans_search_mv;

-- ========================================
-- 2. RECHERCHE AVEC LA FONCTION RPC
-- ========================================

-- Test 1: Recherche avec terme partiel (ex: "Dup" devrait trouver "Dupont")
SELECT * FROM search_artisans('Dup', 20, 0);

-- Test 2: Recherche avec nom complet
SELECT * FROM search_artisans('Dupont', 20, 0);

-- Test 3: Recherche par numéro associé
SELECT * FROM search_artisans('ART', 20, 0);

-- Test 4: Recherche avec limite et offset (pagination)
SELECT * FROM search_artisans('Dupont', 10, 0);  -- Première page
SELECT * FROM search_artisans('Dupont', 10, 10);  -- Deuxième page

-- ========================================
-- 3. TESTS DE CORRESPONDANCES PARTIELLES
-- ========================================

-- Test 1: Recherche partielle sur nom
-- "Dup" devrait trouver "Dupont", "Dupré", etc.
SELECT 
  'Test 1: Recherche "Dup"' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN plain_nom ILIKE '%Dupont%' THEN 1 END) as avec_dupont,
  COUNT(CASE WHEN plain_nom ILIKE '%Dupré%' THEN 1 END) as avec_dupre
FROM search_artisans('Dup', 50, 0);

-- Afficher les résultats détaillés
SELECT 
  numero_associe,
  plain_nom,
  raison_sociale,
  metiers_labels,
  rank
FROM search_artisans('Dup', 20, 0)
ORDER BY rank DESC;

-- Test 2: Recherche partielle sur raison sociale
SELECT * FROM search_artisans('SARL', 20, 0);

-- Test 3: Recherche partielle sur numéro associé
SELECT * FROM search_artisans('ART-', 20, 0);

-- ========================================
-- 4. COMPARAISON AVANT/APRÈS
-- ========================================

-- Test 1: Comparer les résultats avec recherche partielle vs complète
WITH partial_results AS (
  SELECT id, plain_nom, numero_associe, rank as rank_partial
  FROM search_artisans('Dup', 50, 0)
),
full_results AS (
  SELECT id, plain_nom, numero_associe, rank as rank_full
  FROM search_artisans('Dupont', 50, 0)
)
SELECT 
  COALESCE(p.plain_nom, f.plain_nom) as nom,
  COALESCE(p.numero_associe, f.numero_associe) as numero,
  CASE WHEN p.id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_partiel,
  CASE WHEN f.id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_complet,
  p.rank_partial,
  f.rank_full
FROM partial_results p
FULL OUTER JOIN full_results f ON p.id = f.id
ORDER BY 
  CASE WHEN p.id IS NOT NULL AND f.id IS NOT NULL THEN 1
       WHEN p.id IS NOT NULL THEN 2
       ELSE 3 END,
  COALESCE(p.rank_partial, f.rank_full) DESC;

-- ========================================
-- 5. TESTS DE PERFORMANCE
-- ========================================

-- Test 1: Mesurer le temps d'exécution
EXPLAIN ANALYZE
SELECT * FROM search_artisans('Dupont', 20, 0);

-- Test 2: Vérifier l'utilisation des index
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  id,
  plain_nom,
  rank
FROM search_artisans('Dupont', 20, 0)
ORDER BY rank DESC;

-- ========================================
-- 6. VALIDATION DES SCORES
-- ========================================

-- Test 1: Vérifier que les correspondances exactes ont un meilleur score
SELECT 
  numero_associe,
  plain_nom,
  raison_sociale,
  rank,
  CASE 
    WHEN numero_associe ILIKE '%Dupont%' THEN 'Correspondance numero_associe'
    WHEN plain_nom ILIKE '%Dupont%' THEN 'Correspondance plain_nom'
    WHEN raison_sociale ILIKE '%Dupont%' THEN 'Correspondance raison_sociale'
    ELSE 'Autre'
  END as type_correspondance
FROM search_artisans('Dupont', 20, 0)
ORDER BY rank DESC;

-- Test 2: Vérifier les bonus de score
SELECT 
  numero_associe,
  plain_nom,
  rank,
  CASE 
    WHEN numero_associe ILIKE '%Dup%' THEN 'Bonus numero_associe'
    WHEN plain_nom ILIKE '%Dup%' THEN 'Bonus plain_nom'
    WHEN raison_sociale ILIKE '%Dup%' THEN 'Bonus raison_sociale'
    ELSE 'Pas de bonus'
  END as bonus_applique
FROM search_artisans('Dup', 20, 0)
ORDER BY rank DESC
LIMIT 10;

-- ========================================
-- 7. TESTS AVEC DIFFÉRENTS TERMES
-- ========================================

-- Test 1: Recherche par métier
SELECT * FROM search_artisans('plombier', 10, 0);

-- Test 2: Recherche par ville
SELECT * FROM search_artisans('Paris', 10, 0);

-- Test 3: Recherche par email
SELECT * FROM search_artisans('@gmail', 10, 0);

-- Test 4: Recherche avec plusieurs mots
SELECT * FROM search_artisans('Dupont Paris', 10, 0);

-- Test 5: Recherche avec préfixe très court (1-2 caractères)
SELECT 
  'Test 5: Recherche "Du"' as test_name,
  COUNT(*) as nombre_resultats
FROM search_artisans('Du', 20, 0);

-- ========================================
-- 8. TESTS DE CAS LIMITES
-- ========================================

-- Test 1: Requête vide
SELECT * FROM search_artisans('', 10, 0);

-- Test 2: Requête avec seulement des espaces
SELECT * FROM search_artisans('   ', 10, 0);

-- Test 3: Requête avec caractères spéciaux
SELECT * FROM search_artisans('Dupont-Martin', 10, 0);

-- Test 4: Requête avec apostrophe
SELECT * FROM search_artisans('D''Artagnan', 10, 0);

-- ========================================
-- 9. STATISTIQUES DE RECHERCHE
-- ========================================

-- Test 1: Statistiques globales
SELECT 
  'Recherche "Dupont"' as terme,
  COUNT(*) as total_resultats,
  AVG(rank) as score_moyen,
  MAX(rank) as score_max,
  MIN(rank) as score_min
FROM search_artisans('Dupont', 100, 0);

-- Test 2: Distribution des scores
SELECT 
  CASE 
    WHEN rank >= 1.0 THEN 'Très élevé (>=1.0)'
    WHEN rank >= 0.5 THEN 'Élevé (0.5-1.0)'
    WHEN rank >= 0.2 THEN 'Moyen (0.2-0.5)'
    WHEN rank >= 0.1 THEN 'Faible (0.1-0.2)'
    ELSE 'Très faible (<0.1)'
  END as categorie_score,
  COUNT(*) as nombre_resultats
FROM search_artisans('Dupont', 100, 0)
GROUP BY categorie_score
ORDER BY MIN(rank) DESC;

-- ========================================
-- 10. VALIDATION FONCTIONNELLE
-- ========================================

-- Test 1: Vérifier qu'il n'y a pas de doublons
SELECT 
  'Test 1: Vérification doublons' as test_name,
  COUNT(*) as total_resultats,
  COUNT(DISTINCT id) as resultats_uniques,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT id) THEN '✅ Pas de doublons'
    ELSE '❌ Doublons détectés'
  END as statut
FROM search_artisans('Dupont', 100, 0);

-- Test 2: Vérifier que tous les artisans actifs sont recherchables
WITH all_active_artisans AS (
  SELECT DISTINCT id, plain_nom
  FROM artisans
  WHERE is_active = true
  LIMIT 10
),
search_results AS (
  SELECT DISTINCT id
  FROM search_artisans('', 200, 0)  -- Recherche vide devrait retourner vide
)
SELECT 
  'Test 2: Couverture artisans actifs' as test_name,
  COUNT(DISTINCT a.id) as total_actifs,
  COUNT(DISTINCT s.id) as trouves_par_recherche,
  CASE 
    WHEN COUNT(DISTINCT s.id) = 0 THEN '✅ Recherche vide retourne vide (attendu)'
    ELSE '⚠️ Résultats inattendus'
  END as statut
FROM all_active_artisans a
LEFT JOIN search_results s ON a.id = s.id;

-- ========================================
-- 11. COMPARAISON AVEC RECHERCHE DIRECTE
-- ========================================

-- Test 1: Comparer avec recherche ILIKE directe
SELECT 
  'Recherche RPC' as methode,
  COUNT(*) as nombre_resultats
FROM search_artisans('Dupont', 100, 0)
UNION ALL
SELECT 
  'Recherche ILIKE directe' as methode,
  COUNT(*) as nombre_resultats
FROM artisans_search_mv
WHERE plain_nom ILIKE '%Dupont%'
   OR raison_sociale ILIKE '%Dupont%'
   OR numero_associe ILIKE '%Dupont%';

-- ========================================
-- NOTES ET INTERPRÉTATION
-- ========================================
-- 
-- Résultats attendus après la modification:
-- 
-- 1. Recherche partielle: "Dup" devrait trouver:
--    - Les artisans avec "Dupont" dans plain_nom (via ILIKE)
--    - Les artisans avec "Dupré" dans plain_nom (via préfixe)
--    - Les artisans avec "Dup" dans numero_associe (via ILIKE)
--
-- 2. Les scores devraient être:
--    - Plus élevés pour les correspondances exactes
--    - Moyens pour les correspondances avec préfixe
--    - Bonus de 0.5 pour numero_associe
--    - Bonus de 0.4 pour plain_nom
--    - Bonus de 0.3 pour raison_sociale
--
-- 3. Performance: La recherche combinée peut être légèrement plus lente
--    mais devrait rester acceptable (<500ms pour 100 résultats)
--
-- Si les tests échouent:
--   1. Vérifier que la migration a été appliquée correctement
--   2. Vérifier que la vue matérialisée a été rafraîchie
--   3. Vérifier les logs PostgreSQL pour les erreurs éventuelles
-- ========================================

