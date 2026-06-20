# Monitoring — Référence API

> Sources : `supabase/migrations/99033_dev_monitoring_rpcs.sql`, `src/lib/api/monitoring.ts`, `src/hooks/useGlobalActivityFeed.ts`, `src/hooks/useTeamConnections.ts`, `src/types/monitoring.ts`

Données alimentant le dashboard **Monitoring DEV** (`/monitoring-dev`, réservé au rôle `dev`).
La page **lit des données déjà collectées** (audit logs, sessions de pages, présence temps réel) ; ces RPC ne sont que des agrégations de lecture.

---

## RPC `get_global_activity_feed`

Flux global de **toutes les actions** du CRM (interventions + artisans) sur une période, avec auteur, filtres et pagination.

```sql
get_global_activity_feed(
  p_date_start   timestamptz,
  p_date_end     timestamptz,
  p_user_ids     uuid[]  DEFAULT NULL,  -- filtre par auteur (actor_user_id)
  p_action_types text[]  DEFAULT NULL,  -- ex. {CREATE, STATUS_CHANGE}
  p_entity_types text[]  DEFAULT NULL,  -- {intervention} | {artisan}
  p_limit        int     DEFAULT 200,
  p_offset       int     DEFAULT 0
) RETURNS jsonb
```

- **Sources** : `UNION ALL` de `intervention_audit_log` et `artisan_audit_log` (alimentés par triggers).
- **Bornes** : `occurred_at` entre `p_date_start` et `p_date_end` (inclusives).
- **Retour** : `{ "items": GlobalActivityRow[], "total": number }` (tri `occurred_at DESC`).
- Chaque `item` reprend la forme `RecentAction` (`action_type`, `entity_type`, `entity_id`, `entity_label`, `entity_meta`, `occurred_at`, `changed_fields`, `old_values`, `new_values`) **enrichie de** `actor: { user_id, display, code, color }` (snapshot figé dans l'audit).

## RPC `get_team_connections`

Horaires de **connexion / déconnexion** et temps de présence par jour, dérivés des sessions de pages (aucune nouvelle instrumentation).

```sql
get_team_connections(
  p_date_start date,
  p_date_end   date,
  p_user_ids   uuid[] DEFAULT NULL
) RETURNS jsonb
```

- **Source** : `user_page_sessions` (`started_at` / `ended_at` / `duration_ms`).
- **Retour** : tableau de gestionnaires `TeamConnection[]`. Par utilisateur, un tableau `days` ; par jour :
  - `first_seen_at` = **connexion** (première activité du jour),
  - `last_seen_at` = **déconnexion** (dernière activité),
  - `total_screen_time_ms`, `sessions[]` (segments par page).
- N'inclut que les utilisateurs non archivés ayant au moins une session sur la période.

## RPC `get_activity_heatmap`

Comptes d'actions par gestionnaire et par bucket de temps (vue **Pulse**).

```sql
get_activity_heatmap(
  p_date_start timestamptz,
  p_date_end   timestamptz,
  p_bucket     text   DEFAULT 'hour',  -- 'hour' | 'day'
  p_user_ids   uuid[] DEFAULT NULL
) RETURNS jsonb
```

- **Source** : `UNION ALL` des deux audit logs, groupé par `actor_user_id` × bucket.
- `bucket` = heure (`"08".."19"`) si `'hour'`, sinon date (`"YYYY-MM-DD"`).
- **Retour** : `HeatmapCell[]` (`{ user_id, firstname, lastname, color, code_gestionnaire, bucket, count }`). Le front pivote en grille gestionnaires × buckets.

## RPC `get_top_entities`

Entités (interventions/artisans) les plus actives sur la période (vue **Pulse**).

```sql
get_top_entities(
  p_date_start timestamptz,
  p_date_end   timestamptz,
  p_limit      int    DEFAULT 10,
  p_user_ids   uuid[] DEFAULT NULL
) RETURNS jsonb
```

- **Retour** : `TopEntity[]` (`{ entity_type, entity_id, entity_label, count, last_action_at }`), trié par `count` décroissant.

## Sécurité

Les deux fonctions sont `SECURITY DEFINER` avec un **guard interne dev-only** (pas seulement une garde UI) :

```sql
IF NOT public.user_has_role('dev') THEN
  RAISE EXCEPTION 'forbidden: dev role required' USING errcode = '42501';
END IF;
```

Un appelant non-`dev` (même authentifié) reçoit une erreur `42501`. `GRANT EXECUTE … TO authenticated` (le guard fait foi).

---

## Couche données (front)

Conformément au CLAUDE.md, les composants ne touchent jamais Supabase directement.

- **API** : `src/lib/api/monitoring.ts` → `monitoringApi.getGlobalActivityFeed(params)`, `monitoringApi.getTeamConnections(start, end, userIds?)` (réexporté par la façade `@/lib/api`).
- **Types** : `src/types/monitoring.ts` (`GlobalActivityRow`, `GlobalActivityFeedResult`, `TeamConnection`, `TeamConnectionDay`, `ActivityActor`).
- **Hooks** :
  - `useGlobalActivityFeed({ startDate, endDate, userIds?, actionTypes?, entityTypes?, enabled? })` — `useInfiniteQuery`, pagination « charger plus » (page = 100), `staleTime 60 s`. Clé : `['global-activity-feed', startIso, endIso, userIds, actionTypes, entityTypes]`.
  - `useTeamConnections(startDate, endDate, userIds?, enabled?)` — `useQuery`, `staleTime 2 min`. Clé : `['team-connections', startStr, endStr, userIds]`.
  - `useActivityHeatmap(startDate, endDate, bucket, userIds?, enabled?)` — `useQuery`. Clé : `['activity-heatmap', …]`.
  - `useTopEntities(startDate, endDate, limit?, userIds?, enabled?)` — `useQuery`. Clé : `['top-entities', …]`.

> La colonne **LIVE** (présence) s'enrichit via `get_team_weekly_stats(today, today)` (RPC déjà déployée) pour le temps écran et la répartition par page — elle ne dépend donc pas de la migration 99033.

> Les stats agrégées par période réutilisent la RPC existante `get_team_weekly_stats(p_start_date, p_end_date)` (déjà à plage) — voir `WeeklyStatsTable`.

## Vérification manuelle (SQL Editor Supabase)

```sql
-- En tant que dev : renvoie des données ; sinon -> erreur 'forbidden'
select get_global_activity_feed(now() - interval '7 days', now());
select get_team_connections(current_date - 7, current_date);
select get_activity_heatmap(now() - interval '7 days', now(), 'day');
select get_top_entities(now() - interval '7 days', now());
```
