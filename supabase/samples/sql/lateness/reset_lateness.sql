-- Reset Lateness Data
-- Description: Script pour réinitialiser toutes les données de lateness pour permettre les tests
-- 
-- IMPORTANT: Pour tester complètement, vous devez aussi supprimer le cache localStorage côté client
-- La clé utilisée est: `last_activity_check_${userId}`
-- 
-- Pour supprimer le cache localStorage dans la console du navigateur:
-- localStorage.removeItem(`last_activity_check_${userId}`)
-- ou pour supprimer toutes les clés de cache:
-- Object.keys(localStorage).filter(key => key.startsWith('last_activity_check_')).forEach(key => localStorage.removeItem(key))

-- ============================================================================
-- OPTION 1: Réinitialiser TOUS les utilisateurs
-- ============================================================================
-- Réinitialise toutes les données de lateness pour tous les utilisateurs
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM CURRENT_DATE),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL;

-- ============================================================================
-- OPTION 2: Réinitialiser un utilisateur spécifique par email
-- ============================================================================
-- Remplacez 'user@example.com' par l'email de l'utilisateur à réinitialiser
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM CURRENT_DATE),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL
WHERE email = 'user@example.com';
*/

-- ============================================================================
-- OPTION 3: Réinitialiser un utilisateur spécifique par ID
-- ============================================================================
-- Remplacez 'user-uuid-here' par l'ID (UUID) de l'utilisateur à réinitialiser
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM CURRENT_DATE),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL
WHERE id = 'user-uuid-here';
*/

-- ============================================================================
-- OPTION 4: Réinitialiser un utilisateur spécifique par username
-- ============================================================================
-- Remplacez 'username' par le username de l'utilisateur à réinitialiser
/*
UPDATE public.users
SET
  lateness_count = 0,
  lateness_count_year = EXTRACT(YEAR FROM CURRENT_DATE),
  last_lateness_date = NULL,
  last_activity_date = NULL,
  lateness_notification_shown_at = NULL
WHERE username = 'username';
*/

-- ============================================================================
-- Vérification: Afficher les données après réinitialisation
-- ============================================================================
-- Exécutez cette requête pour vérifier que les données ont été réinitialisées
SELECT
  u.id,
  u.username,
  u.email,
  u.lateness_count,
  u.lateness_count_year,
  u.last_lateness_date,
  u.last_activity_date,
  u.lateness_notification_shown_at
FROM public.users u
ORDER BY u.username;
