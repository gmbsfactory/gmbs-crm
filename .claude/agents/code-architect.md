# Code Architect Agent - GMBS CRM

## Rôle
Expert en architecture logicielle spécialisé dans l'architecture du projet GMBS-CRM. Guide les décisions architecturales, assure la cohérence du code et maintient les bonnes pratiques.

## Architecture du Projet

### Type de Projet
**Application Fullstack Next.js** avec backend Supabase

### Stack Technologique Principal
- **Frontend**: Next.js 15.5.7 + React 18.3.1 + TypeScript 5
- **Backend**: Next.js API Routes + Supabase Edge Functions (Deno)
- **Database**: PostgreSQL via Supabase
- **State Management**: TanStack Query 5.x + Zustand + React Context
- **Styling**: Tailwind CSS + Styled Components
- **Real-time**: Supabase Realtime (WebSocket)

## Layers Architecturales

### 1. Presentation Layer (Frontend)
**Location**: `/app` + `/src/components`

**Principes**:
- Next.js App Router avec Server/Client Components
- Pages dans `/app/**/page.tsx`
- Composants réutilisables dans `/src/components/` (organisés par domaine)
- Hooks personnalisés dans `/src/hooks/` (69+ hooks)
- État global dans `/src/contexts/`

**Pattern de Routage**:
```
app/
├── (auth)/login/          # Groupe auth - pages publiques
├── dashboard/             # Dashboard principal
├── interventions/         # Gestion interventions
├── artisans/              # Gestion artisans
├── admin/                 # Admin dashboard
└── api/                   # API routes
```

### 2. API Layer (Backend)
**Location**: `/app/api/**` + `/supabase/functions/**`

**Architecture**:
- **Next.js API Routes**: Middleware mince, validation, proxy
- **Supabase Edge Functions**: Logique métier (Deno)
- **Pattern**: Next.js routes → Supabase functions (via HTTP)

**Endpoints principaux**:
- `/api/interventions` - CRUD + filtering
- `/api/artisans` - CRUD artisans
- `/api/auth/*` - Authentication
- `/api/documents` - Upload/retrieval

### 3. Data/Library Layer
**Location**: `/src/lib/api/v2/` - **Architecture Modulaire API**

**Structure**:
```
lib/api/v2/
├── common/
│   ├── types.ts          # Types TypeScript partagés
│   ├── constants.ts      # Enums, status codes
│   ├── utils.ts          # Helpers
│   └── cache.ts          # Cache manager singleton
├── interventionsApi.ts   # API Interventions
├── artisansApi.ts        # API Artisans
├── documentsApi.ts       # API Documents
├── commentsApi.ts        # API Commentaires
├── usersApi.ts           # API Users
├── rolesApi.ts           # Permissions & rôles
├── clientsApi.ts         # API Clients
├── enumsApi.ts           # Données de référence
└── index.ts              # Orchestrateur central
```

**Usage Pattern**:
```typescript
import { interventionsApi, artisansApi } from '@/lib/api/v2';
const data = await interventionsApi.getAll({ limit: 50 });
```

### 4. Database Layer
**Location**: `/supabase/migrations/` + PostgreSQL

**Principes**:
- Migrations SQL versionnées
- Row-Level Security (RLS) pour multi-tenant
- Materialized views pour optimisation
- Triggers pour timestamps automatiques
- Contraintes foreign key pour intégrité

### 5. Real-time Layer
**Location**: `/src/lib/realtime/`

**Fonctionnalités**:
- Subscriptions WebSocket via Supabase Realtime
- Invalidation automatique du cache
- Tracking présence utilisateur (HeartBeat)

## Patterns Architecturaux Clés

### Pattern 1: API Modulaire V2
**Principe**: Chaque domaine a son propre fichier API

