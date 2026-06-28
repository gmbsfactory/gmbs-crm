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

### Présence CRM (active / idle / offline)

Depuis les migrations `99051`/`99052`, la présence métier est **distincte du token
d'authentification** (qui reste valide 24 h). Trois états sont stockés dans
`users.presence_state` (colonne dédiée, jamais mélangée avec `status` busy/dnd) :

| État | Seuil | Pastille |
|------|-------|----------|
| `active` | activité récente | verte |
| `idle` | inactivité ≥ seuil idle (défaut 5 min) → écran de veille | orange |
| `offline` | inactivité ≥ seuil offline (défaut 1 h) → session CRM fermée | grise |

**Seuils configurables** depuis Monitoring Dev (table `crm_presence_settings`, hook
`usePresenceSettings`, route `PATCH /api/monitoring/presence-settings` réservée dev/admin).
Le même seuil idle pilote l'écran de veille DVD.

**Cycle client** (`usePresenceLifecycle`, monté dans `page-presence-gate.tsx`) — émetteur
**unique** des événements, journalisés dans `user_presence_events` :

| Événement | Quand |
|-----------|-------|
| `AUTH_LOGIN` | 1re connexion via portail (flag `crm_auth_login` posé sur `SIGNED_IN`) |
| `PRESENCE_START` | ouverture/reprise de session CRM sans portail (rechargement) |
| `PRESENCE_PING` | ping d'activité 60 s — rafraîchit `last_active_at`, **jamais journalisé** |
| `IDLE_START` | passage inactif au-delà du seuil idle |
| `PRESENCE_RESUME` | retour d'activité après idle/offline, **sans** repasser par le portail |
| `PRESENCE_END` | hors ligne au-delà du seuil offline (ou fermeture du dernier onglet) |

