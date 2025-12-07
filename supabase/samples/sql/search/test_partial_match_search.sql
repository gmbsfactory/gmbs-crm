-- ========================================
-- TESTS DE RECHERCHE AVEC CORRESPONDANCES PARTIELLES
-- ========================================
-- Ce fichier teste la fonctionnalité de recherche améliorée qui permet
-- de trouver des correspondances partielles (ex: "Flat" -> "Flatlooker")
--
-- Date: 2025-01-XX
-- Migration: 00020_search_materialized_views.sql
-- ========================================

-- ========================================
-- 1. TESTS DE BASE - CORRESPONDANCES PARTIELLES
-- ========================================

-- Test 1: Recherche "Flat" devrait trouver "Flatlooker"
-- AVANT la modification: ne trouvait que "FLAT IRON" dans l'adresse
-- APRÈS la modification: devrait trouver "Flatlooker" ET "FLAT IRON"
SELECT 
  'Test 1: Recherche "Flat"' as test_name,
  COUNT(*) as nombre_resultats,
  COUNT(CASE WHEN agence_label ILIKE '%Flatlooker%' THEN 1 END) as avec_flatlooker,
  COUNT(CASE WHEN adresse ILIKE '%FLAT IRON%' THEN 1 END) as avec_flat_iron
FROM search_interventions('Flat', 100, 0);

-- Afficher les résultats détaillés
SELECT 
  id_inter,
  agence_label,
  contexte_intervention,
  adresse,
  rank
FROM search_interventions('Flat', 20, 0)
ORDER BY rank DESC;

-- Test 2: Recherche "Flatlooker" (nom complet) - devrait toujours fonctionner
SELECT 
  'Test 2: Recherche "Flatlooker" (complet)' as test_name,
  COUNT(*) as nombre_resultats
FROM search_interventions('Flatlooker', 100, 0);

-- Afficher les résultats
SELECT 
  id_inter,
  agence_label,
  contexte_intervention,
  rank
FROM search_interventions('Flatlooker', 10, 0)
ORDER BY rank DESC;

-- ========================================
-- 2. COMPARAISON AVANT/APRÈS
-- ========================================

-- Test 3: Comparer les résultats avec recherche partielle vs complète
WITH partial_results AS (
  SELECT id, agence_label, rank as rank_partial
  FROM search_interventions('Flat', 50, 0)
),
full_results AS (
  SELECT id, agence_label, rank as rank_full
  FROM search_interventions('Flatlooker', 50, 0)
)
SELECT 
  COALESCE(p.agence_label, f.agence_label) as agence,
  CASE WHEN p.id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_flat,
  CASE WHEN f.id IS NOT NULL THEN 'Oui' ELSE 'Non' END as trouve_avec_flatlooker,
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
-- 3. TESTS DE PERFORMANCE
-- ========================================

-- Test 4: Mesurer le temps d'exécution
EXPLAIN ANALYZE
SELECT * FROM search_interventions('Flat', 20, 0);

-- Test 5: Vérifier l'utilisation des index
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  id,
  agence_label,
  rank
FROM search_interventions('Flat', 20, 0)
ORDER BY rank DESC;

-- ========================================
-- 4. TESTS AVEC D'AUTRES TERMES PARTIELS
-- ========================================

