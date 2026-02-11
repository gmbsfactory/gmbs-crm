-- =====================================================
-- TEST: Fonction recalculate_artisan_status
-- Exécuter après le déploiement de la migration 00076
-- =====================================================

-- 1. Vérifier que la fonction existe avec le bon type de retour
SELECT
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'recalculate_artisan_status'
  AND n.nspname = 'public';

-- Résultat attendu: return_type = 'text'

-- 2. Vérifier les triggers
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('interventions', 'intervention_artisans')
  AND trigger_name LIKE 'trg_artisan_%'
ORDER BY event_object_table, trigger_name;

-- Résultat attendu:
-- trg_artisan_status_on_intervention_insert | INSERT
-- trg_artisan_status_on_intervention_update | UPDATE
-- trg_artisan_status_on_link_change | INSERT/UPDATE/DELETE

-- 3. Trouver un artisan pour tester
WITH artisan_stats AS (
  SELECT
    a.id,
    a.nom_entreprise,
    s.code as current_status,
    (SELECT COUNT(*)
     FROM intervention_artisans ia
     JOIN interventions i ON i.id = ia.intervention_id
     JOIN intervention_statuses ist ON ist.id = i.statut_id
     WHERE ia.artisan_id = a.id AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
    ) as completed_count
  FROM artisans a
  LEFT JOIN artisan_statuses s ON s.id = a.statut_id
  WHERE a.deleted_at IS NULL
  LIMIT 10
)
SELECT * FROM artisan_stats;

-- 4. Tester la fonction RPC (copier un UUID de l'étape 3)
-- SELECT recalculate_artisan_status('COLLER-UUID-ICI');

-- 5. Test avec différents scénarios
-- Créer une transaction pour tester sans modifier les données réellement
-- BEGIN;
--   -- Simuler le passage d'une intervention à TERMINE
--   UPDATE interventions
--   SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'TERMINE')
--   WHERE id = 'UUID-INTERVENTION-TEST';
--
--   -- Vérifier que le statut artisan a changé
--   SELECT a.id, s.code
--   FROM artisans a
--   LEFT JOIN artisan_statuses s ON s.id = a.statut_id
--   WHERE a.id = 'UUID-ARTISAN-TEST';
--
-- ROLLBACK; -- Annuler les modifications
