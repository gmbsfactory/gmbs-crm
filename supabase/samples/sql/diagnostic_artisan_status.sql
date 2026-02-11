-- =====================================================
-- DIAGNOSTIC: Système de statut artisan
-- Exécuter ce script dans le SQL Editor de Supabase
-- =====================================================

-- 1. Vérifier si la fonction RPC existe et son type de retour
SELECT
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'recalculate_artisan_status'
  AND n.nspname = 'public';

-- 2. Vérifier les triggers sur la table interventions
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'interventions'
ORDER BY trigger_name;

-- 3. Vérifier les triggers sur intervention_artisans
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'intervention_artisans'
ORDER BY trigger_name;

-- 4. Vérifier que les statuts intervention existent
SELECT id, code, label FROM intervention_statuses
WHERE code IN ('TERMINE', 'INTER_TERMINEE');

-- 5. Vérifier que les statuts artisan existent
SELECT id, code, label FROM artisan_statuses
ORDER BY code;

-- 6. Tester la fonction avec un artisan existant
-- Récupérer un artisan de test
SELECT a.id, a.nom_entreprise,
  s.code as current_status,
  (SELECT COUNT(*)
   FROM intervention_artisans ia
   JOIN interventions i ON i.id = ia.intervention_id
   JOIN intervention_statuses ist ON ist.id = i.statut_id
   WHERE ia.artisan_id = a.id AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
  ) as completed_count
FROM artisans a
LEFT JOIN artisan_statuses s ON s.id = a.statut_id
LIMIT 5;

-- 7. Test manuel de la fonction RPC (remplacer l'UUID)
-- SELECT recalculate_artisan_status('REMPLACER-PAR-UN-UUID-ARTISAN');

-- 8. Vérifier les dernières migrations appliquées
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
