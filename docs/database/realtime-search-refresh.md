# Rafraîchissement Event-Driven des Vues Matérialisées

> Migration de pg_cron vers Database Webhook + Edge Function
> **Latence réduite : ~60s → ~5-10s**

## 📊 Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Tables sources     │     │  Database Webhook    │     │  Edge Function      │
│  (interventions,    │────▶│  (Supabase)          │────▶│  refresh-search-    │
│   comments, etc.)   │     │                      │     │  views              │
│                     │     │  Détecte INSERT/     │     │                     │
│  INSERT/UPDATE/     │     │  UPDATE/DELETE       │     │  Appelle RPC avec   │
│  DELETE             │     │                      │     │  debounce           │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                                                    │
                                                                    ▼
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  pg_cron (fallback) │     │  Fonction RPC        │     │  Vues matérialisées │
│  Toutes les 5 min   │────▶│  refresh_search_     │────▶│  - interventions_   │
│                     │     │  views_debounced     │     │    search_mv        │
│  Si webhook échoue  │     │                      │     │  - artisans_        │
│                     │     │  Debounce 5s         │     │    search_mv        │
└─────────────────────┘     └──────────────────────┘     │  - global_search_mv │
                                                          └─────────────────────┘
```

## 🚀 Installation

### 1. Déployer l'Edge Function

```bash
# Depuis la racine du projet
cd supabase/functions
supabase functions deploy refresh-search-views
```

### 2. Appliquer la migration SQL

```bash
supabase db push
```

Ou manuellement dans le SQL Editor de Supabase Dashboard :
- Exécuter `supabase/migrations/00059_realtime_search_views_refresh.sql`

### 3. Configurer les Database Webhooks

Dans le **Supabase Dashboard** :

#### a) Aller dans `Database > Webhooks`

#### b) Créer un webhook pour chaque table source

**Pour les interventions** (créer 6 webhooks) :

| Table | Events | URL | Headers |
|-------|--------|-----|---------|
| `interventions` | INSERT, UPDATE, DELETE | `https://<project-ref>.supabase.co/functions/v1/refresh-search-views` | `Authorization: Bearer <anon-key>` |
| `intervention_artisans` | INSERT, UPDATE, DELETE | ↑ même URL | ↑ même header |
| `comments` | INSERT, UPDATE, DELETE | ↑ même URL | ↑ même header |
| `agencies` | INSERT, UPDATE | ↑ même URL | ↑ même header |
| `tenants` | INSERT, UPDATE | ↑ même URL | ↑ même header |
| `owner` | INSERT, UPDATE | ↑ même URL | ↑ même header |

**Pour les artisans** (créer 3 webhooks) :

| Table | Events | URL | Headers |
|-------|--------|-----|---------|
| `artisans` | INSERT, UPDATE, DELETE | ↑ même URL | ↑ même header |
| `artisan_metiers` | INSERT, UPDATE, DELETE | ↑ même URL | ↑ même header |
| `artisan_zones` | INSERT, UPDATE, DELETE | ↑ même URL | ↑ même header |

#### c) Configuration détaillée d'un webhook

```
Name: refresh-search-views-interventions
Table: interventions
Schema: public
Events: ✓ INSERT  ✓ UPDATE  ✓ DELETE

HTTP Request
Method: POST
URL: https://<your-project-ref>.supabase.co/functions/v1/refresh-search-views

HTTP Headers:
Authorization: Bearer <your-anon-key>
Content-Type: application/json

HTTP Params: (laisser vide)
```

**Où trouver `<your-anon-key>` ?**
- Dashboard > Settings > API > Project API keys > `anon` `public`

## 🔧 Fonctionnement

### Flux nominal (latence ~5-10s)

1. **Modification de données**
   ```sql
   UPDATE interventions SET statut_id = '...' WHERE id = '...';
   ```

2. **Database Webhook détecte le changement**
   - Supabase détecte l'UPDATE instantanément
   - Envoie un POST à l'Edge Function

3. **Edge Function reçoit l'événement**
   ```typescript
   {
     type: "UPDATE",
     table: "interventions",
     schema: "public",
     record: { id: "...", statut_id: "...", ... }
   }
   ```

4. **Appel de la fonction RPC avec debounce**
   ```sql
   SELECT refresh_search_views_debounced(
     p_refresh_interventions := true,
     p_refresh_artisans := false
   );
   ```