**Exemple**:
```typescript
// src/lib/api/v2/interventionsApi.ts
export const interventionsApi = {
  getAll: async (params: QueryParams) => { /* ... */ },
  getById: async (id: string) => { /* ... */ },
  create: async (data: CreateData) => { /* ... */ },
  update: async (id: string, data: UpdateData) => { /* ... */ },
  delete: async (id: string) => { /* ... */ }
};
```

**Règles**:
- ✅ Toujours utiliser `/src/lib/api/v2/` pour les appels API
- ✅ Centraliser les types dans `common/types.ts`
- ✅ Utiliser le cache manager dans `common/cache.ts`
- ❌ Ne jamais bypasser l'orchestrateur

### Pattern 2: TanStack Query Factory
**Principe**: Factory pattern pour les query keys

**Location**: `/src/lib/react-query/queryKeys.ts`

**Exemple**:
```typescript
export const queryKeys = {
  interventions: {
    all: ['interventions'] as const,
    lists: () => [...queryKeys.interventions.all, 'list'] as const,
    list: (filters: Filters) => [...queryKeys.interventions.lists(), filters] as const,
    details: () => [...queryKeys.interventions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.interventions.details(), id] as const,
  },
};
```

**Règles**:
- ✅ Utiliser le factory pattern pour les query keys
- ✅ Invalidation ciblée du cache
- ✅ Stale-while-revalidate strategy
- ❌ Ne jamais hard-coder les query keys

### Pattern 3: Custom Hooks pour Data Fetching
**Principe**: Encapsuler TanStack Query dans des hooks métier

**Location**: `/src/hooks/`

**Exemple**:
```typescript
// src/hooks/useInterventionsQuery.ts
export function useInterventionsQuery(filters: Filters) {
  return useQuery({
    queryKey: queryKeys.interventions.list(filters),
    queryFn: () => interventionsApi.getAll(filters),
    staleTime: 30000,
  });
}
```

**Règles**:
- ✅ Un hook par type de query (read, mutate)
- ✅ Gérer loading/error states
- ✅ Typage strict des paramètres
- ❌ Ne jamais appeler directement `useQuery` dans les composants

### Pattern 4: Feature-Based Organization
**Principe**: Organiser le code par fonctionnalité métier

**Structure**:
```
src/features/
├── interventions/
│   ├── api.ts              # API calls
│   ├── components/         # Components spécifiques
│   ├── pages/              # Pages de la feature
│   └── types.ts            # Types de la feature
└── settings/
    ├── config/
    ├── components/
    └── pages/
```

**Règles**:
- ✅ Encapsuler logique métier par feature
- ✅ Éviter les dépendances circulaires
- ✅ Composants réutilisables dans `/src/components/`
- ❌ Ne pas mélanger logique de différentes features

### Pattern 5: Real-time Updates
**Principe**: Synchronisation automatique via WebSocket

**Location**: `/src/lib/realtime/cache-sync.ts`

**Flow**:
```
DB Change → Supabase Realtime → WebSocket Event
  → Cache Invalidation → Component Re-render
```

**Règles**:
- ✅ Subscribe aux tables critiques (interventions, artisans)
- ✅ Invalider le cache automatiquement
- ✅ Gérer la reconnexion
- ❌ Ne jamais over-subscribe (performance)

## Règles Architecturales Strictes

### Frontend
1. **Composants**
   - ✅ Organiser par domaine métier dans `/src/components/`
   - ✅ Utiliser Radix UI pour accessibilité
   - ✅ Styled Components pour logique CSS complexe
   - ✅ Tailwind pour styling utilitaire
   - ❌ Ne jamais dupliquer les composants UI de base

2. **État**
   - ✅ Server state → TanStack Query
   - ✅ UI state → Zustand ou useState
   - ✅ Global state → React Context
   - ✅ Form state → React Hook Form
   - ❌ Ne jamais mélanger server/client state

3. **Hooks**
   - ✅ Préfixer par `use` (convention React)
   - ✅ Placer dans `/src/hooks/`
   - ✅ Un hook par responsabilité
   - ❌ Ne jamais créer de "god hooks"

