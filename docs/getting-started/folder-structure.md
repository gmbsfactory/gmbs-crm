# Structure des dossiers

Cartographie complete de l'arborescence du projet avec le role de chaque dossier.

---

## Vue racine

```
gmbs-crm/
├── app/                        # Next.js App Router (pages, layouts, API routes)
├── src/                        # Code source principal (composants, hooks, API, types)
├── supabase/                   # Backend Supabase (Edge Functions, migrations, seeds)
├── tests/                      # Tests (unit, integration, e2e, visual)
├── scripts/                    # Scripts utilitaires (imports, exports, maintenance)
├── docs/                       # Documentation du projet
├── public/                     # Assets statiques
├── middleware.ts               # Middleware Next.js (auth, redirections)
├── next.config.mjs             # Configuration Next.js
├── tailwind.config.ts          # Configuration Tailwind CSS
├── vitest.config.ts            # Configuration Vitest
├── playwright.config.ts        # Configuration Playwright
├── tsconfig.json               # Configuration TypeScript
├── eslint.config.js            # Configuration ESLint (flat config)
├── package.json                # Dependances et scripts
├── CLAUDE.md                   # Instructions pour Claude Code
└── .github/workflows/ci.yml   # Pipeline CI/CD
```

---

## `app/` -- Next.js App Router

