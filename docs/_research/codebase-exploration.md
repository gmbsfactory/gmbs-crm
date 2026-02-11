# Exploration Complète du Codebase GMBS-CRM

> Document de recherche interne - Base pour la rédaction de la documentation
> Généré le 2026-02-11

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [API Layer V2](#3-api-layer-v2)
4. [Hooks (67 hooks)](#4-hooks-67-hooks)
5. [Système Realtime](#5-système-realtime)
6. [Workflow Engine](#6-workflow-engine)
7. [State Management](#7-state-management)
8. [Components (200+)](#8-components-200)
9. [Auth & Security](#9-auth--security)
10. [Edge Functions (13)](#10-edge-functions-13)
11. [Types (11 fichiers)](#11-types-11-fichiers)
12. [Tests](#12-tests)
13. [API Routes (Next.js)](#13-api-routes-nextjs)
14. [Database Schema](#14-database-schema)
15. [Configuration & Tooling](#15-configuration--tooling)

---

## 1. Vue d'ensemble du projet

**GMBS-CRM** est un CRM pour la gestion des interventions (ordres de travaux terrain), artisans (sous-traitants) et clients.

### Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | Next.js 15.5.7, React 18.3.1, TypeScript 5 |
| **UI** | Tailwind CSS 3.4.17, Radix UI (20+ packages), Framer Motion 12, shadcn/ui |
| **State** | TanStack Query 5.90, Zustand 5.0.8 |
| **Backend** | Supabase (Auth, Database, Realtime, Storage, Edge Functions) |
| **Maps** | MapLibre GL 5.9, MapTiler SDK 3.8 |
| **Tests** | Vitest 3.2.4, React Testing Library 16.3, Playwright 1.55 |
| **Data** | ExcelJS, PapaParse, Google Spreadsheet API |
| **Email** | Nodemailer 7.0 |
| **AI** | OpenAI SDK 6.9 |
| **Forms** | React Hook Form 7.54, Zod 3.24 |

### Dépendances

- **96 dépendances de production**
- **22 dépendances de développement**
- **Node.js:** 20.x || 22.x

---

## 2. Structure des fichiers

### Arborescence racine

```
gmbs-crm/
├── app/                    # Next.js App Router (pages, API routes, layouts)
│   ├── (auth)/             # Routes auth (login, set-password)
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes Next.js
│   ├── artisans/           # Pages artisans + _components/ + _lib/
│   ├── auth/               # Callback auth
│   ├── comptabilite/       # Comptabilité
│   ├── dashboard/          # Dashboard utilisateur
│   ├── interventions/      # Pages interventions + _components/ + _lib/
│   ├── settings/           # Pages paramètres
│   ├── layout.tsx          # Root layout (14KB)
│   └── globals.css         # Styles globaux
├── src/
│   ├── components/         # Composants React (200+)
│   ├── config/             # Configuration métier
│   ├── contexts/           # 9 React Contexts
│   ├── hooks/              # 67 hooks custom
│   ├── lib/                # Logique métier, API, realtime, workflow
│   ├── providers/          # Providers globaux
│   ├── stores/             # Zustand stores
│   ├── styles/             # Styles additionnels
│   ├── types/              # 11 fichiers de types
│   └── utils/              # Utilitaires
├── supabase/
│   ├── functions/          # 13 Edge Functions (Deno)
│   ├── migrations/         # 82 migrations SQL
│   └── seeds/              # Données initiales
├── tests/                  # Tests (unit, integration, e2e, visual)
├── scripts/                # 95 scripts Node.js/Bash
├── middleware.ts            # Middleware Next.js (auth)
└── [configs]               # next.config, tailwind, vitest, etc.
```

### Pattern de co-location (App Router)

```
app/interventions/
├── page.tsx                # Page principale
├── layout.tsx              # Layout de route
├── [id]/page.tsx           # Page détail
├── new/page.tsx            # Page création
├── _components/            # Composants co-localisés
│   ├── InterventionsPlusMenu.tsx
│   ├── InterventionsStatusFilter.tsx
│   └── InterventionsViewRenderer.tsx
└── _lib/                   # Logique co-localisée
    └── useInterventionPageState.ts
```

Le même pattern est utilisé pour `app/artisans/` et `app/admin/dashboard/`.

---

## 3. API Layer V2

### Structure (`src/lib/api/v2/`)

```
src/lib/api/v2/
├── common/
│   ├── types.ts             # Types centraux (Intervention, Artisan, User, etc.)
│   ├── client.ts            # Initialisation client Supabase (browser + Node)
│   ├── cache.ts             # Cache singleton des données de référence
│   ├── error-handler.ts     # Messages d'erreur sécurisés
│   ├── utils.ts             # Utilitaires partagés (mapInterventionRecord, getHeaders)
│   └── constants.ts         # Constantes métier
├── interventions/
│   ├── index.ts             # Façade unifiant les 5 modules
│   ├── interventions-crud.ts
│   ├── interventions-status.ts
│   ├── interventions-costs.ts
│   ├── interventions-stats.ts
│   └── interventions-filters.ts
├── artisansApi.ts
├── usersApi.ts
├── commentsApi.ts
├── documentsApi.ts
├── clientsApi.ts
├── agenciesApi.ts
├── ownersApi.ts
├── tenantsApi.ts
├── rolesApi.ts
├── reminders.ts
├── enumsApi.ts
├── utilsApi.ts
├── metiersApi.ts
├── artisanStatusesApi.ts
├── interventionStatusesApi.ts
├── search.ts
├── search-utils.ts
└── index.ts                 # Orchestrateur central (Façade principale)
```

**Total : 29 modules API**

### Pattern Façade Principal

```typescript
// src/lib/api/v2/index.ts
const apiV2 = {
  agencies: agenciesApi,
  users: usersApi,
  interventions: interventionsApi,
  artisans: artisansApi,
  clients: clientsApi,
  documents: documentsApi,
  comments: commentsApi,
  roles: rolesApi,
  permissions: permissionsApi,
  tenants: tenantsApi,
  owners: ownersApi,
  reminders: remindersApi,
  enums: enumsApi,
  utils: utilsApi,
};
export default apiV2;

// Usage:
import { interventionsApi, artisansApi } from '@/lib/api/v2';
```

### Interventions API (5 modules)

#### interventions-crud.ts
- `getAll(params)` - Liste paginée avec filtres (via Edge Function)
- `getAllLight(params)` - Version légère pour warm-up
- `getTotalCount(params)` - Comptage total
- `getById(id, include)` - Détail avec relations (Supabase direct)
- `create(data)` - Création + transition automatique
- `update(id, data)` - Mise à jour + log transition si changement statut
- `delete(id)` - Suppression
- `checkDuplicate(address, agencyId)` - Détection doublon
- `getDuplicateDetails(address, agencyId)` - Détails des doublons
- `upsert(data)` - Via Edge Function
- `upsertDirect(data, client)` - Supabase direct (imports bulk)
- `createBulk(interventions)` - Création en lot

#### interventions-status.ts
- `updateStatus(id, statusId)` - Changement de statut
- `setPrimaryArtisan(id, artisanId)` - Artisan principal (5 cas)
- `setSecondaryArtisan(id, artisanId)` - Artisan secondaire
- `assignArtisan(id, artisanId)` - Attribution simple
- `getAllStatuses()` / `getStatusByCode()` / `getStatusByLabel()`
- `getStatusTransitions(id)` - Historique transitions

#### interventions-costs.ts
- `upsertCost(id, cost)` - Création/mise à jour coût
- `upsertCostsBatch(id, costs)` - Batch optimisé
- `getCosts(id)` - Tous les coûts
- `deleteCost(id)` - Suppression
- `addPayment(id, payment)` / `upsertPayment(id, paymentId, data)`
- `calculateMarginForIntervention(costs)` - Calcul marge synchrone

```typescript
// Calcul de marge
const margin = interventionsApi.calculateMarginForIntervention([
  { cost_type: 'intervention', amount: 800 },  // CA
  { cost_type: 'sst', amount: 250 },           // Coût SST
  { cost_type: 'materiel', amount: 100 },       // Coût matériel
]);
// → { revenue: 800, costs: 350, margin: 450, marginPercentage: 56.25 }
```

#### interventions-stats.ts
- `getStatsByUser(params)` - Stats par utilisateur
- `getMarginStatsByUser(params)` - Stats marge
- `getMarginRankingByPeriod(start, end)` - Classement managers
- `getWeeklyStatsByUser(params)` - Stats hebdo
- `getPeriodStatsByUser(params)` - Stats par période
- `getRecentInterventionsByUser(params)` - Interventions récentes
- `getAdminDashboardStats(params)` - Dashboard admin complet
- `getRevenueHistory(params)` - Historique CA
- `getInterventionsHistory(params)` - Historique interventions
- `getCycleTimeHistory(params)` - Historique temps de cycle
- `getMarginHistory(params)` - Historique marge

#### interventions-filters.ts
- `getTotalCountWithFilters(params)` - Comptage avec filtres
- `getCountsByStatus()` - Distribution par statut
- `getCountByPropertyValue(prop, value)` - Comptage par propriété
- `getDistinctValues(prop)` - Valeurs distinctes
- `getCountWithFilters(params)` - Comptage générique

### Singleton Cache Manager

```typescript
class ReferenceCacheManager {
  private static instance: ReferenceCacheManager;
  private cache: ReferenceCache | null = null;
  private fetchPromise: Promise<ReferenceCache> | null = null;

  async get(): Promise<ReferenceCache> {
    // TTL: 5 minutes
    // Protection thundering herd : réutilise la requête en vol
    if (this.fetchPromise) return this.fetchPromise;
    this.fetchPromise = this.fetchData();
    return await this.fetchPromise;
  }
}
```

**Données cachées :** users, allUsers, agencies, interventionStatuses, artisanStatuses, metiers
**Structures :** `Map<string, T>` pour lookups O(1) par ID

### Error Handler

```typescript
export function safeErrorMessage(error: unknown, context: string): string {
  if (isDev) return fullMessage;     // Dev: détails complets
  console.error(`[safeErrorMessage] ...`);
  return `Erreur lors de ${context}`; // Prod: message générique
}
```

### Client Supabase (Browser vs Node)

```typescript
export function getSupabaseClientForNode() {
  if (typeof window !== "undefined") return supabase; // Browser: singleton anon key
  // Node.js: service role client (bypass RLS)
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
```

### Headers dynamiques

```typescript
export const getHeaders = async () => {
  // Browser: token session utilisateur
  // Node.js: service role key
  // Fallback: anon key
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};
```

### mapInterventionRecord (enrichissement)

Transforme un enregistrement Supabase brut en objet métier enrichi avec 50+ champs :
- Résolution FK : user, agence, statut, métier → objets complets
- Extraction artisans depuis `intervention_artisans` (primary/secondary)
- Calcul coûts depuis `intervention_costs` (CA, SST, matériel, marge)
- Noms d'affichage : chaîne de fallback (raison_sociale > plain_nom > prénom nom)
- Alias legacy pour compatibilité

### Autres APIs

| Module | Fonctions principales |
|--------|----------------------|
| **artisansApi** | getAll, getById, create, update, delete, getNearby, getByMetier, getStatsByStatus |
| **usersApi** | getAll, getById, create, update, delete, assignRole, removeRole, getTargets, upsertTarget |
| **commentsApi** | getAll, getByEntity, create, update, delete |
| **documentsApi** | getAll, getByEntity, upload, delete, getSupportedTypes |
| **clientsApi** | getAll, getById, create, update, delete, insertClients (batch) |
| **agenciesApi** | getAll, getById, create, update, delete, getConfig |
| **rolesApi** | getAll, getById, create, update, assignPermission, removePermission |
| **reminders** | upsertReminder, deleteReminder, getMyReminders |
| **tenantsApi / ownersApi** | CRUD standard + recherche |

---

## 4. Hooks (67 hooks)

### Catégorie 1 : Query & Data Fetching

| Hook | Rôle | Cache |
|------|------|-------|
| **useInterventionsQuery** | Fetching interventions paginé avec filtres, prefetch page suivante, placeholderData | Adaptive staleTime |
| **useArtisansQuery** | Fetching artisans paginé avec filtres | Standard |
| **useReferenceDataQuery** | Données de référence (statuts, agences, users) via TanStack Query | 5min stale, 15min GC |
| **useReferenceData** | Legacy : données de référence avec cache client | 5min |
| **useDashboardStats** | Stats interventions par statut/période | 30s stale, 5min GC |
| **useDashboardMargin** | Stats marge | Standard |
| **useDashboardPeriodStats** | Stats hebdo/mensuel/annuel | Standard |
| **useGestionnaires** | Liste gestionnaires | 5min stale |
| **useUsers** | Utilisateurs mentionnables | Standard |
| **useInterventionHistory** | Audit log infinite scroll (RPC `get_intervention_history`) | Infinite query |
| **useFilterCounts** | Comptage par valeur de filtre (Promise.all parallèle) | Standard |

### Catégorie 2 : Mutations

| Hook | Rôle |
|------|------|
| **useInterventionsMutations** | CRUD complet avec updates optimistes, gestion offline, sync queue |

**Pattern d'update optimiste :**
```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ ... })
  const previous = queryClient.getQueryData(...)
  queryClient.setQueriesData({ ... }, updateFn)
  return { previous }
},
onError: (error, _, context) => {
  queryClient.setQueryData(..., context.previous) // Rollback
},
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [...] })
}
```

### Catégorie 3 : Modal & UI State

| Hook | Rôle |
|------|------|
| **useModal** | State global modal avec sync URL (?i=id&mc=content) |
| **useInterventionModal** | Wrapper modal intervention avec navigation (Ctrl+Shift+J/K) |
| **useArtisanModal** | Wrapper modal artisan |
| **useModalState** | Store Zustand centralisé pour modals |

### Catégorie 4 : Forms

| Hook | Rôle |
|------|------|
| **useInterventionForm** | Gestion formulaire intervention (create/edit), détection doublons, validation Zod |
| **useFormDataChanges** | Détection changements non sauvegardés |
| **useInterventionFormState** | Persistance état formulaire |

### Catégorie 5 : Views & Filtres

| Hook | Rôle |
|------|------|
| **useInterventionViews** | Gestion vues multiples (8 layouts), persistance localStorage, colonnes |
| **useArtisanViews** | Idem pour artisans |
| **useSmartFilters** | Conversion CODE ↔ ID pour filtres |
| **useFilterCounts** | Comptage par valeur de filtre |

**8 types de layout :** table, cards, gallery, kanban, calendar, timeline + variants

### Catégorie 6 : Auth & Permissions

| Hook | Rôle |
|------|------|
| **useCurrentUser** | User authentifié via `/api/auth/me` (HTTP-only cookies) |
| **usePermissions** | can(), canAny(), canAll(), hasRole(), canAccessPage() |
| **useUserRoles** | Vérification rôles simple |
| **useUserPermissions(userId)** | Permissions d'un user spécifique (admin) |

### Catégorie 7 : Reference Data Mapping

| Hook | Rôle |
|------|------|
| **useInterventionStatusMap** | CODE → UUID (normalisation multiple) |
| **useUserMap** | USERNAME/NAME → UUID |
| **useMetierMap** | LABEL/CODE → UUID |

### Catégorie 8 : Realtime & Sync

| Hook | Rôle |
|------|------|
| **useInterventionsRealtime** | Sync Supabase Realtime + fallback polling 15s + BroadcastChannel |
| **usePreloadInterventions** | Preload vues via idle callback + batch adaptatif |
| **usePreloadDefaultViews** | Auto-preload vues par défaut |

### Catégorie 9 : Context Menu & Actions

| Hook | Rôle |
|------|------|
| **useInterventionContextMenu** | Actions contextuelles (dupliquer devis, assigner, transitions) avec optimistic updates |
| **useArtisanContextMenu** | Archivage artisan avec confirmation |

### Catégorie 10 : Utilitaires

| Hook | Rôle |
|------|------|
| useDebounce | Anti-rebond |
| useInfiniteScroll | Scroll infini avec cache léger |
| usePagination | État pagination |
| useIsNarrow | Media query responsive |
| useColumnResize | Redimensionnement colonnes draggable |
| useKeyboardShortcuts | `/` search, `Escape` clear, `Ctrl+A` select all |
| useUniversalSearch | Recherche globale 300ms debounce |
| useWorkflowConfig | Config workflow localStorage |
| use-toast | Notifications toast |

### Catégorie 11+ : Autres hooks notables

- **useDocumentUpload** - Upload fichiers
- **useSiretVerification** - Validation SIRET
- **useUnsavedChanges** - Alerte navigation avec changements non sauvegardés
- **useLowPowerMode** - Détection device low-power
- **useProgressiveLoad** - Chargement progressif
- **Analytics hooks** : useMarginHistory, useRevenueHistory, useCycleTimeHistory, useTransformationRateHistory

### Graphe de dépendances hooks critiques

```
useCurrentUser
├── usePermissions
├── useInterventionViews
├── useInterventionModal / useArtisanModal / useModal
└── useWorkflowConfig

useInterventionsQuery
├── useInterventionsRealtime
└── useInterventionContextMenu

usePreloadDefaultViews
├── useInterventionViews
├── useInterventionStatusMap / useUserMap
└── useCurrentUser
```

---

## 5. Système Realtime

### Architecture

```
src/lib/realtime/
├── realtime-client.ts           # Channel Supabase Realtime
├── cache-sync.ts                # Orchestration façade
├── cache-sync/
│   ├── event-handlers.ts        # INSERT/UPDATE/DELETE handlers
│   ├── conflict-detection.ts    # Détection conflits simultanés
│   ├── enrichment.ts            # Enrichissement records
│   ├── remote-edit-indicator.ts # Badges "modifié par X"
│   ├── filter-utils.ts          # Matching filtres pour cache
│   └── broadcasting.ts          # Sync cross-tab (BroadcastChannel)
├── broadcast-sync.ts            # Gestion BroadcastChannel
└── sync-queue.ts                # File offline avec retry
```

### Flux de données

```
Supabase Realtime Events
    ↓
realtime-client.ts (channel 'interventions', filter: is_active=eq.true)
    ↓
cache-sync.ts (syncCacheWithRealtimeEvent)
    ├→ enrichment.ts → getReferenceCache() → mapInterventionRecord()
    ├→ event-handlers.ts → handleInsert/Update/Delete
    ├→ conflict-detection.ts → detectConflict (5s window)
    ├→ remote-edit-indicator.ts → badges visuels (auto-cleanup 20s)
    ├→ TanStack Query cache update (refetchType: 'active')
    └→ broadcasting.ts → BroadcastChannel → autres onglets
```

### Realtime Client

```typescript
export function createInterventionsChannel(onEvent) {
  const channel = supabase.channel(CHANNEL_NAME)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'interventions',
      filter: 'is_active=eq.true',  // 50% réduction trafic
    }, onEvent)
  channel.subscribe()
  return channel
}
```

### Event Handlers (4 cas UPDATE)

1. **Pas dans la liste + ne match pas filtres** → Aucun changement
2. **Pas dans la liste + match filtres maintenant** → Ajout à la liste
3. **Dans la liste + match toujours** → Mise à jour record
4. **Dans la liste + ne match plus** → Retrait de la liste

### Détection de conflits

```typescript
export function detectConflict(id, oldUpdatedAt, newUpdatedAt, indicatorManager) {
  const localUpdatedAt = indicatorManager.getLocalUpdatedAt(id)
  if (!localUpdatedAt) return false
  // Conflit si modification locale < 5s ET remote > local
  return new Date(newUpdatedAt) > new Date(localUpdatedAt)
}
```

### Sync Queue (offline)

- Persistance localStorage avec gestion quota
- Retry exponential backoff : 1s → 2s → 4s (max 3 tentatives)
- Batch processing : groupes de 10 toutes les 5s
- Gestion mode privé (pas de localStorage)

### Broadcasting cross-tab

```typescript
interface CacheSyncMessage {
  type: 'cache-update' | 'invalidation' | 'realtime-event'
  queryKey: QueryKey
  data?: unknown
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  interventionId?: string
  timestamp: number
}
```

Anti-boucle via `recentTimestamps` Set + check `window.__lastBroadcastTimestamp`.

---

## 6. Workflow Engine

### Fichiers

```
src/lib/workflow/
├── cumulative-validation.ts    # Validation cumulative sur chaîne
src/lib/
├── workflow-engine.ts          # Moteur de transition
├── workflow-persistence.ts     # Persistance localStorage
src/config/
├── workflow-rules.ts           # Règles et transitions autorisées
├── intervention-status-chains.ts # Chaînes de statuts
└── status-colors.ts            # Couleurs par statut
```

### Statuts d'intervention

```
DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
                                                                        ↘ SAV
                                                      ↗ ATT_ACOMPTE
Sorties: REFUSE, ANNULE, STAND_BY
Entrée alternative: POTENTIEL
```

**30 transitions autorisées** définies dans `workflow-rules.ts`.

### Exigences par statut

| Statut | Exigences |
|--------|-----------|
| DEMANDE | Aucune (initial) |
| DEVIS_ENVOYE | devis_id, nom_prenom_facturation, assigned_user |
| VISITE_TECHNIQUE | artisan |
| ACCEPTE | devis_id |
| INTER_EN_COURS | artisan, cout_intervention, cout_sst, consigne, nom_client, tel_client, date_prevue |
| INTER_TERMINEE | artisan, facture, propriétaire, facture GMBS |
| SAV | commentaire |
| REFUSE/ANNULE/STAND_BY | commentaire |

### Validation cumulative

Sur la chaîne principale, chaque statut doit satisfaire toutes les exigences des statuts précédents :

```typescript
export function getCumulativeEntryRules(targetStatus) {
  const predecessors = getPredecessorStatuses(targetStatus)
  // Union dédupliquée des règles d'entrée de tous les prédécesseurs
  for (const predecessor of predecessors) {
    for (const rule of getEntryRulesForStatus(predecessor)) {
      if (!seenKeys.has(rule.key)) cumulativeRules.push(rule)
    }
  }
  return cumulativeRules
}
```

### Moteur de validation

```typescript
export function validateTransition(workflow, fromKey, toKey, context): WorkflowValidationResult {
  // 1. Trouver les statuts
  // 2. Trouver la transition définie + isActive
  // 3. Collecter exigences manquantes (artisan, facture, propriétaire, etc.)
  // 4. Évaluer conditions de transition
  // 5. Vérifier autorisation (AUTHORIZED_TRANSITIONS)
  // 6. Appliquer VALIDATION_RULES
  // 7. Si mode strict: appliquer règles cumulatives
  return { canTransition, missingRequirements, failedConditions }
}
```

### Couleurs des statuts

```
DEMANDE: #3B82F6 (bleu)      DEVIS_ENVOYE: #8B5CF6 (violet)
VISITE_TECHNIQUE: #06B6D4     ACCEPTE: #10B981 (vert)
INTER_EN_COURS: #F59E0B       INTER_TERMINEE: #10B981 (vert)
ANNULE/REFUSE: #EF4444 (rouge) STAND_BY: #6B7280 (gris)
SAV: #EC4899 (rose)           ATT_ACOMPTE: #F97316 (orange)
```

---

## 7. State Management

### Zustand Store : Settings

```typescript
// src/stores/settings.ts
interface SettingsState {
  sidebarMode: "collapsed" | "icons" | "hybrid" | "expanded"
  theme: "light" | "dark" | "system"
  classEffect: boolean
  statusMock: "online" | "busy" | "dnd" | "offline"
}
// Persistance: localStorage 'gmbs:settings'
```

### React Contexts (9)

#### 1. GenieEffectContext
Anime le déplacement d'interventions entre vues (11 keyframes, 1s).
- `registerBadgeRef(viewId, element)` - Enregistre cible animation
- `triggerAnimation(interventionId, source, targetViewId, onComplete)`
- Respecte `prefers-reduced-motion`

#### 2. InterfaceContext
Thème et layout UI.
- sidebarMode, sidebarEnabled, colorMode, accent
- Synchronise avec Zustand store

#### 3. SimpleOptimizedContext
Cache léger (50 entries, 5min TTL).
- `useSimpleInterventions()` / `useSimpleArtisans()`

#### 4. FilterMappersContext
Traduction Code→ID pour filtres.
- `statusCodeToId`, `userCodeToId`, `currentUserId`
- Agrège useInterventionStatusMap + useUserMap + useCurrentUser

#### 5. NavigationContext
Cache navigation (5min TTL, global static).

#### 6. ModalDisplayContext
Gestion mode d'affichage modal.
- `preferredMode` : halfpage | centerpage | fullpage
- Responsive : < 640px force fullpage, < 1024px downgrade halfpage→centerpage
- Persistance localStorage

#### 7. UserStatusContext
Tracking présence utilisateur.
- Écoute mousemove, keydown, click, scroll (passive)
- Throttle 300ms
- Auto `appear-away` après 1h inactivité
- Check toutes les 60s

#### 8. RemindersContext
Rappels intervention avec sync realtime.
- Supabase channel `intervention_reminders_realtime`
- Parsing @mentions (regex `/@([\p{L}\p{N}_.-]+)/gu`)
- Toast notifications pour mentions

#### 9. UltraOptimizedContext
Cache avancé (100 entries, LRU hits tracking) + VirtualizedManager (pageSize 50).

### React Query Keys Factory

```typescript
export const interventionKeys = {
  all: ["interventions"] as const,
  lists: () => [...interventionKeys.all, "list"] as const,
  list: (params) => [...interventionKeys.lists(), params] as const,
  lightLists: () => [...interventionKeys.all, "light"] as const,
  lightList: (params) => [...interventionKeys.lightLists(), params] as const,
  details: () => [...interventionKeys.all, "detail"] as const,
  detail: (id, include?) => [...interventionKeys.details(), id, include] as const,
  invalidateAll: () => interventionKeys.all,
  invalidateLists: () => interventionKeys.lists(),
}

// Aussi: dashboardKeys, artisanKeys, referenceKeys
```

### Provider : AuthStateListenerProvider

Gestion globale de l'état d'authentification :
1. **Session** : listener `onAuthStateChange` unique, cookies HTTP-only
2. **Cache** : invalidation QueryClient sur SIGNED_OUT
3. **First Activity** : appel `/api/auth/first-activity` 1x/jour
4. **Heartbeat** : ping `/api/auth/heartbeat` toutes les 30s
5. **Multi-tab** : BroadcastChannel + localStorage heartbeats par onglet
6. **Logout** : broadcast cross-tab

---

## 8. Components (200+)

### Organisation

```
src/components/
├── ui/                              # shadcn/ui + custom (80+)
│   ├── intervention-modal/         # Système modal intervention
│   ├── artisan-modal/              # Système modal artisan
│   ├── modal/                      # GenericModal wrapper
│   └── [30+ shadcn components]     # button, card, input, dialog, etc.
├── layout/                          # Structure page (12)
│   ├── app-sidebar.tsx             # Sidebar navigation
│   ├── topbar.tsx                  # Barre navigation
│   ├── GlobalModalHost.tsx         # Portal modal
│   └── auth-guard.tsx              # Permission wrapper
├── shared/                          # Cross-feature (2 majeurs)
│   ├── CommentSection.tsx          # Commentaires (29KB)
│   └── StatusReasonModal.tsx       # Modal raison changement statut
├── interventions/                   # Spécifiques intervention (30+)
│   ├── views/                      # KanbanView, GalleryView, TimelineView, ViewTabs
│   ├── filters/                    # ColumnFilter, TextFilter, DateFilter, etc.
│   ├── InterventionCard.tsx
│   ├── WorkflowVisualizer.tsx
│   └── ConnectionStatusIndicator.tsx
├── artisans/                        # Spécifiques artisan (10+)
├── admin-dashboard/                 # Dashboard admin (20+)
│   ├── VirtualizedDataTable.tsx
│   ├── KPICard.tsx
│   └── [Charts: Vertical, Horizontal, Stacked, Funnel, Sparkline]
├── admin-analytics/                 # Analytics (10+)
│   ├── InterventionMap.tsx
│   └── KPIGrid.tsx
├── dashboard/                       # Dashboard user
├── maps/                            # MapLibreMap
├── virtual-components/              # VirtualTable, VirtualList, VirtualGrid
├── search/                          # UniversalSearchResults
├── documents/                       # useDocumentManager + variants
└── auth/                            # PermissionGate
```

### Composants shadcn/ui (30+)

Button, Card, Input, Textarea, Label, Select, MultiSelect, Checkbox, Switch, RadioGroup, Tabs, Dialog, AlertDialog, DropdownMenu, ContextMenu, Popover, Tooltip, HoverCard, Sheet, Separator, Badge, Avatar, Skeleton, ScrollArea, Accordion, Collapsible, Calendar, DatePicker, Pagination, Command, Table, Sidebar.

### Système Modal

**3 modes d'affichage :**
- `halfpage` : 50% droite (style Notion)
- `centerpage` : Centré classique (défaut, max-w-4xl)
- `fullpage` : Plein écran (mobile)

**Architecture :**
```
GenericModal (base, animation Framer Motion, FocusTrap, unsaved changes)
├── InterventionModal (orchestrateur intervention)
│   ├── InterventionModalContent (vue détail)
│   └── NewInterventionModalContent (création)
└── ArtisanModal (orchestrateur artisan)
    ├── ArtisanModalContent (vue détail)
    └── NewArtisanModalContent (création)
```

### Pattern composition de page

```typescript
// 1. Permission check & loader
// 2. Providers setup (Realtime, Genie Effect, FilterMappers)
// 3. Main PageContent component
// 4. State hook (useInterventionPageState)
// 5. Render layout avec sub-components
// 6. Modals & dialogs en bas
```

### CommentSection (composant partagé majeur, 29KB)

```typescript
type CommentSectionProps = {
  entityType: "artisan" | "intervention"
  entityId: string
  currentUserId?: string | null
  limit?: number
  scrollFadeColor?: string | null
  searchQuery?: string
}
```
- TanStack Query pour state
- Avatars colorés avec initiales
- Highlighting recherche
- Raccourci Ctrl/Cmd+Enter
- Scroll fades dynamiques

---

## 9. Auth & Security

### Flux d'authentification

```
1. User → /login
2. Identifier (email/username) + password
3. /api/auth/resolve → convertit username → email
4. supabase.auth.signInWithPassword()
5. POST /api/auth/session → set cookies HTTP-only
   ├── sb-access-token (1h, httpOnly, sameSite=strict)
   └── sb-refresh-token (7j, httpOnly, sameSite=strict)
6. PATCH /api/auth/status → marks 'connected'
7. queryClient.invalidateQueries("currentUser")
8. window.location.href = /dashboard (full reload pour cookies)
```

### Middleware (`middleware.ts`)

- Root `/` → redirect `/dashboard` ou `/login`
- Chemins publics : `/login`, `/landingpage`, `/set-password`, `/auth/callback`, `/portail`
- Validation token via cookie `sb-access-token`
- Header `x-pathname` pour layout

### API Routes Auth

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/auth/session` | POST | Set cookies session |
| `/api/auth/session` | DELETE | Clear cookies |
| `/api/auth/me` | GET | Profil user + rôles + permissions |
| `/api/auth/resolve` | POST | Username → email (protection timing attack) |
| `/api/auth/status` | PATCH | Mise à jour présence (connected/busy/dnd/offline) |
| `/api/auth/heartbeat` | POST | Heartbeat 30s pour présence |
| `/api/auth/first-activity` | POST | Tracking retard (1x/jour) |

### Présence en temps réel

```
Client: heartbeat toutes les 30s → /api/auth/heartbeat
Server: cron toutes les 60s → check-inactive-users
Seuil: > 90s sans heartbeat → status = 'offline'
```

Avantages vs beforeunload : fonctionne même si onglet crash, kill, coupure réseau.

### Système de permissions

```
Rôles: admin, manager, gestionnaire, viewer
Permissions: read_interventions, write_interventions, delete_interventions,
             read_artisans, write_artisans, export_artisans,
             view_comptabilite, manage_roles, manage_settings, view_admin, etc.
```

- RLS policies sur tables critiques
- `auth_user_mapping` : lien auth.users → public.users
- `user_permissions` : overrides par utilisateur (granted flag)
- `user_page_permissions` : accès par page

### Sécurité

- Cookies HTTP-only (protection XSS)
- PKCE flow pour reset password
- Protection timing attack sur /api/auth/resolve (~200ms constant)
- SMTP password chiffré en DB
- Soft deletes (jamais hard delete users)
- CSP, X-Frame-Options: DENY, HSTS
- `safeErrorMessage` en production

---

## 10. Edge Functions (13)

Toutes les Edge Functions utilisent Deno + Supabase JS, gèrent CORS preflight, logging JSON.

### Liste complète

| Fonction | Rôle | Taille |
|----------|------|--------|
| **interventions-v2** | CRUD interventions complet + artisans + comments + documents + costs | 27K lignes |
| **artisans-v2** | CRUD artisans + métiers + zones + absences + attachments | Large |
| **comments** | CRUD commentaires (intervention/artisan/client) | Medium |
| **documents** | Upload/gestion documents + Supabase Storage | Medium |
| **users** | Liste utilisateurs actifs avec rôles | Small |
| **pull** | Google Sheets → Supabase (sync artisans + interventions) | Medium |
| **push** | Supabase → Google Sheets (sync inverse) | Medium |
| **check-inactive-users** | Cron 60s : marque offline si > 90s inactif | Small |
| **clients** | CRUD clients | Small |
| **tenants** | CRUD locataires | Small |
| **owners** | CRUD propriétaires | Small |
| **enums** | Find/create enum values | Small |
| **utils** | Utilitaires divers | Small |

### Pattern commun Edge Functions

```typescript
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCors()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ... logique

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

---

## 11. Types (11 fichiers)

### `interventions.ts` - Schémas Zod + DTOs

```typescript
const InterventionStatusValues = [
  "DEMANDE", "DEVIS_ENVOYE", "VISITE_TECHNIQUE", "REFUSE", "ANNULE",
  "STAND_BY", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE", "SAV",
  "ATT_ACOMPTE", "POTENTIEL"
]

// Zod schemas: InterventionBaseSchema, CreateInterventionSchema,
// UpdateInterventionSchema, DuplicateCheckSchema, InvoiceLookupSchema
```

### `intervention-generated.ts` - Types générés depuis DB

```typescript
interface Intervention extends InterventionRow {
  artisans?: string[]
  costs?: InterventionCost[]
  payments?: InterventionPayment[]
  attachments?: InterventionAttachment[]
}

interface InterventionWithStatus extends Intervention {
  status?: InterventionStatus | null
}

interface InterventionCost {
  id, intervention_id, cost_type: "sst"|"materiel"|"intervention"|"marge",
  amount, artisan_order: 1|2|null, ...
}
```

### `intervention-views.ts` - Configuration vues

```typescript
type ViewLayout = "table" | "cards" | "gallery" | "kanban" | "calendar" | "timeline"

interface InterventionViewDefinition {
  id, title, layout, visibleProperties[], filters[], sorts[],
  layoutOptions, isDefault?, isCustom?, showBadge?
}

// Options par layout : TableLayoutOptions, KanbanLayoutOptions,
// GalleryLayoutOptions, CalendarLayoutOptions, TimelineLayoutOptions
```

### `intervention-workflow.ts` - Machine à états

```typescript
interface WorkflowStatus {
  id, key, label, color, icon, isTerminal, isInitial, isPinned?,
  position: { x, y },
  metadata: {
    requiresArtisan?, requiresFacture?, requiresProprietaire?,
    requiresCommentaire?, requiresDevisId?,
    autoActions?: AutoAction[]
  }
}

interface WorkflowTransition {
  id, fromStatusId, toStatusId, label,
  conditions: TransitionCondition[], autoActions?, isActive
}
```

### `property-schema.ts` - 123 propriétés

Métadonnées de chaque colonne/propriété : key, label, type, options, sortable, filterable.

### `modal.ts` / `modal-display.ts` - Types modal

```typescript
type ModalContent = "intervention"|"chat"|"artisan"|"new-intervention"|"new-artisan"|"edit-artisan"
type ModalDisplayMode = "halfpage" | "centerpage" | "fullpage"
```

### `search.ts` - Types recherche

```typescript
interface GroupedSearchResults {
  artisans: SearchResultsGroup<ArtisanSearchRecord>
  interventions: SearchResultsGroup<InterventionSearchRecord>
  context: "intervention"|"artisan"|"mixed"
  searchTime: number
}
```

### `artisan-page.ts` - Types UI artisan

Type Contact avec 40+ champs, fonctions de mapping, helpers couleur.

### `context-menu.ts` - Props context menu

### `intervention-view.ts` - Type legacy (re-exports)

---

## 12. Tests

### Structure

```
tests/
├── __fixtures__/interventions.ts          # Factory mock interventions
├── __mocks__/
│   ├── supabase.ts                        # Export mock Supabase
│   ├── supabase/supabase-mock-builder.ts  # Builder pattern fluent
│   └── fixtures/dashboard-stats.fixtures.ts
├── setup.ts                               # Setup global (fetch, matchMedia, etc.)
├── unit/                                  # 48 fichiers
│   ├── components/                        # TruncatedCell, etc.
│   ├── config/                           # Workflow config
│   ├── dashboard/                        # Stats, margin
│   ├── hooks/                            # useInterventionFormState, etc.
│   ├── lib/                              # 35+ fichiers
│   │   ├── interventions/               # API, CRUD, status
│   │   ├── workflow/                    # Cumulative validation
│   │   ├── react-query/                 # Query keys
│   │   └── realtime/                    # Cache sync
│   ├── geocode/                          # Geocoding
│   └── maplibre/                         # Map
├── integration/
│   └── realtime-sync.test.ts             # Cache sync intégration
├── e2e/
│   ├── interventions.playwright.ts
│   └── interventions-page.playwright.ts
└── visual/
    └── intervention-card.playwright.ts
```

**~59 fichiers test, ~400+ tests individuels, ~10 900 lignes de code test**

### Configuration Vitest

```typescript
// vitest.config.ts
{
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/visual/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      thresholds: { global: { statements: 30, branches: 30, functions: 30, lines: 30 } },
    },
    setupFiles: ['./tests/setup.ts'],
  }
}
```

### Setup global

```typescript
// tests/setup.ts
global.fetch = vi.fn()
window.matchMedia = vi.fn().mockImplementation(...)
global.ResizeObserver = vi.fn().mockImplementation(...)
global.IntersectionObserver = vi.fn().mockImplementation(...)
afterEach(() => { vi.clearAllMocks() })
```

### Pattern Mock Builder (Supabase)

```typescript
class SupabaseMockBuilder {
  forTable<T>(tableName, result): this
  forRpc<T>(rpcName, result): this
  withDefaultResult(result): this
  build(): { from, rpc }
}

// Utilisation:
const mock = new SupabaseMockBuilder()
  .forTable('interventions', { data: [...], error: null })
  .build()
```

### Playwright E2E

```typescript
// playwright.config.ts
{
  use: { headless: true, baseURL: 'http://localhost:3000' },
  webServer: { command: 'pnpm dev', port: 3000 },
  timeout: 30000, retries: process.env.CI ? 2 : 0,
}
```

---

## 13. API Routes (Next.js)

### Auth Routes

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/auth/session` | POST/DELETE | Gestion cookies session |
| `/api/auth/me` | GET | Profil + rôles + permissions |
| `/api/auth/resolve` | POST | Username → email |
| `/api/auth/status` | PATCH | Mise à jour présence |
| `/api/auth/heartbeat` | POST | Ping présence 30s |
| `/api/auth/first-activity` | POST | Tracking retard |
| `/api/auth/callback` | GET | PKCE code exchange |

### Settings Routes

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/settings/team` | GET | Liste gestionnaires |
| `/api/settings/team/user` | PATCH | Mise à jour profil |

### Intervention Routes

Principalement déléguées aux Edge Functions `interventions-v2`.

### Artisan Routes

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/artisans/[id]/recalculate-status` | POST | Recalcul statut artisan (async) |

---

## 14. Database Schema

### 82 migrations SQL

**Tables principales :**

#### Users & Auth
```sql
users (id, username, email, firstname, lastname, color, code_gestionnaire,
       status, token_version, last_seen_at, email_smtp*, avatar_url,
       delete_date, deleted_by)

auth_user_mapping (auth_user_id → auth.users, public_user_id → users)
roles (id, name, description)
permissions (id, key, description)
user_roles (user_id, role_id)
role_permissions (role_id, permission_id)
user_permissions (user_id, permission_id, granted, granted_by)
user_page_permissions (user_id, page_key, has_access)
```

#### Données de référence
```sql
metiers (id, code, label, description, is_active, color)
zones (id, code, label, region, is_active)
agencies (id, name, description, is_active)
artisan_statuses (id, code, label, color, sort_order)
intervention_statuses (id, code, label, color, sort_order)
```

#### Artisans
```sql
artisans (id, prenom, nom, email, telephone, telephone2, raison_sociale,
          siret, iban, statut_juridique, statut_id, gestionnaire_id,
          adresse_*, intervention_latitude/longitude, numero_associe,
          is_active, created_at, updated_at)
artisan_metiers (artisan_id, metier_id)
artisan_zones (artisan_id, zone_id)
artisan_statuses_history (id, artisan_id, from_status, to_status, changed_by, changed_at)
```

#### Interventions
```sql
interventions (id, id_inter, agence_id, reference_agence,
               client_id, tenant_id, owner_id, assigned_user_id,
               statut_id, metier_id, updated_by,
               date, date_prevue, date_termine,
               contexte_intervention, consigne_intervention, commentaire_agent,
               adresse, code_postal, ville, latitude, longitude,
               numero_sst, pourcentage_sst, is_vacant, key_code, floor,
               sous_statut_text, sous_statut_text_color, sous_statut_bg_color,
               metier_second_artisan_id, is_active, is_check,
               created_at, updated_at)
intervention_artisans (id, intervention_id, artisan_id, artisan_order, created_at)
intervention_costs (id, intervention_id, artisan_id, cout_intervention,
                    cout_sst, cout_materiel, artisan_order, created_at, updated_at)
clients (id, nom_prenom, prenom, nom, email, telephone)
```

#### Support
```sql
comments (id, entity_id, entity_type, content, comment_type, is_internal,
          reason_type, created_by, created_at)
documents (id, kind, url, filename, mime_type, file_size,
           entity_id, entity_type, created_by, created_at)
intervention_audit_log (id, intervention_id, action_type,
                        changed_fields, old_values, new_values,
                        actor_id, actor_type, created_at)
gestionnaire_targets (user_id, period_type, target_value)
lateness_email_config (id, email_smtp, email_password_encrypted, is_enabled)
```

### Seed Data

- **13 utilisateurs GMBS** (admin, badr, andrea, olivier, tom, paul, louis, samuel, lucien, killian, dimitri, soulaimane, clement)
- **22 métiers** (Plomberie, Electricité, Chauffage, etc.)
- **10 zones** (Paris, Lyon, Marseille, etc.)
- **9 statuts artisan** (Candidat → Expert + One Shot, Inactif, Archivé)
- **11 statuts intervention** (Demandé → Terminé + SAV, Annulé, etc.)
- **4 rôles** (admin, manager, gestionnaire, viewer)

---

## 15. Configuration & Tooling

### package.json - Scripts (38)

```bash
# Développement
npm run dev / build / start / typecheck / lint

# Tests
npm run test / test:watch

# Imports Google Sheets
npm run import:all / import:interventions / import:artisans

# Google Drive
npm run drive:analyze / drive:extract-* / drive:match-* / drive:verify-*

# Exports
npm run export:to-excel / export:interventions-csv

# Database
npm run types:generate  # Génère types Supabase

# Déploiement
npm run deploy:functions / deploy:functions:list

# Recalculs
npm run recalculate:artisan-statuses / recalculate:single-artisan
```

### Next.js (`next.config.mjs`)

- Styled-components compiler support
- Production: console.log removal (garde error/warn)
- Images: remotePatterns Supabase
- Webpack: GLB/GLTF support
- Security headers: CSP, X-Frame-Options: DENY, HSTS, X-Content-Type-Options: nosniff
- Watch ignore: tests, migrations, docs

### TypeScript (`tsconfig.json`)

- target: ES2017, strict: true
- moduleResolution: bundler
- Path alias: `@/*` → `./src/*`
- Exclude: node_modules, scripts, examples, supabase/functions, tests

### ESLint (`eslint.config.js`)

- Flat config (ESLint 9+)
- next/core-web-vitals
- Interdit imports relatifs cross-feature (doit utiliser `@/`)
- Exception: tests, examples, edge functions

### Tailwind (`tailwind.config.ts`)

- Dark mode: class-based
- Couleurs custom : status (11 couleurs), sidebar tokens, gold/silver/bronze
- Animations: accordion, caret-blink, slide-in, fade-in, scale-in
- Plugin: tailwindcss-animate

### CI/CD (`.github/workflows/ci.yml`)

```yaml
Jobs parallèles: lint, typecheck, test
Job séquentiel: build (après les 3)
Node: 20, npm ci --legacy-peer-deps
Test: NODE_OPTIONS='--max-old-space-size=4096' (fix OOM)
Build: nécessite secrets Supabase + MapTiler
```

### PostCSS

- `postcss-import` avec résolution alias `@/`
- Plugin tailwindcss

---

## Appendice : Design Patterns utilisés

| Pattern | Localisation | Description |
|---------|-------------|-------------|
| **Façade** | api/v2/index.ts, interventions/index.ts | Point d'entrée unique |
| **Singleton** | ReferenceCacheManager, SyncQueue, RemoteEditIndicatorManager | Instance unique |
| **Factory** | interventionKeys, dashboardKeys, artisanKeys | Génération query keys |
| **Builder** | SupabaseMockBuilder | Mock fluent pour tests |
| **Observer** | Supabase Realtime, BroadcastChannel, TanStack Query | Événements réactifs |
| **State Machine** | Workflow Engine | Transitions de statuts |
| **Optimistic Update** | useInterventionsMutations, useInterventionContextMenu | Cache avant serveur |
| **Debounce** | useDebounce, debouncedRefreshCounts | Anti-rebond |
| **Exponential Backoff** | SyncQueue | Retry progressif |
| **Co-location** | app/*/\_components/, app/*/\_lib/ | Composants près des pages |
| **Composition** | GenericModal → InterventionModal → Content | Composants emboîtés |
| **Portal** | GlobalModalHost | Rendu modal hors hiérarchie |

---

## Appendice : Fichiers critiques

| Fichier | Priorité | Test requis |
|---------|----------|-------------|
| src/lib/api/v2/interventions/*.ts | Critique | 80%+ |
| src/lib/workflow/ | Critique | 100% |
| src/lib/realtime/cache-sync*.ts | Critique | 80%+ |
| src/hooks/useInterventionsQuery.ts | Haute | 80%+ |
| src/hooks/usePermissions.ts | Haute | 80%+ |
| src/hooks/useInterventionForm.ts | Haute | 80%+ |
| src/hooks/useInterventionViews.ts | Haute | 80%+ |
| src/lib/api/v2/common/cache.ts | Haute | 80%+ |
| supabase/functions/ | Moyenne | 60%+ |
