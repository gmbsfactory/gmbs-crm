# 01 - Cartographie Technique GMBS-CRM

> **Audit IA** | Date : 12 fevrier 2026 | Version : 1.0

---

## 1. Architecture Globale

### 1.1 Diagramme d'architecture

```mermaid
graph TB
    subgraph "Frontend - Next.js 15 App Router"
        PAGES["28 Pages/Routes"]
        COMP["200+ Composants React"]
        HOOKS["67 Hooks Custom"]
        CONTEXTS["9 React Contexts"]
        STORE["Zustand Store (settings)"]
    end

    subgraph "State Management"
        TQ["TanStack Query v5<br/>Cache serveur"]
        ZU["Zustand<br/>UI state"]
        CTX["React Context<br/>Scope data"]
        URL["URL Params<br/>Filtres/Pagination"]
    end

    subgraph "API Layer"
        APIV2["API v2 Facade<br/>29 modules | 12 469 lignes"]
        SEARCH["Search Engine<br/>Full-text + Scoring"]
        CACHE["Cache Layer<br/>Query Keys Factory"]
    end

    subgraph "Backend - Supabase"
        EF["13 Edge Functions (Deno)"]
        RT["Realtime Channel<br/>Cache Sync + Broadcast"]
        AUTH["Supabase Auth<br/>PKCE + RLS"]
        STORAGE["Supabase Storage<br/>Documents/Photos"]
    end

    subgraph "Database - PostgreSQL"
        DB["45 Tables"]
        MV["3 Vues Materialisees<br/>interventions_search_mv<br/>artisans_search_mv<br/>global_search_mv"]
        TRIGGERS["20+ Triggers"]
        RPC["15+ Fonctions RPC"]
        AUDIT["Audit Log Complet"]
    end

    subgraph "Services Externes"
        GEOCODE["Geocodage<br/>OpenCage / Nominatim"]
        SIRET["API SIRET / INSEE"]
        SMTP["Nodemailer SMTP"]
        OPENAI["OpenAI SDK v6.9"]
        GSHEETS["Google Sheets Sync"]
    end

    PAGES --> HOOKS
    HOOKS --> TQ
    HOOKS --> ZU
    HOOKS --> CTX
    COMP --> HOOKS
    TQ --> APIV2
    APIV2 --> EF
    EF --> DB
    DB -->|Realtime| RT
    RT --> TQ
    SEARCH --> MV
    EF --> STORAGE
    EF --> GEOCODE
    EF --> SIRET
    EF --> SMTP

    style APIV2 fill:#3B82F6,color:#fff
    style DB fill:#10B981,color:#fff
    style EF fill:#F59E0B,color:#fff
    style TQ fill:#8B5CF6,color:#fff
```

### 1.2 Flux de donnees detaille

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant C as Composant React
    participant H as Hook Custom
    participant TQ as TanStack Query
    participant API as API v2
    participant EF as Edge Function
    participant DB as PostgreSQL
    participant RT as Realtime

    U->>C: Action (clic, saisie)
    C->>H: Appel hook
    H->>TQ: useQuery / useMutation
    TQ->>API: interventionsApi.getById(id)
    API->>EF: fetch(/interventions-v2)
    EF->>DB: SELECT avec RLS
    DB-->>EF: Resultats
    EF-->>API: Response JSON
    API-->>TQ: Data
    TQ-->>H: { data, isLoading }
    H-->>C: Render
    C-->>U: Affichage

    Note over DB,RT: Changement par un autre utilisateur
    DB->>RT: pg_notify / Realtime channel
    RT->>TQ: Cache invalidation
    TQ->>API: Refetch automatique
    API->>EF: GET actualisé
    EF->>DB: SELECT
    DB-->>EF: Donnees fraiches
    EF-->>API: Response
    API-->>TQ: Cache mis a jour
    TQ-->>C: Re-render automatique