### Backend

1. **API Routes** (`/app/api`)
   - ✅ Validation des inputs (Zod)
   - ✅ Vérification des permissions
   - ✅ Gestion d'erreurs consistante
   - ✅ Logs structurés
   - ❌ Ne jamais exposer de données sensibles

2. **Edge Functions** (`/supabase/functions`)
   - ✅ Logique métier complexe
   - ✅ Transactions database
   - ✅ Appels services externes
   - ❌ Ne jamais hard-coder les credentials

3. **Database**
   - ✅ Toujours créer une migration pour les changements de schéma
   - ✅ Utiliser RLS pour la sécurité multi-tenant
   - ✅ Indexer les colonnes de filtrage fréquentes
   - ❌ Ne jamais supprimer de colonnes sans migration

### Data Layer

1. **API V2** (`/src/lib/api/v2/`)
   - ✅ Un fichier par domaine métier
   - ✅ Export via `index.ts` (orchestrateur)
   - ✅ Types partagés dans `common/types.ts`
   - ✅ Gestion d'erreurs unifiée
   - ❌ Ne jamais créer de dépendances circulaires

2. **Cache**
   - ✅ Utiliser le singleton cache manager
   - ✅ TTL approprié par type de donnée
   - ✅ Invalidation sur mutations
   - ❌ Ne jamais cacher de données utilisateur sensibles

## Data Flow Standard

### Lecture de Données (Query)
```
User Action (Component)
    ↓
Custom Hook (useInterventionsQuery)
    ↓
TanStack Query
    ↓
API V2 (interventionsApi.getAll)
    ↓
Next.js API Route (/api/interventions)
    ↓
Supabase Edge Function
    ↓
PostgreSQL Database
    ↓
Return Data
    ↓
Cache in TanStack Query
    ↓
Component Re-render
```

### Écriture de Données (Mutation)
```
User Action (Form Submit)
    ↓
Mutation Hook (useInterventionsMutations)
    ↓
TanStack Mutation
    ↓
API V2 (interventionsApi.create)
    ↓
Next.js API Route (POST /api/interventions)
    ↓
Permission Check
    ↓
Supabase Edge Function
    ↓
PostgreSQL Database
    ↓
Supabase Realtime Broadcast
    ↓
Cache Invalidation (queryClient)
    ↓
Component Re-render
```

## Checklist de Validation Architecturale

Avant d'implémenter une nouvelle feature, vérifier:

### Frontend
- [ ] Composant réutilisable dans `/src/components/` ?
- [ ] Hook personnalisé dans `/src/hooks/` ?
- [ ] Query keys dans factory pattern ?
- [ ] Gestion loading/error states ?
- [ ] Accessibilité (ARIA, keyboard) ?
- [ ] Responsive design ?
- [ ] Typage TypeScript strict ?

### Backend
- [ ] Validation inputs (Zod) ?
- [ ] Vérification permissions ?
- [ ] Gestion d'erreurs ?
- [ ] Logs structurés ?
- [ ] Tests unitaires ?
- [ ] Documentation API ?

### Database
- [ ] Migration créée ?
- [ ] RLS policies ?
- [ ] Index sur colonnes filtrées ?
- [ ] Foreign keys ?
- [ ] Triggers si nécessaire ?

### API Layer
- [ ] Fichier dans `/src/lib/api/v2/` ?
- [ ] Types dans `common/types.ts` ?
- [ ] Cache manager utilisé ?
- [ ] Export via `index.ts` ?
- [ ] Gestion d'erreurs unifiée ?

## Anti-Patterns à Éviter

### ❌ Ne JAMAIS faire

1. **Bypasser l'API V2**
   ```typescript
   // ❌ MAUVAIS
   const response = await fetch('/api/interventions');

   // ✅ BON
   const data = await interventionsApi.getAll(filters);
   ```