Le dossier `app/` utilise le [App Router](https://nextjs.org/docs/app) de Next.js 15. Chaque sous-dossier correspond a une route.

```
app/
├── (auth)/                     # Route group pour les pages d'authentification
│   ├── login/                  # Page de connexion
│   └── set-password/           # Page de configuration du mot de passe
├── admin/                      # Section administration
│   ├── analytics/              # Analytics avances (cartes, KPIs)
│   └── dashboard/              # Dashboard admin (stats globales)
├── api/                        # Routes API Next.js (API routes)
│   ├── auth/                   # Auth endpoints (session, me, resolve, status, heartbeat)
│   ├── settings/               # Configuration equipe et profils
│   ├── artisans/               # Recalcul statuts artisans
│   ├── geocode/                # Geocodage d'adresses
│   ├── interventions/          # Delegation vers Edge Functions
│   ├── targets/                # Objectifs gestionnaires
│   ├── users/                  # Gestion utilisateurs
│   └── ...                     # Autres routes (siret, credits, lateness)
├── artisans/                   # Pages artisans
│   ├── page.tsx                # Liste des artisans
│   ├── _components/            # Composants co-localises
│   └── _lib/                   # Logique co-localisee
├── comptabilite/               # Page comptabilite
├── dashboard/                  # Dashboard utilisateur
├── interventions/              # Pages interventions
│   ├── page.tsx                # Liste des interventions
│   ├── [id]/page.tsx           # Detail d'une intervention
│   ├── new/page.tsx            # Creation d'une intervention
│   ├── _components/            # Composants co-localises
│   └── _lib/                   # Logique co-localisee
├── landingpage/                # Page d'accueil publique
├── settings/                   # Pages de parametres
│   ├── interface/              # Personnalisation UI
│   ├── profile/                # Profil utilisateur
│   ├── team/                   # Gestion equipe
│   ├── targets/                # Objectifs
│   └── enums/                  # Gestion des enums (metiers, zones)
├── auth/                       # Callback d'authentification (PKCE)
├── layout.tsx                  # Layout racine (providers, sidebar, topbar)
├── globals.css                 # Styles globaux (Tailwind + custom)
└── page.tsx                    # Redirect vers /dashboard ou /login
```

### Pattern de co-location

Le projet utilise le pattern de co-location de Next.js App Router. Les composants et la logique specifiques a une page sont places dans des dossiers prefixes par `_` :

```
app/interventions/
├── page.tsx                    # Page principale
├── layout.tsx                  # Layout de la route
├── [id]/page.tsx               # Page detail (route dynamique)
├── new/page.tsx                # Page creation
├── _components/                # Composants utilises UNIQUEMENT par ces pages
│   ├── InterventionsPlusMenu.tsx
│   ├── InterventionsStatusFilter.tsx
│   └── InterventionsViewRenderer.tsx
└── _lib/                       # Hooks/logique utilises UNIQUEMENT par ces pages
    └── useInterventionPageState.ts
```

Les dossiers prefixes `_` ne sont pas consideres comme des routes par Next.js. Ce pattern evite de polluer `src/components/` avec des composants specifiques a une seule page.

---

## `src/` -- Code source principal

```
src/
├── components/                 # Composants React (290+)
│   ├── ui/                     # Composants shadcn/ui + custom (80+)
│   │   ├── intervention-modal/ # Systeme modal intervention (detail, creation)
│   │   ├── artisan-modal/      # Systeme modal artisan
│   │   ├── modal/              # GenericModal (base commune)
│   │   ├── button.tsx          # shadcn/ui
│   │   ├── card.tsx            # shadcn/ui
│   │   ├── input.tsx           # shadcn/ui
│   │   ├── dialog.tsx          # shadcn/ui
│   │   └── ...                 # 30+ composants shadcn/ui
│   ├── layout/                 # Structure de page (12 composants)
│   │   ├── app-sidebar.tsx     # Sidebar de navigation
│   │   ├── topbar.tsx          # Barre de navigation superieure
│   │   ├── GlobalModalHost.tsx # Portail de rendu des modals
│   │   └── auth-guard.tsx      # Garde de permission
│   ├── shared/                 # Composants cross-feature
│   │   ├── CommentSection.tsx  # Systeme de commentaires (29KB)
│   │   └── StatusReasonModal.tsx
│   ├── interventions/          # Composants specifiques intervention (30+)
│   │   ├── views/              # KanbanView, GalleryView, TimelineView, etc.
│   │   ├── filters/            # Composants de filtrage
│   │   └── InterventionCard.tsx
│   ├── artisans/               # Composants specifiques artisan (10+)
│   ├── admin-dashboard/        # Dashboard admin (KPIs, charts, tables)
│   ├── admin-analytics/        # Analytics (cartes, grilles KPI)
│   ├── dashboard/              # Dashboard utilisateur
│   ├── debug/                  # Dashboard developpeur (Alt+R)
│   │   ├── DeveloperDashboard.tsx
│   │   ├── DeveloperDashboardLoader.tsx
│   │   └── panels/            # Panneaux (Realtime, Performance, Network, Auth, Config)
│   ├── maps/                   # Carte MapLibre GL
│   ├── virtual-components/     # Virtualisation (VirtualTable, VirtualList)
│   ├── search/                 # Recherche universelle
│   ├── documents/              # Gestion de documents
│   └── auth/                   # PermissionGate
│
├── hooks/                      # 99 hooks custom
│   ├── useInterventionsQuery.ts    # Fetching interventions pagine
│   ├── useInterventionsMutations.ts # CRUD optimiste
│   ├── useCrmRealtime.ts          # Sync temps reel (leader election + event router)
│   ├── useInterventionPresence.ts  # Presence collaborative (qui consulte l'intervention)
│   ├── useFieldPresenceDelegation.ts # Tracking focus champs formulaire
│   ├── useModalFreshness.ts       # Polling T2 conditionnel (modal-scoped)
│   ├── useDashboardFreshness.ts   # Options T3 pre-configurees (dashboard)
│   ├── useComptabiliteQuery.ts    # Fetching comptabilite paginee
│   ├── useRealtimeStats.ts        # Stats debug Realtime
│   ├── useDeveloperDashboard.ts   # Toggle dashboard dev (Alt+R)
│   ├── useCurrentUser.ts          # Utilisateur authentifie
│   ├── usePermissions.ts          # Verification des permissions
│   ├── useInterventionViews.ts    # Gestion des 8 layouts de vues
│   ├── useModal.ts                # Etat des modals
│   └── ...                        # 60+ autres hooks
│
├── lib/                        # Logique metier et services
│   ├── api/v2/                 # API Layer V2 (~22 modules)
│   │   ├── common/             # Types centraux, client, cache, error handler
│   │   │   ├── types.ts        # Intervention, Artisan, User, etc.
│   │   │   ├── client.ts       # Client Supabase (browser/Node)
│   │   │   ├── cache.ts        # Singleton cache references (5min TTL)
│   │   │   ├── error-handler.ts
│   │   │   ├── utils.ts        # mapInterventionRecord, getHeaders
│   │   │   └── constants.ts
│   │   ├── interventions/      # 5 modules (crud, status, costs, stats, filters)
│   │   ├── artisansApi.ts
│   │   ├── usersApi.ts
│   │   ├── commentsApi.ts
│   │   ├── documentsApi.ts
│   │   ├── clientsApi.ts
│   │   └── index.ts            # Facade principale (apiV2)
│   ├── supabase/               # Clients Supabase SSR (@supabase/ssr)
│   │   ├── client.ts           # Client navigateur (createBrowserClient, singleton)
│   │   ├── server-ssr.ts       # Client serveur (Route Handlers, Server Components)
│   │   └── middleware.ts       # Helper middleware (rafraichissement JWT via getUser)
│   ├── realtime/               # Synchronisation temps reel
│   │   ├── realtime-client.ts  # Channel Supabase Realtime (3 tables multiplexees)
│   │   ├── cache-sync.ts       # Orchestration cache
│   │   ├── cache-sync/         # Handlers, conflits, enrichissement
│   │   ├── event-router/       # Pipeline d'evenements (normalize → route → middleware)
│   │   │   ├── types.ts        # CrmEvent, SyncContext, SyncMiddleware, STOP
│   │   │   ├── normalize.ts    # Normalisation payload Supabase → CrmEvent
│   │   │   ├── router.ts       # Routeur (table → pipeline)
│   │   │   ├── pipeline.ts     # Executeur pipeline avec support STOP sentinel
│   │   │   └── middleware/     # Middlewares par table (interventions, artisans, junction, shared)
│   │   ├── leader-election.ts  # Election leader via Web Locks API (1 WS/navigateur)
│   │   ├── realtime-relay.ts   # Relay BroadcastChannel leader→followers
│   │   ├── broadcast-sync.ts   # BroadcastChannel cross-tab (fallback)
│   │   └── sync-queue.ts       # File offline avec retry
│   ├── workflow/               # Moteur de workflow
│   │   └── cumulative-validation.ts
│   ├── workflow-engine.ts      # Validation des transitions
│   ├── workflow-persistence.ts # Persistance localStorage
│   ├── supabase-client.ts      # Client Supabase singleton
│   ├── env.ts                  # Variables d'env publiques
│   ├── env.server.ts           # Variables d'env serveur
│   └── query-keys.ts           # Factory de query keys TanStack
│
├── config/                     # Configuration metier
│   ├── workflow-rules.ts       # 30 transitions autorisees
│   ├── intervention-status-chains.ts # Chaines de statuts
│   ├── status-colors.ts        # Couleurs par statut
│   ├── freshness-tiers.ts      # 4 niveaux de fraicheur T1-T4 (Realtime/polling/on-demand)
│   ├── navigation.ts           # Configuration de la navigation
│   └── domain.ts               # Constantes metier
│
├── contexts/                   # 10 React Contexts
│   ├── FieldPresenceContext.tsx # Presence au niveau des champs formulaire
│   ├── FilterMappersContext.tsx # Traduction Code→ID pour filtres
│   ├── GenieEffectContext.tsx   # Animation de deplacement d'interventions
│   ├── interface-context.tsx   # Theme et layout UI
│   ├── ModalDisplayContext.tsx  # Mode d'affichage des modals
│   ├── NavigationContext.tsx    # Cache navigation
│   ├── RemindersContext.tsx     # Rappels intervention + mentions
│   ├── SimpleOptimizedContext.tsx # Cache leger (50 entries)
│   ├── UltraOptimizedContext.tsx  # Cache avance (100 entries, LRU)
│   └── user-status-context.tsx # Tracking presence utilisateur
│
├── providers/                  # Providers React globaux
│   └── AuthStateListenerProvider # Auth, heartbeat, multi-tab
│
├── stores/                     # Zustand stores
│   └── settings.ts             # Preferences UI (sidebar, theme)
│
├── types/                      # 13 fichiers de types TypeScript
│   ├── interventions.ts        # Schemas Zod + DTOs
│   ├── intervention-generated.ts # Types generes depuis la DB
│   ├── intervention-views.ts   # Configuration des vues
│   ├── intervention-workflow.ts # Machine a etats
│   ├── property-schema.ts      # 123 proprietes de colonnes
│   ├── presence.ts             # Types PresenceUser et PresencePayload
│   └── ...                     # modal, search, artisan, context-menu
│
└── utils/                      # Utilitaires generiques
```

---

## `supabase/` -- Backend

```
supabase/
├── functions/                  # 13+ Edge Functions (Deno, deploiees via scripts/deploy-all-functions.js)
│   ├── interventions-v2/       # CRUD interventions complet
│   ├── artisans-v2/            # CRUD artisans complet
│   ├── comments/               # CRUD commentaires
│   ├── documents/              # Upload/gestion documents
│   ├── users/                  # Liste utilisateurs
│   ├── pull/                   # Google Sheets → Supabase
│   ├── push/                   # Supabase → Google Sheets
│   ├── check-inactive-users/   # Cron : marquage offline
│   ├── clients/                # CRUD clients
│   ├── tenants/                # CRUD locataires
│   ├── owners/                 # CRUD proprietaires
│   ├── enums/                  # Gestion des enums
│   ├── process-avatar/         # Traitement d'avatars
│   └── _shared/                # Code partage (CORS, auth JWT)
├── migrations/                 # 85 migrations SQL
├── seeds/                      # Donnees initiales (users, metiers, zones, statuts)
├── config.toml                 # Configuration Supabase locale
└── BACKEND_DEPLOYMENT.md       # Guide de deploiement
```

---

## `tests/` -- Tests

```
tests/
├── __fixtures__/               # Donnees de test (factory mock)
│   └── interventions.ts        # Factory d'interventions mock
├── __mocks__/                  # Mocks partages
│   ├── supabase.ts             # Mock Supabase export
│   └── supabase/               # Builder pattern fluent
│       ├── supabase-mock-builder.ts
│       └── fixtures/
├── setup.ts                    # Setup global (fetch, matchMedia, ResizeObserver)
├── unit/                       # Tests unitaires (~60 fichiers)
│   ├── components/             # Tests composants
│   ├── config/                 # Tests configuration workflow
│   ├── dashboard/              # Tests stats dashboard
│   ├── hooks/                  # Tests hooks custom
│   └── lib/                    # Tests logique metier (40+ fichiers)
│       ├── interventions/      # API, CRUD, status, mappers, post-mutation
│       ├── workflow/           # Validation cumulative
│       ├── react-query/        # Query keys, freshness
│       ├── realtime/           # Cache sync, leader election, relay, event-router
│       ├── comptabilite/       # Formatters comptabilite
│       └── security-headers.test.ts
├── integration/                # Tests d'integration
│   └── realtime-sync.test.ts
├── e2e/                        # Tests end-to-end (Playwright)
│   ├── interventions.playwright.ts
│   └── interventions-page.playwright.ts
└── visual/                     # Tests visuels (Playwright)
    └── intervention-card.playwright.ts
```

Environ 70+ fichiers de test, 500+ tests individuels.

---

## `scripts/` -- Utilitaires

```
scripts/
├── core/                       # Scripts TypeScript utilitaires
├── core-node/                  # Scripts Node.js (setup)
├── data/                       # Recalcul statuts artisans
├── data-processing/            # Traitement de donnees
├── ai/                         # Scripts lies a l'IA
├── lib/                        # Bibliotheque partagee pour scripts
├── maintenance/                # Scripts de maintenance
├── python/                     # Scripts Python
├── tests/                      # Tests des scripts
└── README.md                   # Documentation des scripts
```

---

## Conventions de nommage

| Convention | Exemple | Usage |
|------------|---------|-------|
| `_components/` | `app/interventions/_components/` | Composants co-localises avec une page |
| `_lib/` | `app/interventions/_lib/` | Logique co-localisee avec une page |
| `use*.ts` | `useInterventionsQuery.ts` | Hooks React custom |
| `*Api.ts` | `artisansApi.ts` | Modules API |
| `*.test.ts` | `cache.test.ts` | Fichiers de test |
| `*.types.ts` | `database.types.ts` | Definitions de types |
| `[param]` | `[id]/page.tsx` | Routes dynamiques Next.js |
| `(group)` | `(auth)/login/` | Route groups Next.js |

---

## Alias d'import

Le projet utilise un alias TypeScript pour les imports :

```typescript
// tsconfig.json : "@/*" → "./src/*"

// Au lieu de :
import { interventionsApi } from '../../../src/lib/api/v2'

// Utiliser :
import { interventionsApi } from '@/lib/api/v2'
```

L'alias `@/` pointe vers le dossier `src/`. Les imports relatifs cross-feature sont interdits par la configuration ESLint.

---

## Prochaines etapes

- [Stack technique](./tech-stack.md) pour comprendre chaque technologie
- [Vue d'ensemble du projet](./project-overview.md) pour comprendre les modules fonctionnels