-- Test 6: Recherche partielle sur d'autres agences
-- (Remplacer "AFE" par un préfixe d'agence existant dans votre base)
SELECT 
  'Test 6: Recherche "AFE" (préfixe)' as test_name,
  COUNT(*) as nombre_resultats,
  string_agg(DISTINCT agence_label, ', ') as agences_trouvees
FROM search_interventions('AFE', 50, 0);

-- Test 7: Recherche avec plusieurs mots
SELECT * FROM search_interventions('Flat Paris', 10, 0);

-- Test 8: Recherche avec préfixe très court (1-2 caractères)
-- Note: Les préfixes très courts peuvent être moins performants
SELECT 
  'Test 8: Recherche "Fl"' as test_name,
  COUNT(*) as nombre_resultats
FROM search_interventions('Fl', 20, 0);

-- ========================================
-- 5. VALIDATION DES SCORES
-- ========================================

-- Test 9: Vérifier que les correspondances exactes ont un meilleur score
SELECT 
  agence_label,
  rank,
  CASE 
    WHEN agence_label ILIKE '%Flatlooker%' THEN 'Correspondance exacte'
    WHEN agence_label ILIKE '%Flat%' THEN 'Correspondance partielle'
    ELSE 'Autre'
  END as type_correspondance
FROM search_interventions('Flatlooker', 20, 0)
ORDER BY rank DESC;

-- Test 10: Vérifier le bonus pour agence_label
SELECT 
  id_inter,
  agence_label,
  contexte_intervention,
  rank,
  CASE 
    WHEN agence_label ILIKE '%Flat%' THEN 'Bonus agence'
    ELSE 'Pas de bonus'
  END as bonus_applique
FROM search_interventions('Flat', 20, 0)
ORDER BY rank DESC
LIMIT 10;

-- ========================================
-- 6. TESTS DE CAS LIMITES
-- ========================================

-- Test 11: Requête vide
SELECT * FROM search_interventions('', 10, 0);

-- Test 12: Requête avec seulement des espaces
SELECT * FROM search_interventions('   ', 10, 0);

-- Test 13: Requête avec caractères spéciaux
SELECT * FROM search_interventions('Flat-looker', 10, 0);

-- Test 14: Requête avec apostrophe
SELECT * FROM search_interventions('L''agence', 10, 0);

-- ========================================
-- 7. STATISTIQUES DE RECHERCHE
-- ========================================

-- Test 15: Statistiques globales
SELECT 
  'Recherche "Flat"' as terme,
  COUNT(*) as total_resultats,
  COUNT(DISTINCT agence_label) as agences_differentes,
  AVG(rank) as score_moyen,
  MAX(rank) as score_max,
  MIN(rank) as score_min
FROM search_interventions('Flat', 100, 0);

-- Test 16: Distribution des scores
SELECT 
  CASE 
    WHEN rank >= 1.0 THEN 'Très élevé (>=1.0)'
    WHEN rank >= 0.5 THEN 'Élevé (0.5-1.0)'
    WHEN rank >= 0.2 THEN 'Moyen (0.2-0.5)'
    WHEN rank >= 0.1 THEN 'Faible (0.1-0.2)'
    ELSE 'Très faible (<0.1)'
  END as categorie_score,
  COUNT(*) as nombre_resultats
FROM search_interventions('Flat', 100, 0)
GROUP BY categorie_score
ORDER BY MIN(rank) DESC;

-- ========================================
-- 8. VALIDATION FONCTIONNELLE
-- ========================================

-- Test 17: Vérifier que toutes les interventions Flatlooker sont trouvables
WITH flatlooker_interventions AS (
  SELECT DISTINCT i.id
  FROM interventions i
  LEFT JOIN agencies a ON i.agence_id = a.id
  WHERE a.label ILIKE '%Flatlooker%'
    AND i.is_active = true
),
search_results AS (
  SELECT DISTINCT id
  FROM search_interventions('Flat', 200, 0)
)
SELECT 
  'Test 17: Couverture Flatlooker' as test_name,
  COUNT(DISTINCT f.id) as total_flatlooker,
  COUNT(DISTINCT s.id) as trouves_par_recherche,
  CASE 
    WHEN COUNT(DISTINCT f.id) = COUNT(DISTINCT s.id) THEN '✅ Tous trouvés'
    WHEN COUNT(DISTINCT s.id) > 0 THEN '⚠️ Partiellement trouvés'
    ELSE '❌ Aucun trouvé'
  END as statut
FROM flatlooker_interventions f
LEFT JOIN search_results s ON f.id = s.id;

-- Test 18: Vérifier qu'il n'y a pas de doublons
SELECT 
  'Test 18: Vérification doublons' as test_name,
  COUNT(*) as total_resultats,
  COUNT(DISTINCT id) as resultats_uniques,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT id) THEN '✅ Pas de doublons'
    ELSE '❌ Doublons détectés'
  END as statut
FROM search_interventions('Flat', 100, 0);

-- ========================================
-- NOTES ET INTERPRÉTATION
-- ========================================
-- 
-- Résultats attendus après la modification:
-- 
-- 1. Test 1: "Flat" devrait trouver à la fois:
--    - Les interventions avec agence "Flatlooker" (via ILIKE sur agence_label)
--    - Les interventions avec "FLAT IRON" dans l'adresse (via full-text)
--
-- 2. Test 2: "Flatlooker" devrait toujours fonctionner comme avant
--
-- 3. Les scores devraient être:
--    - Plus élevés pour les correspondances exactes
--    - Moyens pour les correspondances avec préfixe
--    - Bonus de 0.5 pour les correspondances dans agence_label
--
-- 4. Performance: La recherche combinée peut être légèrement plus lente
--    mais devrait rester acceptable (<500ms pour 100 résultats)
--
-- Si les tests échouent:
--   1. Vérifier que la migration a été appliquée correctement
--   2. Vérifier que la vue matérialisée a été rafraîchie
--   3. Vérifier les logs PostgreSQL pour les erreurs éventuelles
-- ========================================