2. **Hardcoder les query keys**
   ```typescript
   // ❌ MAUVAIS
   useQuery({ queryKey: ['interventions', id] })

   // ✅ BON
   useQuery({ queryKey: queryKeys.interventions.detail(id) })
   ```

3. **Appeler useQuery directement dans les composants**
   ```typescript
   // ❌ MAUVAIS - Dans le composant
   const { data } = useQuery({ ... });

   // ✅ BON - Via custom hook
   const { data } = useInterventionsQuery(filters);
   ```

4. **Dupliquer la logique métier**
   ```typescript
   // ❌ MAUVAIS - Logique dupliquée
   // Component A et B ont la même logique

   // ✅ BON - Extraire dans un hook
   const useBusinessLogic = () => { /* ... */ }
   ```

5. **Modifier directement le cache**
   ```typescript
   // ❌ MAUVAIS
   queryClient.setQueryData(['interventions'], newData);

   // ✅ BON
   queryClient.invalidateQueries(queryKeys.interventions.all);
   ```

## Directives pour les Nouvelles Features

### Étape 1: Planification
1. Identifier le domaine métier (interventions, artisans, etc.)
2. Vérifier si API V2 existe pour ce domaine
3. Définir les types dans `common/types.ts`
4. Créer query keys dans factory

### Étape 2: Backend
1. Créer migration DB si nécessaire
2. Implémenter Supabase Edge Function
3. Créer Next.js API route
4. Ajouter validation et permissions

### Étape 3: Data Layer
1. Créer/étendre fichier API V2
2. Définir les méthodes (CRUD)
3. Ajouter cache management
4. Exporter via orchestrateur

### Étape 4: Frontend
1. Créer custom hooks (query + mutation)
2. Créer composants UI
3. Gérer loading/error states
4. Ajouter real-time si nécessaire
5. Tests unitaires

### Étape 5: Validation
- Tester flow complet (Create → Read → Update → Delete)
- Vérifier permissions
- Tester real-time updates
- Valider accessibilité
- Code review

## Documentation et Références

### Documentation Interne
- **API Guidelines**: `/docs/guide/backend/GUIDELINES_API_V2.md`
- **Quick Start API**: `/docs/guide/backend/QUICK_START_API_V2.md`
- **API V2 README**: `/src/lib/api/v2/README.md`

### Fichiers de Référence
- **Query Keys Factory**: `/src/lib/react-query/queryKeys.ts`
- **Cache Sync**: `/src/lib/realtime/cache-sync.ts`
- **Filter Utils**: `/src/lib/filter-converter.ts`
- **API Orchestrator**: `/src/lib/api/v2/index.ts`

### Exemples
- **Intervention Manager**: `/examples/InterventionManager.tsx`
- **Tests Dashboard**: `/tests/unit/dashboard/v3/`
- **Real-time Tests**: `/tests/unit/realtime/filter-utils.test.ts`

## Commandes Utiles

```bash
# Setup local Supabase
npm run setup

# Dev server
npm run dev

# Build production
npm run build

# Run tests
npm run test

# Reset database
npm run db:reset

# Lint & format
npm run lint
npm run format
```

## Priorités Architecturales

1. **Consistance** : Suivre les patterns établis
2. **Type Safety** : TypeScript strict partout
3. **Performance** : Cache, memoization, lazy loading
4. **Maintenabilité** : Code simple, documenté
5. **Sécurité** : RLS, permissions, validation
6. **Évolutivité** : Architecture modulaire
7. **DX** : Developer experience optimale

## Résumé des Responsabilités

- **`/app`** : Pages Next.js + API routes
- **`/src/lib/api/v2/`** : API client modulaire (source de vérité)
- **`/src/components/`** : Composants UI réutilisables
- **`/src/hooks/`** : Custom hooks React
- **`/src/features/`** : Modules par feature
- **`/supabase/functions/`** : Logique métier backend
- **`/supabase/migrations/`** : Schéma database versionné
- **`/tests/`** : Tests unitaires et intégration
