-- ========================================
-- Configuration automatique du job cron pour le podium
-- ========================================

-- IMPORTANT: Cette migration nécessite que l'extension pg_cron soit déjà activée
-- Si pg_cron n'est pas activé, cette migration échouera de manière silencieuse

-- Vérifier si pg_cron est disponible
DO $$
BEGIN
  -- Vérifier si l'extension pg_cron existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE 'ATTENTION: pg_cron n''est pas activé. Veuillez l''activer dans Dashboard > Database > Extensions';
    RAISE NOTICE 'Le job cron ne sera pas créé automatiquement.';
    RAISE NOTICE 'Vous devrez le créer manuellement via le SQL Editor.';
  ELSE
    RAISE NOTICE 'pg_cron est activé, configuration du job...';
  END IF;
END $$;

-- Supprimer le job s'il existe déjà (pour éviter les doublons)
SELECT cron.unschedule('refresh-podium-period')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-podium-period'
);

-- Créer le job cron pour rafraîchir le podium chaque vendredi à 16h UTC
-- Note: Ajustez l'heure selon votre timezone
-- UTC: '0 16 * * 5'
-- Paris hiver (UTC+1): '0 15 * * 5'
-- Paris été (UTC+2): '0 14 * * 5'
SELECT cron.schedule(
  'refresh-podium-period',           -- nom du job
  '0 16 * * 5',                      -- cron expression: vendredis à 16h UTC
  $$SELECT public.refresh_current_podium_period()$$
);

-- Vérifier que le job a été créé
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'refresh-podium-period';

  IF job_count > 0 THEN
    RAISE NOTICE '✓ Job cron "refresh-podium-period" créé avec succès';
  ELSE
    RAISE WARNING '✗ Le job cron n''a pas pu être créé. Vérifiez que pg_cron est activé.';
  END IF;
END $$;

-- Afficher les informations du job
DO $$
DECLARE
  job_info RECORD;
BEGIN
  SELECT * INTO job_info
  FROM cron.job
  WHERE jobname = 'refresh-podium-period';

  IF FOUND THEN
    RAISE NOTICE 'Job ID: %, Schedule: %, Command: %',
      job_info.jobid,
      job_info.schedule,
      job_info.command;
  END IF;
END $$;

COMMENT ON FUNCTION public.refresh_current_podium_period IS
  'Rafraîchit la période de podium actuelle - Appelé automatiquement chaque vendredi à 16h par pg_cron';
