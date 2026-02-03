-- Script de test pour le système de période du podium
-- À exécuter dans le SQL Editor de Supabase

-- 1. Tester la fonction de calcul de période
SELECT
  'Test 1: Période actuelle' as test,
  public.get_current_podium_period() as result;

-- 2. Vérifier la table podium_periods
SELECT
  'Test 2: Périodes enregistrées' as test,
  *
FROM public.podium_periods
ORDER BY created_at DESC;

-- 3. Rafraîchir manuellement la période
SELECT
  'Test 3: Rafraîchissement manuel' as test,
  public.refresh_current_podium_period() as result;

-- 4. Vérifier que la période courante a été créée/mise à jour
SELECT
  'Test 4: Période courante après rafraîchissement' as test,
  *
FROM public.podium_periods
WHERE is_current = true;

-- 5. Vérifier les jobs cron (nécessite les privilèges postgres)
-- SELECT
--   'Test 5: Jobs cron configurés' as test,
--   *
-- FROM cron.job
-- WHERE jobname = 'refresh-podium-period';

-- 6. Simuler différentes dates et heures
-- (Ces tests ne modifient pas les données, juste des calculs)

-- Test: Vendredi 15h (avant le rafraîchissement)
DO $$
DECLARE
  test_time timestamptz;
  result jsonb;
BEGIN
  -- Cette fonction utilise now(), donc on ne peut pas facilement simuler
  -- Mais on peut vérifier la logique manuellement
  RAISE NOTICE 'Test conceptuel: Si on est vendredi avant 16h, la période devrait commencer le vendredi précédent';
END $$;

-- 7. Vérifier les permissions
SELECT
  'Test 6: Permissions' as test,
  has_function_privilege('authenticated', 'public.get_current_podium_period()', 'EXECUTE') as can_execute_get,
  has_table_privilege('authenticated', 'public.podium_periods', 'SELECT') as can_select_table;

-- 8. Tester la cohérence des données
SELECT
  'Test 7: Cohérence - Une seule période courante' as test,
  COUNT(*) as count_current_periods
FROM public.podium_periods
WHERE is_current = true;

-- Le résultat devrait être 1 ou 0, jamais plus

-- 9. Afficher des informations de debug
SELECT
  'Test 8: Debug - État actuel' as test,
  now() as current_time_utc,
  EXTRACT(DOW FROM now()) as day_of_week,  -- 0=Dimanche, 5=Vendredi
  EXTRACT(HOUR FROM now()) as current_hour,
  (SELECT period_start FROM public.podium_periods WHERE is_current = true) as active_period_start,
  (SELECT period_end FROM public.podium_periods WHERE is_current = true) as active_period_end;
