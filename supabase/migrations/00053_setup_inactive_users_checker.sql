-- ========================================
-- Configuration automatique du système de détection d'utilisateurs inactifs
-- ========================================
--
-- Ce système fonctionne comme Teams/Skype/Slack:
-- 1. Le client envoie un heartbeat toutes les 30s → met à jour last_seen_at
-- 2. Un job cron vérifie toutes les 60s si des utilisateurs sont inactifs
-- 3. Si last_seen_at > 90s → status passe automatiquement à 'offline'
--
-- AVANTAGES:
-- - Détection fiable même si l'onglet crash ou est tué
-- - Pas de dépendance aux événements beforeunload/pagehide du navigateur
-- - Gestion multi-onglets automatique (le serveur est la source de vérité)

-- ========================================
-- Fonction pour détecter et mettre offline les utilisateurs inactifs
-- ========================================
CREATE OR REPLACE FUNCTION public.check_inactive_users()
RETURNS TABLE(
  users_set_offline INTEGER,
  affected_user_ids TEXT[]
) AS $$
DECLARE
  threshold_timestamp TIMESTAMPTZ;
  affected_users TEXT[];
  affected_count INTEGER;
BEGIN
  -- Calculer le timestamp de seuil (maintenant - 90 secondes)
  -- Si un utilisateur n'a pas envoyé de heartbeat depuis 90s, il est considéré offline
  threshold_timestamp := NOW() - INTERVAL '90 seconds';

  RAISE NOTICE '[check_inactive_users] Checking for users inactive since %', threshold_timestamp;

  -- Mettre à jour tous les utilisateurs inactifs en une seule requête
  WITH updated_users AS (
    UPDATE public.users
    SET status = 'offline'
    WHERE status IN ('connected', 'busy', 'dnd')  -- Seulement les utilisateurs actifs
      AND (last_seen_at IS NULL OR last_seen_at < threshold_timestamp)  -- Pas de heartbeat depuis 90s
    RETURNING id, email, username, last_seen_at
  )
  SELECT
    COUNT(*)::INTEGER,
    ARRAY_AGG(id::TEXT)
  INTO affected_count, affected_users
  FROM updated_users;

  -- Log pour debugging
  IF affected_count > 0 THEN
    RAISE NOTICE '[check_inactive_users] Set % user(s) to offline: %', affected_count, affected_users;
  ELSE
    RAISE NOTICE '[check_inactive_users] No inactive users found';
  END IF;

  -- Retourner les résultats
  RETURN QUERY SELECT affected_count, affected_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_inactive_users IS
  'Détecte et met offline les utilisateurs qui n''ont pas envoyé de heartbeat depuis 90 secondes - Appelé automatiquement toutes les 60s par pg_cron';

-- ========================================
-- Configuration du job cron
-- ========================================

-- Vérifier si pg_cron est disponible
DO $$
BEGIN
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
SELECT cron.unschedule('check-inactive-users-cron')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-inactive-users-cron'
);

-- Créer le job cron pour vérifier les utilisateurs inactifs toutes les 60 secondes
-- Expression cron: '* * * * *' = toutes les minutes
SELECT cron.schedule(
  'check-inactive-users-cron',           -- nom du job
  '* * * * *',                            -- cron expression: chaque minute (60 secondes)
  $$SELECT public.check_inactive_users()$$
);

-- Vérifier que le job a été créé
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'check-inactive-users-cron';

  IF job_count > 0 THEN
    RAISE NOTICE '✓ Job cron "check-inactive-users-cron" créé avec succès';
    RAISE NOTICE '  → Vérifie les utilisateurs inactifs toutes les 60 secondes';
    RAISE NOTICE '  → Met automatiquement offline les utilisateurs sans heartbeat depuis 90s';
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
  WHERE jobname = 'check-inactive-users-cron';

  IF FOUND THEN
    RAISE NOTICE 'Job ID: %, Schedule: %, Command: %',
      job_info.jobid,
      job_info.schedule,
      job_info.command;
  END IF;
END $$;

-- ========================================
-- Test manuel (optionnel)
-- ========================================
-- Pour tester manuellement la fonction:
-- SELECT * FROM public.check_inactive_users();
