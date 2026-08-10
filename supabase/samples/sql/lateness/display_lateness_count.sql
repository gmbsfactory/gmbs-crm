-- Etat des compteurs de retard par utilisateur.
--
-- `lateness_email_sent_at` est inclus volontairement : c'est lui qui bloque
-- l'envoi d'un second email le meme jour. S'il est a la date du jour alors que
-- vous attendez une notification, c'est la cause la plus probable.
--
-- L'annee de reference est calculee a Paris, comme cote applicatif
-- (cf. business-timezone.ts) : `EXTRACT(YEAR FROM CURRENT_DATE)` dependrait du
-- fuseau de la base et renverrait la mauvaise annee autour du 31/12 minuit UTC.
--
-- Pour reinitialiser : voir reset_lateness.sql (meme dossier).

-- Query 1: All users with lateness information (ordered by lateness count descending)
SELECT
  u.username,
  u.email,
  u.firstname,
  u.lastname,
  u.lateness_count,
  u.lateness_count_year,
  u.last_lateness_date,
  u.last_activity_date,
  u.lateness_notification_shown_at,
  u.lateness_email_sent_at
FROM public.users u
ORDER BY u.lateness_count DESC NULLS LAST, u.username;

-- Query 2: Users with lateness in the current year only
SELECT
  u.id,
  u.username,
  u.email,
  u.firstname,
  u.lastname,
  u.lateness_count,
  u.lateness_count_year,
  u.last_lateness_date,
  u.last_activity_date,
  u.lateness_notification_shown_at,
  u.lateness_email_sent_at
FROM public.users u
WHERE u.lateness_count_year = EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Paris'))
ORDER BY u.lateness_count DESC, u.username;

-- Query 3: Users with lateness (lateness_count > 0)
SELECT
  u.id,
  u.username,
  u.email,
  u.firstname,
  u.lastname,
  u.lateness_count,
  u.lateness_count_year,
  u.last_lateness_date,
  u.last_activity_date,
  u.lateness_notification_shown_at,
  u.lateness_email_sent_at
FROM public.users u
WHERE u.lateness_count > 0
ORDER BY u.lateness_count DESC, u.username;

-- Query 4: Summary statistics by year
SELECT 
  lateness_count_year AS year,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE lateness_count > 0) AS users_with_lateness,
  SUM(lateness_count) AS total_lateness_count,
  AVG(lateness_count) AS avg_lateness_count,
  MAX(lateness_count) AS max_lateness_count
FROM public.users
WHERE lateness_count_year IS NOT NULL
GROUP BY lateness_count_year
ORDER BY lateness_count_year DESC;