5. **Debounce intelligent (5 secondes)**
   - Si dernier refresh < 5s : met juste un flag `needs_refresh = true`
   - Sinon : effectue le `REFRESH MATERIALIZED VIEW CONCURRENTLY`

6. **Refresh des vues**
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
   REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
   ```

### Flux de fallback (latence ~5 min)

Si le webhook échoue (réseau, Edge Function down, etc.) :

1. **pg_cron s'exécute toutes les 5 minutes**
2. **Vérifie si `needs_refresh = true` ET `last_flag_set > 5 min`**
3. **Rafraîchit les vues si nécessaire**

## 📈 Monitoring

### Vue de monitoring

```sql
SELECT * FROM search_views_refresh_status;
```

Retourne :

| view_name | needs_refresh | last_refresh | freshness | age | refresh_count |
|-----------|---------------|--------------|-----------|-----|---------------|
| interventions_search_mv | false | 2026-01-06 14:32:15 | Fresh (< 1 min) | 00:00:42 | 1245 |
| artisans_search_mv | false | 2026-01-06 14:31:58 | Fresh (< 1 min) | 00:00:59 | 892 |

### Logs de l'Edge Function

```bash
# Voir les logs en temps réel
supabase functions logs refresh-search-views --follow

# Filtrer les erreurs
supabase functions logs refresh-search-views --filter "error"
```

### Métriques dans PostgreSQL

```sql
-- Statistiques de refresh
SELECT
  view_name,
  refresh_count,
  avg_refresh_duration_ms,
  last_refresh
FROM search_views_refresh_status
ORDER BY refresh_count DESC;
```

## 🐛 Troubleshooting

### Les vues ne se rafraîchissent pas

1. **Vérifier que les webhooks sont actifs**
   ```sql
   -- Dans Supabase Dashboard > Database > Webhooks
   -- Status doit être "Active" (vert)
   ```

2. **Tester manuellement l'Edge Function**
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/refresh-search-views \
     -H "Authorization: Bearer <anon-key>" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "UPDATE",
       "table": "interventions",
       "schema": "public",
       "record": {}
     }'
   ```

3. **Vérifier les logs pg_cron**
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobname = 'refresh_search_views_fallback'
   ORDER BY start_time DESC
   LIMIT 10;
   ```

4. **Forcer un refresh manuel**
   ```sql
   SELECT refresh_search_views_debounced(
     p_refresh_interventions := true,
     p_refresh_artisans := true
   );
   ```

### Latence toujours élevée (~1 min)

- Vérifier que les webhooks sont bien configurés (URL, Headers)
- Vérifier que l'Edge Function est déployée : `supabase functions list`
- Vérifier les logs de l'Edge Function pour des erreurs

### Erreur "relation does not exist"

Les vues matérialisées n'existent pas. Créer les vues :

```sql
-- Relancer la migration 00020
\i supabase/migrations/00020_search_materialized_views.sql
```

## 🎯 Avantages vs pg_cron pur

| Aspect | pg_cron (ancien) | Database Webhook + Edge Function (nouveau) |
|--------|------------------|---------------------------------------------|
| **Latence** | ~60s fixe | ~5-10s adaptative |
| **Charge CPU** | Refresh toutes les 1 min | Refresh uniquement si changement |
| **Debounce** | Non | Oui (5s) - coalise les modifications |
| **Résilience** | Moyenne | Haute (fallback pg_cron 5 min) |
| **Complexité** | Faible | Moyenne |
| **Monitoring** | Basique | Avancé (logs, métriques) |

## 📚 Références

- **Migration SQL** : `supabase/migrations/00059_realtime_search_views_refresh.sql`
- **Edge Function** : `supabase/functions/refresh-search-views/index.ts`
- **Audit complet** : Voir le rapport d'audit initial
- **Supabase Database Webhooks** : https://supabase.com/docs/guides/database/webhooks
- **Supabase Edge Functions** : https://supabase.com/docs/guides/functions

## 🔄 Rollback (retour arrière)

Si problème, revenir à pg_cron 1 min :

```sql
-- Désactiver le fallback 5 min
SELECT cron.unschedule('refresh_search_views_fallback');

-- Réactiver le cron 1 min
SELECT cron.schedule(
  'refresh_search_views',
  '* * * * *',
  $$SELECT refresh_search_views_if_needed()$$
);

-- Désactiver tous les webhooks dans le Dashboard
```