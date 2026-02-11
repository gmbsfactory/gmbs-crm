-- Test rapide pour vérifier les données
SELECT 'interventions' as table_name, COUNT(*) as count FROM interventions
UNION ALL
SELECT 'artisans' as table_name, COUNT(*) as count FROM artisans
UNION ALL
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'agencies' as table_name, COUNT(*) as count FROM agencies
UNION ALL
SELECT 'clients' as table_name, COUNT(*) as count FROM clients
UNION ALL
SELECT 'metiers' as table_name, COUNT(*) as count FROM metiers
UNION ALL
SELECT 'intervention_statuses' as table_name, COUNT(*) as count FROM intervention_statuses;
