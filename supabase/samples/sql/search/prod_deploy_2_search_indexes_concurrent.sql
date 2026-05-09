-- ============================================================================
-- Pre-deploy STEP 2/2 : Hybrid Search — indexes CONCURRENTLY
-- ============================================================================
--
-- ❌ NE FONCTIONNE PAS dans le Supabase SQL editor (web).
--    L'éditeur web wrappe TOUTE requête (même un statement seul) en
--    BEGIN/COMMIT implicite. CREATE INDEX CONCURRENTLY est interdit dans
--    une transaction → erreur 25001 systématique.
--
-- ✅ MÉTHODE VALIDE : psql en local avec -c (un statement par invocation).
--
--    1. Récupérer la connection string :
--       Supabase Dashboard → Project Settings → Database → Connection string → URI
--
--    2. Lancer chaque index séparément :
--       psql "postgresql://postgres:[PWD]@db.[PROJ].supabase.co:5432/postgres" \
--         -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_search_vector_live \
--             ON public.interventions USING gin(search_vector);"
--
--    Répéter pour les 4 indexes ci-dessous. `psql -c` envoie le statement
--    en mode autocommit, hors transaction.
--
-- Idempotent : `IF NOT EXISTS` permet de relancer après échec.
-- Si un index reste en état INVALID (échec en cours de build), le DROPper
-- avant de relancer :
--   psql ... -c "DROP INDEX CONCURRENTLY IF EXISTS idx_<nom>;"
--
-- PRÉREQUIS : le script `prod_deploy_1_search_columns.sql` doit avoir été
-- appliqué (les colonnes `search_vector` doivent exister). Celui-ci peut
-- être lancé depuis le SQL editor sans problème.
-- ============================================================================

-- 1. GIN sur interventions.search_vector (full-text live)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_search_vector_live
  ON public.interventions USING gin(search_vector);

-- 2. GIN sur artisans.search_vector (full-text live)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_search_vector_live
  ON public.artisans USING gin(search_vector);

-- 3. B-tree partiel sur interventions.updated_at (fenêtre temporelle buffer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_updated_at
  ON public.interventions(updated_at DESC) WHERE is_active = true;

-- 4. B-tree partiel sur artisans.updated_at (fenêtre temporelle buffer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_updated_at
  ON public.artisans(updated_at DESC) WHERE is_active = true;

-- ============================================================================
-- Vérification post-application :
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename IN ('interventions', 'artisans')
--     AND (indexname LIKE 'idx_%search_vector%' OR indexname LIKE 'idx_%updated_at%');
--
-- Détecter un index resté INVALID après échec :
--
--   SELECT c.relname, i.indisvalid
--   FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
--   WHERE c.relname LIKE 'idx_%search_vector%' OR c.relname LIKE 'idx_%updated_at%';
-- ============================================================================
