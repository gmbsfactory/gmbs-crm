-- Show users and lateness count, lateness_count_year, last_lateness_date, last_activity_date & lateness_notification_shown_at

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
  u.lateness_notification_shown_at
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
  u.lateness_notification_shown_at
FROM public.users u
WHERE u.lateness_count_year = EXTRACT(YEAR FROM CURRENT_DATE)
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
  u.lateness_notification_shown_at
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
