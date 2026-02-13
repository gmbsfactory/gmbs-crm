# Monitoring et observabilité

> Stratégie de monitoring, logging et suivi des erreurs dans GMBS-CRM.

---

## Logging

### Logging côté client

Le projet utilise les méthodes `console.*` natives avec une convention de niveaux :

| Niveau | Usage | Production |
|--------|-------|------------|
| `console.log` | Debug et informations de développement | Supprimé automatiquement |
| `console.warn` | Avertissements non bloquants | Conservé |
| `console.error` | Erreurs applicatives | Conservé |

La suppression en production est configurée dans `next.config.mjs` :

```javascript
compiler: {
  removeConsole: process.env.NODE_ENV === 'production'
    ? { exclude: ['error', 'warn'] }
    : false,
}
```

### Logging côté API

Les API routes et Edge Functions utilisent un logging structuré :

```typescript
// Pattern dans les Edge Functions
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'interventions-v2',
  method: req.method,
  action: 'getAll',
  // ...metadata
}))
```

### Logging Realtime

Le système Realtime log les événements importants :

```
[realtime] Channel subscribed: interventions
[realtime] Event received: UPDATE intervention <id>
[realtime] Conflict detected: intervention <id> (local vs remote)
[realtime] Broadcasting to other tabs
```

---

## Error Handling

### safeErrorMessage

Le module `src/lib/api/v2/common/error-handler.ts` fournit des messages d'erreur sécurisés :

```typescript
import { safeErrorMessage } from '@/lib/api/v2/common/error-handler'

// En développement : message détaillé complet (stack, cause, etc.)
// En production : message générique "Erreur lors de <contexte>"
const message = safeErrorMessage(error, 'la mise a jour de l\'intervention')
```

**Objectif :** Ne jamais exposer de détails techniques (noms de tables, stack traces) aux utilisateurs en production.

### Error Boundaries

Le projet utilise `react-error-boundary` (v6.0) pour capturer les erreurs React :

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentPotentiellementDangereuse />
</ErrorBoundary>
```

Les Error Boundaries sont placées autour :
- Des modals (intervention, artisan)
- Des vues principales (table, kanban, etc.)
- Des sections de formulaire

---

## Suivi de présence

### Heartbeat

Le système de présence repose sur un heartbeat HTTP :

```
Client: POST /api/auth/heartbeat (toutes les 30s)
  → Met a jour `last_seen_at` dans la table `users`

Server: Edge Function check-inactive-users (cron toutes les 60s)
  → Utilisateurs avec last_seen_at > 90s → status = 'offline'
```

**Avantages par rapport a `beforeunload` :**
- Fonctionne si l'onglet crash
- Fonctionne si le processus est kill
- Fonctionne en cas de coupure réseau
- Pas dépendant du cycle de vie du navigateur

### First Activity Tracking

L'appel `POST /api/auth/first-activity` est effectué une fois par jour pour suivre les horaires de première connexion.

---

## Audit Trail

### intervention_audit_log

Toute modification d'intervention est enregistrée dans la table `intervention_audit_log` :

| Champ | Description |
|-------|-------------|
| `intervention_id` | Intervention modifiée |
| `action_type` | Type d'action (update, status_change, etc.) |
| `changed_fields` | Champs modifiés (JSONB) |
| `old_values` | Anciennes valeurs (JSONB) |
| `new_values` | Nouvelles valeurs (JSONB) |
| `actor_id` | Utilisateur |
| `created_at` | Horodatage |

Accessible via le hook `useInterventionHistory` (infinite scroll) et la fonction RPC `get_intervention_history`.

### Email Logs

Les emails envoyés sont tracés dans la table `email_logs` :
- `intervention_id` / `artisan_id` : entité liée
- `recipient_email`, `subject` : métadonnées
- `status` : sent, failed, pending
- `error_message` : en cas d'échec

### Sync Logs

Les synchronisations Google Sheets sont tracées dans `sync_logs` avec le type d'opération (push, pull, conflict).

---

## Monitoring frontend

### Web Vitals

Le package `web-vitals` (v5.1) est disponible pour mesurer les Core Web Vitals :

- **LCP** (Largest Contentful Paint) : temps de chargement perçu
- **FID** (First Input Delay) : réactivité aux interactions
- **CLS** (Cumulative Layout Shift) : stabilité visuelle
- **TTFB** (Time to First Byte) : performance serveur
- **INP** (Interaction to Next Paint) : réactivité continue

### Connection Status

Le composant `ConnectionStatusIndicator` affiche en temps réel l'état de la connexion Realtime :
- Vert : connecté
- Orange : reconnexion en cours
- Rouge : déconnecté

---

## Alertes et notifications

### Notifications utilisateur

Le système de toast (`use-toast` hook) affiche les notifications en temps réel :
- Succès : action confirmée
- Erreur : message d'erreur contextualisé
- Warning : avertissement non bloquant

### Mentions et rappels

Le système de `RemindersContext` :
- Écoute le channel Supabase `intervention_reminders_realtime`
- Détecte les @mentions via regex
- Affiche des toasts pour les mentions de l'utilisateur courant

---

## Recommandations d'amélioration

### Court terme

1. **Structured logging** : remplacer les `console.*` par un logger structuré (pino ou winston) pour les API routes
2. **Error tracking** : intégrer Sentry pour le tracking automatique des erreurs frontend et backend
3. **Performance monitoring** : envoyer les Web Vitals vers un service d'analytics

### Moyen terme

1. **Dashboard de monitoring** : créer un dashboard de santé du système (uptime, latence API, erreurs)
2. **Alerting** : configurer des alertes sur les seuils critiques (taux d'erreur > 1%, latence P95 > 5s)
3. **APM** : intégrer un outil d'Application Performance Monitoring pour le tracing des requêtes

### Long terme

1. **Observabilité distribuée** : traces OpenTelemetry entre le frontend, les API routes et les Edge Functions
2. **Log aggregation** : centraliser les logs dans un service dédié (Datadog, Grafana, etc.)