```

---

## 2. Inventaire des Routes

### 2.1 Pages principales

| Route | Fichier | Description | Composants cles |
|-------|---------|-------------|-----------------|
| `/dashboard` | `app/dashboard/page.tsx` | Dashboard gestionnaire avec KPIs | StatsBarChart, MarginStatsCard, Speedometer, GestionnaireRankingPodium |
| `/interventions` | `app/interventions/page.tsx` | Liste interventions avec 8 vues | FiltersBar, InterventionViews, ContextMenu |
| `/interventions/[id]` | `app/interventions/[id]/page.tsx` | Detail/edition intervention | InterventionEditForm (2778 L), CommentSection (30k) |
| `/interventions/new` | `app/interventions/new/page.tsx` | Creation intervention | NewInterventionForm (1822 L) |
| `/artisans` | `app/artisans/page.tsx` | Liste artisans | ArtisanViewTabs, filtres |
| `/comptabilite` | `app/comptabilite/page.tsx` | Module comptabilite | Checks, factures |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Dashboard administrateur | Stats globales, breakdown par agence/metier |
| `/admin/analytics` | `app/admin/analytics/page.tsx` | Analytics avancees | Graphiques Recharts, Sankey, ReactFlow |
| `/settings/*` | `app/settings/` | 6 sous-pages | Profil, Equipe, Interface, Workflow, Enums, Targets |
| `/login` | `app/(auth)/login/page.tsx` | Authentification | Supabase Auth PKCE |
| `/set-password` | `app/(auth)/set-password/page.tsx` | Definition mot de passe | Auth flow |

### 2.2 Layouts

| Layout | Fichier | Role |
|--------|---------|------|
| Root | `app/layout.tsx` (14k) | 10 providers imbriques, Topbar, Sidebar, GlobalShortcuts |
| Auth | `app/(auth)/layout.tsx` | Layout simplifie sans sidebar |
| Interventions | `app/interventions/layout.tsx` | Preload + filtres interventions |
| Settings | `app/settings/layout.tsx` | Navigation settings |

---

## 3. Modules API v2

### 3.1 Architecture facade

```mermaid
graph LR
    subgraph "Facade Principale"
        INDEX["src/lib/api/v2/index.ts"]
    end

    subgraph "Interventions (3 794 L)"
        CRUD["interventions-crud.ts<br/>17 methodes"]
        STATUS["interventions-status.ts<br/>8 methodes"]
        COSTS["interventions-costs.ts<br/>9 methodes"]
        STATS["interventions-stats.ts<br/>27 methodes"]
        FILTERS["interventions-filters.ts<br/>5 methodes"]
    end

    subgraph "Autres Modules"
        ART["artisansApi (2 447 L)"]
        USR["usersApi (759 L)"]
        ROLES["rolesApi (435 L)"]
        DOCS["documentsApi (429 L)"]
        ENUMS["enumsApi (567 L)"]
        SRCH["search.ts (1 063 L)"]
        CLI["clientsApi"]
        AGN["agenciesApi"]
        REMIND["remindersApi"]
        TENANT["tenantsApi"]
        OWNER["ownersApi"]
        COMMENTS["commentsApi"]
    end

    subgraph "Common Layer"
        ERR["error-handler.ts"]
        CACHEMOD["cache.ts"]
        TYPES["types.ts"]
    end

    INDEX --> CRUD
    INDEX --> STATUS
    INDEX --> COSTS
    INDEX --> STATS
    INDEX --> FILTERS
    INDEX --> ART
    INDEX --> USR
    INDEX --> ROLES
    INDEX --> DOCS
    INDEX --> ENUMS
    INDEX --> SRCH
    INDEX --> CLI
    INDEX --> AGN
    INDEX --> REMIND

    CRUD --> ERR
    STATUS --> ERR
    ART --> CACHEMOD
```

### 3.2 Methodes API principales

| Module | Methodes cles | Total |
|--------|--------------|-------|
| **interventions-crud** | getById, create, update, delete, getList, getLight | 17 |
| **interventions-status** | updateStatus, validateTransition, getTransitions | 8 |
| **interventions-costs** | getCosts, updateCosts, getMarginHistory | 9 |
| **interventions-stats** | getRevenueHistory, getCycleTimeHistory, getTransformationRate, getAdminDashboardStats | 27 |
| **interventions-filters** | getFilterCounts, getStatusCounts | 5 |
| **artisansApi** | CRUD, getMetiers, getZones, getAbsences, getNearby | 30+ |
| **usersApi** | CRUD, getRoles, getPermissions | 20+ |
| **search** | universalSearch, searchInterventions, searchArtisans | 10+ |

---

## 4. Categorisation des 67 Hooks

### 4.1 Par categorie fonctionnelle

```mermaid
pie title Repartition des 67 Hooks Custom
    "Query/Fetch (10)" : 10
    "Mutations (3)" : 3
    "Views/Filtres (5)" : 5
    "Modals (5)" : 5
    "Workflow (8)" : 8
    "Realtime (2)" : 2
    "Analytics (11)" : 11
    "UI/UX (10)" : 10
    "Preload (3)" : 3
    "Utilitaires (10)" : 10
```

| Categorie | Hooks | Fichiers cles |
|-----------|-------|---------------|
| **Query** | useInterventionsQuery, useArtisansQuery, useDashboardStatsQuery | Fetch TanStack Query |
| **Mutations** | useInterventionsMutations, useInterventionForm, useInterventionFormState | CRUD avec rollback optimiste |
| **Views** | useInterventionViews, useArtisanViews, useFilterCounts, useSmartFilters | 8 layouts (table, kanban, calendar...) |
| **Modals** | useModal, useInterventionModal, useArtisanModal | Systeme fullpage/halfpage/centerpage |
| **Workflow** | useWorkflowConfig, useInterventionStatuses, usePermissions, useStatusTransitions | State machine 12 statuts |
| **Realtime** | useInterventionsRealtime, useInterventionReminders | Cache sync + broadcast |
| **Analytics** | useDashboardStats, useRevenueHistory, useMarginHistory, useCycleTimeHistory, useTransformationRateHistory, useAdminDashboardStats | KPIs temps reel |
| **UI/UX** | useIsNarrow, useKeyboardShortcuts, useLowPowerMode, useSubmitShortcut, usePlatformKey | Responsive + accessibilite |
| **Preload** | usePreloadInterventions, usePreloadDefaultViews | Warm-up cache |
| **Utilitaires** | useNearbyArtisans, useSiretVerification, useGeocodeSearch, useDebounce, useDocumentUpload | Integrations externes |

---

## 5. Systeme Realtime

### 5.1 Architecture de synchronisation

```mermaid
graph TB
    subgraph "Source"
        PG["PostgreSQL<br/>INSERT/UPDATE/DELETE"]
    end

    subgraph "Transport"
        CHANNEL["Supabase Realtime Channel<br/>filter: is_active=eq.true"]
        BROADCAST["BroadcastChannel<br/>Cross-tab sync"]
    end

    subgraph "Orchestration (1 839 lignes)"
        SYNC["cache-sync.ts (323 L)<br/>Orchestrateur principal"]
        HANDLERS["event-handlers.ts (278 L)<br/>INSERT/UPDATE/DELETE"]
        ENRICH["enrichment.ts (77 L)<br/>Enrichit donnees"]
        CONFLICT["conflict-detection.ts (99 L)<br/>Detection conflits"]
        QUEUE["sync-queue.ts (302 L)<br/>File d'attente + retry"]
        REMOTE["remote-edit-indicator.ts (228 L)<br/>Live cursors"]
    end

    subgraph "Cache"
        TQ2["TanStack Query Cache"]
        POLL["Fallback Polling"]
    end

    PG -->|pg_notify| CHANNEL
    CHANNEL --> SYNC
    SYNC --> HANDLERS
    HANDLERS --> ENRICH
    ENRICH --> TQ2
    SYNC --> CONFLICT
    CONFLICT -->|si conflit| QUEUE
    QUEUE -->|retry| SYNC
    CHANNEL -->|echec| POLL
    POLL --> TQ2
    SYNC --> BROADCAST
    BROADCAST -->|autres onglets| TQ2
    SYNC --> REMOTE
```

### 5.2 Modules realtime

| Module | Lignes | Role |
|--------|--------|------|
| `realtime-client.ts` | 100 | Channel Supabase (filter: is_active=eq.true) |
| `cache-sync.ts` | 323 | Orchestrateur principal |
| `event-handlers.ts` | 278 | Traiteurs INSERT/UPDATE/DELETE |
| `enrichment.ts` | 77 | Enrichissement donnees relationnelles |
| `broadcasting.ts` | 43 | Sync cross-tab |
| `conflict-detection.ts` | 99 | Detection conflits edition |
| `sync-queue.ts` | 302 | Queue + retry + offline |
| `remote-edit-indicator.ts` | 228 | Indicateurs edition en temps reel |
| `filter-utils.ts` | 201 | Utilitaires filtrage realtime |

---

## 6. Workflow Engine

### 6.1 Machine a etats des interventions

```mermaid
stateDiagram-v2
    [*] --> DEMANDE
    [*] --> POTENTIEL

    DEMANDE --> DEVIS_ENVOYE : Envoi devis
    DEMANDE --> VISITE_TECHNIQUE : Visite requise
    DEMANDE --> REFUSE : Refus
    DEMANDE --> ANNULE : Annulation

    DEVIS_ENVOYE --> ACCEPTE : Client accepte
    DEVIS_ENVOYE --> REFUSE : Client refuse
    DEVIS_ENVOYE --> STAND_BY : Mise en attente

    VISITE_TECHNIQUE --> ACCEPTE : Validation
    VISITE_TECHNIQUE --> REFUSE : Refus
    VISITE_TECHNIQUE --> STAND_BY : Attente

    ACCEPTE --> INTER_EN_COURS : Demarrage
    ACCEPTE --> STAND_BY : Pause
    ACCEPTE --> ANNULE : Annulation
    ACCEPTE --> INTER_TERMINEE : Cloture express

    INTER_EN_COURS --> INTER_TERMINEE : Fin travaux
    INTER_EN_COURS --> SAV : Probleme
    INTER_EN_COURS --> STAND_BY : Pause
    INTER_EN_COURS --> VISITE_TECHNIQUE : Nouvelle visite

    STAND_BY --> ACCEPTE : Reprise
    STAND_BY --> INTER_EN_COURS : Reprise directe
    STAND_BY --> ANNULE : Annulation

    INTER_TERMINEE --> SAV : Probleme post-livraison
    SAV --> INTER_TERMINEE : Resolution

    INTER_TERMINEE --> [*]
    REFUSE --> [*]
    ANNULE --> [*]
```

### 6.2 Regles de validation par statut

| Statut cible | Champs requis | Validation |
|-------------|---------------|------------|
| DEVIS_ENVOYE | devisId, nomPrenomFacturation, assignedUserId | + idIntervention sans "AUTO" |
| VISITE_TECHNIQUE | artisanId | + idIntervention sans "AUTO" |
| ACCEPTE | devisId | + idIntervention sans "AUTO" |
| INTER_EN_COURS | artisanId, coutIntervention, coutSST, consigneArtisan, nomClient, telClient, datePrevue | **7 prerequis** (goulot) |
| INTER_TERMINEE | artisanId, factureId, proprietaireId, factureGmbsFile | + au moins 1 attachment facturesGMBS |
| REFUSE / ANNULE / SAV / STAND_BY | commentaire | Motif obligatoire |

---

## 7. Edge Functions

### 7.1 Inventaire des 13 fonctions

```mermaid
graph LR
    subgraph "CRUD Principal"
        EF1["interventions-v2<br/>92 KB | CRUD complet"]
        EF2["artisans-v2<br/>62 KB | CRUD + geo"]
        EF3["comments<br/>14 KB | Multi-entite"]
        EF4["documents<br/>29 KB | Upload/gestion"]
        EF5["users<br/>5.5 KB | CRUD users"]
    end

    subgraph "Analytics"
        EF6["interventions-v2-admin-<br/>dashboard-stats<br/>16 KB | Stats temps reel"]
    end

    subgraph "Utilitaires"
        EF7["process-avatar<br/>9.7 KB | Resize images"]
        EF8["check-inactive-users<br/>4.7 KB | Cron"]
        EF9["cache/redis<br/>Compteurs Redis"]
    end

    subgraph "Sync"
        EF10["pull<br/>8.4 KB | Sync entrant"]
        EF11["push<br/>7.4 KB | Sync sortant"]
    end

    subgraph "Legacy"
        EF12["artisans (v1)<br/>8.6 KB | A deprecier"]
    end
```

---

## 8. Points d'injection IA dans l'architecture

### 8.1 Diagramme des points d'injection

```mermaid
graph TB
    subgraph "Couche UI"
        SEARCH["Barre de recherche<br/>🤖 Recherche semantique"]
        FORM["Formulaires<br/>🤖 Auto-completion IA"]
        DASH["Dashboards<br/>🤖 Insights predictifs"]
        MODAL["Modals detail<br/>🤖 Resume IA"]
    end

    subgraph "Couche Hooks"
        HOOK_SEARCH["useUniversalSearch<br/>🤖 + useAISearch"]
        HOOK_FORM["useInterventionForm<br/>🤖 + suggestions artisan"]
        HOOK_STATS["useDashboardStats<br/>🤖 + predictions"]
        HOOK_KB["useKeyboardShortcuts<br/>🤖 + raccourcis IA"]
    end

    subgraph "Couche API"
        API_SEARCH["search.ts<br/>🤖 + semantic search"]
        API_PREDICT["🤖 NOUVEAU: predictApi.ts"]
        API_RECOMMEND["🤖 NOUVEAU: recommendApi.ts"]
    end

    subgraph "Couche Edge Functions"
        EF_EMBED["🤖 NOUVEAU: embed-intervention"]
        EF_PREDICT["🤖 NOUVEAU: predict-artisan"]
        EF_SUMMARY["🤖 NOUVEAU: summarize-intervention"]
        EF_ANOMALY["🤖 NOUVEAU: detect-anomalies"]
        EF_CHAT["🤖 NOUVEAU: ai-chat"]
    end

    subgraph "Couche Database"
        PGVECTOR["🤖 NOUVEAU: pgvector extension"]
        EMBED_TABLE["🤖 NOUVEAU: intervention_embeddings"]
        AI_CACHE["🤖 NOUVEAU: intervention_ai_cache"]
        SCORES["🤖 NOUVEAU: artisan_ai_scores"]
    end

    subgraph "Services IA Externes"
        CLAUDE["API Claude (Anthropic)"]
        EMBEDDINGS["Embeddings API"]
    end

    SEARCH --> HOOK_SEARCH
    HOOK_SEARCH --> API_SEARCH
    API_SEARCH --> EF_EMBED
    EF_EMBED --> PGVECTOR
    EF_EMBED --> EMBEDDINGS

    FORM --> HOOK_FORM
    HOOK_FORM --> API_RECOMMEND
    API_RECOMMEND --> EF_PREDICT
    EF_PREDICT --> SCORES

    DASH --> HOOK_STATS
    HOOK_STATS --> API_PREDICT
    API_PREDICT --> AI_CACHE

    MODAL --> EF_SUMMARY
    EF_SUMMARY --> CLAUDE

    HOOK_KB --> EF_CHAT
    EF_CHAT --> CLAUDE

    style PGVECTOR fill:#EF4444,color:#fff
    style CLAUDE fill:#8B5CF6,color:#fff
    style EF_EMBED fill:#F59E0B,color:#fff
    style EF_PREDICT fill:#F59E0B,color:#fff
    style EF_SUMMARY fill:#F59E0B,color:#fff
    style EF_CHAT fill:#F59E0B,color:#fff
```

### 8.2 Points d'injection par priorite

| # | Point d'injection | Fichier existant | Nouveau fichier | Impact | Effort |
|---|-------------------|------------------|-----------------|--------|--------|
| 1 | Recherche semantique | `src/lib/api/v2/search.ts` | `supabase/functions/embed-intervention/` | Recherche +40% CTR | 2 sem |
| 2 | Recommandation artisan | `src/hooks/useNearbyArtisans.ts` | `supabase/functions/predict-artisan/` | Allocation -60% temps | 2-3 sem |
| 3 | Resume contextuel | `src/hooks/useKeyboardShortcuts.ts` | `src/components/ai/AIAssistantDialog.tsx` | UX power-users | 1-2 sem |
| 4 | Pre-remplissage formulaire | `src/hooks/useInterventionForm.ts` | `src/lib/ai/form-assistant.ts` | Saisie -50% temps | 2 sem |
| 5 | Predictions analytics | `src/hooks/useDashboardStats.ts` | `src/lib/api/v2/interventions/interventions-forecast.ts` | Previsions fiables | 3 sem |
| 6 | Classification documents | `src/lib/api/v2/documentsApi.ts` | `supabase/functions/classify-document/` | Retrouvabilite +40% | 2-3 sem |
| 7 | Detection anomalies | `intervention_audit_log` | `supabase/functions/detect-anomalies/` | Compliance automatique | 3 sem |
| 8 | Chat assistant | `app/layout.tsx` | `src/components/ai/ChatPanel.tsx` | Transformation UX | 4-6 sem |

---

## 9. Evaluation de la modularite

### 9.1 Scores

| Critere | Score | Justification |
|---------|-------|---------------|
| **Separation des responsabilites** | 9/10 | API v2 facade, hooks isoles, contexts dedies |
| **Extensibilite** | 8.5/10 | Pattern co-location, factory keys, modules API composables |
| **Testabilite** | 8/10 | Mock builder Supabase, hooks isolables, fixtures |
| **Integration IA** | 7/10 | Points d'entree clairs, mais pas de couche IA existante |
| **Performance** | 8.5/10 | Virtualisation, preload, cache TanStack, vues materialisees |
| **Scalabilite** | 8/10 | Edge Functions, Redis cache, batch processing |

### 9.2 Forces architecturales pour l'IA

- **API Facade** : Permet d'ajouter des modules IA sans toucher a l'existant
- **Query Key Factory** : Invalidation ciblee pour les predictions IA
- **Hook pattern** : Creer `useAISuggestions(id)` suit le meme pattern que les hooks existants
- **Edge Functions** : Ajouter de nouvelles fonctions IA sans modifier le frontend
- **Realtime** : Enrichir le cache-sync avec des scores IA en temps reel
- **Audit Log** : Donnees historiques riches pour entrainer des modeles

### 9.3 Lacunes a combler

- **Pas de pgvector** : Extension a installer pour les embeddings
- **Pas de couche IA** : Creer `src/lib/ai/` avec prompts, context-detector, etc.
- **Pas de feature flags** : Utile pour deployer l'IA progressivement
- **Pas de rate limiting** : Necessaire pour controler les couts API IA
- **OpenAI SDK present** : v6.9.1 dans package.json mais usage minimal

---

## 10. Stack technique complete

### 10.1 Dependances principales

| Categorie | Technologie | Version |
|-----------|-------------|---------|
| **Framework** | Next.js | 15.5.7 |
| **UI** | React | 18.3.1 |
| **Langage** | TypeScript | 5.x (strict) |
| **Backend** | Supabase | 2.58.0 |
| **State** | TanStack Query | 5.90.2 |
| **State UI** | Zustand | 5.0.8 |
| **CSS** | Tailwind CSS | 3.4.17 |
| **Composants** | shadcn/ui + Radix | 20+ packages |
| **Formulaires** | React Hook Form + Zod | 7.54.1 + 3.24.1 |
| **Cartes** | MapLibre GL + MapTiler | 5.9.0 + 3.8.0 |
| **Graphiques** | Recharts + Nivo + ReactFlow | latest |
| **Animations** | Framer Motion | 12.23.12 |
| **IA** | OpenAI SDK | 6.9.1 |
| **Email** | Nodemailer | 7.0.10 |
| **Tests** | Vitest + Playwright | 3.2.4 + 1.55.0 |
| **Import/Export** | ExcelJS + PapaParse + Google Sheets | Divers |

### 10.2 Extensions PostgreSQL

| Extension | Usage |
|-----------|-------|
| `pg_stat_statements` | Statistiques de requetes |
| `pgcrypto` | Chiffrement / UUID |
| `pg_trgm` | Recherche trigram (fuzzy) |
| `unaccent` | Recherche sans accents |
| **pgvector** (a ajouter) | **Embeddings vectoriels pour IA** |
