-- ========================================
-- FIX: Ajouter l'index unique manquant pour global_search_mv
-- ========================================
-- Ce script corrige l'erreur lors du REFRESH MATERIALIZED VIEW CONCURRENTLY
-- sur global_search_mv
--
-- Erreur: cannot refresh materialized view "public.global_search_mv" concurrently
-- HINT: Create a unique index with no WHERE clause on one or more columns
-- ========================================

-- Vérifier si l'index existe déjà
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'global_search_mv'
  AND indexname = 'idx_global_search_unique';

-- Créer l'index unique si il n'existe pas
-- La combinaison (entity_type, entity_id) identifie de manière unique chaque entité
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_search_unique 
ON global_search_mv(entity_type, entity_id);

-- Vérifier que l'index a été créé
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'global_search_mv'
  AND indexname = 'idx_global_search_unique';

-- Maintenant vous pouvez rafraîchir la vue avec CONCURRENTLY
-- REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;

