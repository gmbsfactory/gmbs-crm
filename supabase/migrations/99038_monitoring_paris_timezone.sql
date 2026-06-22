-- ============================================================================
-- 99038 — Monitoring : bucketing jour/heure en Europe/Paris (et non UTC)
-- ============================================================================
-- Problème : la session Supabase est en UTC. Les RPC de monitoring bucketent
-- par jour (`::date`) et par heure (`EXTRACT(hour FROM …)`) en UTC. Pour un
-- utilisateur Paris (UTC+1/+2), une journée « minuit→minuit » UTC ne correspond
-- pas à la journée Paris : "aujourd'hui" affiche une partie d'hier, les
-- déconnexions tombent à 02:00 (= minuit UTC en été), et la heatmap est décalée
-- d'1–2 colonnes.
--
-- Correctif chirurgical et réversible : on fixe le fuseau d'exécution de chaque
-- fonction concernée à Europe/Paris via `ALTER FUNCTION … SET timezone`. Toutes
-- les conversions `timestamptz → date` / `EXTRACT(hour …)` / `date_trunc` à
-- l'intérieur s'effectuent alors en heure de Paris. Le corps des fonctions
-- n'est PAS modifié (aucun risque de régression logique).
--
-- Côté JS (coordonné) : les paramètres `date` des RPC sont sérialisés en jour
-- Paris (src/lib/monitoring/local-date.ts → toParisDateStr). Les RPC à
-- paramètres `timestamptz` reçoivent déjà l'instant exact (minuit Paris) ; seul
-- leur bucketing interne avait besoin du fuseau.
--
-- Réversible : ALTER FUNCTION … RESET timezone; (ou SET timezone = 'UTC').
-- ============================================================================

ALTER FUNCTION public.get_activity_heatmap(timestamptz, timestamptz, text, uuid[])
  SET timezone = 'Europe/Paris';

ALTER FUNCTION public.get_team_connections(date, date, uuid[])
  SET timezone = 'Europe/Paris';

ALTER FUNCTION public.get_team_weekly_stats(date, date)
  SET timezone = 'Europe/Paris';

ALTER FUNCTION public.get_team_daily_overview(date)
  SET timezone = 'Europe/Paris';

ALTER FUNCTION public.get_user_daily_activity(uuid, date)
  SET timezone = 'Europe/Paris';