**Filet serveur** : `check_inactive_users` (cron pg_cron 60 s + Edge Function
`check-inactive-users`) lit les seuils dans `crm_presence_settings` et bascule
`active → idle → offline` selon `last_active_at` (l'activité **réelle**, pas la simple
présence de l'onglet). Couvre les onglets fermés/crashés ; la sauvegarde des seuils le relance immédiatement.

**Sécurité** : `record_user_presence_event` et `check_inactive_users` sont `SECURITY DEFINER`
et appelables **uniquement par le serveur** (`service_role`) — REVOKE nominatif de
`anon`/`authenticated` (migration `99052`), car les DEFAULT PRIVILEGES du projet exposeraient
sinon toute nouvelle fonction. `record_user_presence_event` porte en plus une garde `auth.uid()`
(un client ne peut écrire que sa propre présence) ; la route `/api/auth/presence` force `p_user_id`
depuis la session.

> Distinction clé : `last_active_at` (dernière activité réelle, **figée** en idle) vs
> `last_seen_at` (onglet vivant). Le calcul idle/offline s'appuie sur le premier.

### First Activity Tracking

L'appel `POST /api/auth/first-activity` est effectué une fois par jour pour suivre les horaires de première connexion.

### Detection d'inactivite (Idle Detection)

En complement du heartbeat, un systeme de detection d'inactivite cote client permet d'identifier les utilisateurs presents mais inactifs (partis manger, onglet oublie, etc.).

#### Hook `useIdleDetector`

Le hook `src/hooks/useIdleDetector.ts` combine deux mecanismes :

| Mecanisme | Declencheur | Transition |
|-----------|-------------|------------|
| **Timeout 5 min** | Aucun `mousemove`, `keydown`, `click`, `scroll`, `touchstart` pendant 5 minutes | actif → inactif |
| **Page Visibility API** | Onglet masque (`document.hidden = true`) | actif → inactif (immediat) |
| **Retour activite** | Mouvement souris, frappe clavier, onglet redevient visible, ou fenetre refocalisee (`focus`) | inactif → actif (immediat) |

Les transitions `goActive`/`resetTimer` sont throttlees a 1s, mais le timestamp de derniere activite (`lastActiveRef`) est rafraichi a **chaque** event (ecriture de ref, sans re-render) pour permettre un credit precis du temps d'ecran.

> Le `blur` (perte de focus) n'est volontairement **pas** un declencheur idle dans ce hook : cela eviterait l'apparition du screensaver des qu'on clique dans une autre app. Le focus-gating du temps d'ecran est gere separement par `useActivityTracker`.

```
useIdleDetector(timeoutMs = 5 * 60 * 1000) → { isIdle: boolean, getLastActiveAt: () => number }
```

#### Impact sur la presence (`usePagePresence`)

Quand `isIdle` change, le hook `usePagePresence` re-track immediatement le payload avec `isIdle: true/false`. Le heartbeat continue meme en idle (sinon le filtre stale de 5 min evincerait l'utilisateur).

Le type `PagePresenceUser` inclut le champ `isIdle: boolean` depuis la v2.

#### Tracking du temps d'écran : JOURNAL D'ÉVÉNEMENTS (`useActivityTracker`)

Depuis la migration `99034`/`99035`, le temps d'écran repose sur un **journal d'événements horodaté serveur**, pas sur des durées calculées côté client.

**Collecte** (`src/hooks/useActivityTracker.ts`) : le client n'écrit QUE des événements dans `user_activity_events` (jamais de durée). `occurred_at` est l'horodatage **serveur** (`default now()`) — la source de vérité.

| Marqueur émis | Quand |
|---|---|
| `connect` | montage (nouvelle session navigateur, `session_id` uuid) |
| `page` | changement de page / d'intervention ouverte (`?i=<id>`) |
| `heartbeat` | toutes les 60 s, **uniquement** s'il y a eu une vraie activité depuis le dernier battement |
| `idle` | bascule en inactivité (souris immobile / onglet caché) |
| `blur` / `focus` | fenêtre au second / premier plan (dé-doublonnage multi-écran) |
| `disconnect` | fermeture d'onglet (keepalive) |

**Calcul serveur** : `monitoring_active_intervals` (miroir SQL de `src/lib/monitoring/active-time.ts`, testé) crédite, pour chaque marqueur **actif**, l'écart jusqu'à l'événement suivant **plafonné à MAX_GAP = 90 s**. `monitoring_screen_rows` sessionise ces intervalles (gaps & islands) et les unit aux sessions legacy. Les 4 RPC monitoring lisent cette source unifiée (contrat JSON inchangé).

Garanties structurelles (vérifiées par les tests de `active-time.ts`) :

| Cas | Effet |
|---|---|
| **Veille OS / capot fermé / crash** | Pas de heartbeat → écart > MAX_GAP → on ne crédite qu'un MAX_GAP (≤ 90 s), jamais des heures fantômes |
| **Inactivité** | Un marqueur d'arrêt (`idle`/`blur`/`disconnect`) ne crédite jamais l'écart qui le suit |
| **Multi-fenêtres / double écran** | Seule la fenêtre au premier plan émet des heartbeats (`focus`/`blur`) |
| **Intervention ouverte** | `intervention_id` porté par chaque événement → temps attribué à l'intervention réelle |
| **Reconnexions** | Chaque `connect` = nouveau `session_id`, calculé et auditable |

> Le `heartbeat` ne bat que sur **vraie activité** (pas seulement « non-idle »), sinon les 5 min précédant la bascule idle seraient recréditées.

La table `user_page_sessions` reste lue pour l'historique antérieur à la bascule (les RPC unissent les deux sources), mais n'est plus alimentée.

#### 3 etats dans le monitoring

Les 3 etats proviennent de `users.presence_state` (seuils configurables, cf. *Présence CRM* ci-dessus). La page monitoring (`/monitoring`) et Monitoring Dev les affichent pour chaque utilisateur :

| Etat | Pastille | Style | Tooltip |
|------|----------|-------|---------|
| **Actif** | Vert pulse (`bg-emerald-500` + `animate-ping`) | Opacite normale | "En ligne — {page}" |
| **Inactif** | Orange pulse lent (`bg-amber-500` + `animate-pulse`) | Opacite 80% | "Inactif — {page}" |
| **Deconnecte** | Gris statique (`bg-gray-400`) | Opacite 60% | "Hors ligne" |

Le header affiche un compteur decompose : `"X en ligne · Y inactifs · Z deconnectes"`.

#### Ecran de veille (Screensaver)

Le composant `src/components/layout/IdleScreensaver.tsx` affiche un ecran de veille "DVD bouncing logo" quand l'utilisateur est inactif :

- **Overlay** : `fixed inset-0 z-[9999] bg-black/30`
- **Logo** : `/public/gmbs-logo.svg` (120x120px) qui se deplace en diagonale et rebondit sur les 4 bords
- **Changement de couleur** : A chaque rebond, `filter: hue-rotate(Xdeg)` avec un angle aleatoire — seules les parties colorees du logo (le "G" bleu) changent de teinte, le texte noir/gris reste intact
- **Coordination avec la topbar** : le logo de la topbar disparait quand le screensaver s'active (via `data-screensaver-active` sur `<html>`) et reapparait avec une animation zoom-bounce (400ms) apres la fin du screensaver
- **Disparition** : des que `isIdle` repasse a `false`, l'overlay fade-out en 400ms

#### Fichiers

```
src/hooks/useIdleDetector.ts                     # Detection d'inactivite + getLastActiveAt
src/hooks/useActivityTracker.ts                  # Emetteur du journal d'evenements (user_activity_events)
src/lib/monitoring/active-time.ts                # Calcul pur des intervalles actifs (miroir SQL, teste)
src/components/layout/IdleScreensaver.tsx        # Ecran de veille DVD bouncing
src/components/layout/page-presence-gate.tsx     # Monte useIdleDetector + IdleScreensaver
src/components/layout/activity-tracker-gate.tsx  # isIdle + getLastActiveAt + intervention ouverte → tracker
src/hooks/usePresenceLifecycle.ts                # Cycle de présence CRM (active/idle/offline/reprise) — émetteur d'événements
src/hooks/usePresenceSettings.ts                 # Seuils configurables (idle/offline) via /api/monitoring/presence-settings
supabase/migrations/99034_activity_events_journal.sql   # Table user_activity_events + monitoring_active_intervals
supabase/migrations/99035_monitoring_rpcs_use_events.sql # monitoring_screen_rows + RPC sur le journal
supabase/migrations/99051_presence_settings_and_events.sql # presence_state, crm_presence_settings, user_presence_events
supabase/migrations/99052_presence_security_backfill.sql   # REVOKE service_role + garde auth.uid() + PRESENCE_PING + backfill
```

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
