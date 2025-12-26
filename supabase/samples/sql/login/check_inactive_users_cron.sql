-- ========================================
-- Script de diagnostic pour vérifier le job pg_cron
-- de détection des utilisateurs inactifs (migration 53)
-- ========================================
--
-- Ce script permet de vérifier:
-- 1. Si pg_cron est activé
-- 2. Si le job existe et est configuré correctement
-- 3. L'historique d'exécution du job
-- 4. Tester manuellement la fonction
-- 5. Vérifier les utilisateurs qui devraient être mis offline
--
-- ========================================
-- 1. Vérifier si pg_cron est activé
-- ========================================
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✓ pg_cron est activé'
    ELSE '✗ pg_cron N''EST PAS activé - Activez-le dans Dashboard > Database > Extensions'
  END AS pg_cron_status;

-- ========================================
-- 2. Vérifier si le job existe
-- ========================================
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobid::text || ' - ' || jobname AS job_info
FROM cron.job
WHERE jobname = 'check-inactive-users-cron';

-- Si aucun résultat, le job n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-inactive-users-cron') THEN
    RAISE WARNING '✗ Le job "check-inactive-users-cron" n''existe pas!';
    RAISE WARNING '  → Exécutez la migration 00053_setup_inactive_users_checker.sql';
  ELSE
    RAISE NOTICE '✓ Le job "check-inactive-users-cron" existe';
  END IF;
END $$;

-- ========================================
-- 3. Historique d'exécution du job (dernières 20 exécutions)
-- ========================================
SELECT 
  runid,
  jobid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  end_time - start_time AS duration
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-inactive-users-cron')
ORDER BY start_time DESC
LIMIT 20;

-- Résumé des exécutions
SELECT 
  status,
  COUNT(*) AS count,
  MIN(start_time) AS first_execution,
  MAX(start_time) AS last_execution
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-inactive-users-cron')
GROUP BY status
ORDER BY status;

-- ========================================
-- 4. Statistiques d'exécution récentes
-- ========================================
SELECT 
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE status = 'succeeded') AS successful,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  MAX(start_time) AS last_execution,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) AS avg_duration_seconds
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-inactive-users-cron')
  AND start_time > NOW() - INTERVAL '24 hours';

-- ========================================
-- 5. Test manuel de la fonction
-- ========================================
-- Exécuter la fonction manuellement pour voir le résultat
SELECT * FROM public.check_inactive_users();

-- ========================================
-- 6. Vérifier les utilisateurs qui devraient être mis offline
-- ========================================
-- Utilisateurs actifs mais sans heartbeat depuis plus de 90 secondes
SELECT 
  id,
  email,
  username,
  status,
  last_seen_at,
  NOW() - last_seen_at AS time_since_last_seen,
  CASE 
    WHEN last_seen_at IS NULL THEN 'Jamais de heartbeat'
    WHEN last_seen_at < NOW() - INTERVAL '90 seconds' THEN 'Devrait être offline (>90s)'
    ELSE 'OK (<90s)'
  END AS should_be_status
FROM public.users
WHERE status IN ('connected', 'busy', 'dnd')
  AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '90 seconds')
ORDER BY last_seen_at ASC NULLS FIRST;

-- Compte des utilisateurs par statut
SELECT 
  status,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE last_seen_at IS NULL) AS without_heartbeat,
  COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '90 seconds') AS inactive_90s
FROM public.users
GROUP BY status
ORDER BY status;

-- ========================================
-- 7. Vérifier la configuration du job (détails)
-- ========================================
SELECT 
  'Job Configuration' AS section,
  jobid::text AS job_id,
  jobname AS job_name,
  schedule AS cron_schedule,
  command AS sql_command,
  active AS is_active,
  CASE 
    WHEN schedule = '* * * * *' THEN '✓ Exécute toutes les minutes (60s)'
    ELSE '⚠ Schedule différent de "* * * * *"'
  END AS schedule_check
FROM cron.job
WHERE jobname = 'check-inactive-users-cron';

-- ========================================
-- 8. Dernières erreurs (si présentes)
-- ========================================
SELECT 
  runid,
  start_time,
  end_time,
  status,
  return_message,
  command
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-inactive-users-cron')
  AND status = 'failed'
ORDER BY start_time DESC
LIMIT 10;

-- ========================================
-- RÉSUMÉ FINAL
-- ========================================
DO $$
DECLARE
  cron_enabled BOOLEAN;
  job_exists BOOLEAN;
  recent_executions INTEGER;
  last_execution TIMESTAMPTZ;
  users_to_offline INTEGER;
BEGIN
  -- Vérifier pg_cron
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO cron_enabled;
  
  -- Vérifier le job
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-inactive-users-cron') INTO job_exists;
  
  -- Dernières exécutions (24h)
  SELECT COUNT(*), MAX(start_time)
  INTO recent_executions, last_execution
  FROM cron.job_run_details
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-inactive-users-cron')
    AND start_time > NOW() - INTERVAL '24 hours';
  
  -- Utilisateurs à mettre offline
  SELECT COUNT(*)
  INTO users_to_offline
  FROM public.users
  WHERE status IN ('connected', 'busy', 'dnd')
    AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '90 seconds');
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ DU DIAGNOSTIC';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'pg_cron activé: %', CASE WHEN cron_enabled THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE 'Job existe: %', CASE WHEN job_exists THEN '✓ OUI' ELSE '✗ NON' END;
  RAISE NOTICE 'Exécutions (24h): %', COALESCE(recent_executions, 0);
  RAISE NOTICE 'Dernière exécution: %', COALESCE(last_execution::text, 'Jamais');
  RAISE NOTICE 'Utilisateurs à mettre offline: %', users_to_offline;
  RAISE NOTICE '========================================';
  
  IF NOT cron_enabled THEN
    RAISE WARNING 'ACTION REQUISE: Activez pg_cron dans Dashboard > Database > Extensions';
  END IF;
  
  IF NOT job_exists THEN
    RAISE WARNING 'ACTION REQUISE: Exécutez la migration 00053_setup_inactive_users_checker.sql';
  END IF;
  
  IF recent_executions = 0 AND job_exists THEN
    RAISE WARNING 'ATTENTION: Le job existe mais n''a pas été exécuté récemment. Vérifiez la configuration.';
  END IF;
END $$;

