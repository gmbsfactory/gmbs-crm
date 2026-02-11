# Performance

> Stratégies et patterns d'optimisation des performances dans GMBS-CRM.

---

## Virtualisation

### @tanstack/react-virtual

Le projet utilise `@tanstack/react-virtual` (v3.13) pour le rendu virtualisé des grandes listes. Seules les lignes visibles dans le viewport sont rendues dans le DOM.

**Composants virtualisés :**

| Composant | Emplacement | Usage |
|-----------|------------|-------|
| `VirtualTable` | `src/components/virtual-components/VirtualTable.tsx` | Tableau interventions (vue table) |
| `VirtualList` | `src/components/virtual-components/VirtualList.tsx` | Listes longues (scroll infini) |
| `VirtualGrid` | `src/components/virtual-components/VirtualGrid.tsx` | Vue gallery |
| `VirtualizedDataTable` | `src/components/admin-dashboard/VirtualizedDataTable.tsx` | Tableau admin |

**Configuration type :**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 48,    // Hauteur estimée par ligne
  overscan: 5,                // Lignes en surplus hors viewport
})
```

### Gain de performance

Pour une liste de 1000 interventions :
- Sans virtualisation : ~1000 noeuds DOM rendus
- Avec virtualisation : ~30-50 noeuds DOM (viewport + overscan)

---

## Cache TanStack Query

### Configuration du cache

Le projet utilise des durées de cache adaptatives selon le type de données :

| Type de données | staleTime | gcTime | Rationale |
|----------------|-----------|--------|-----------|
| Interventions (liste) | Adaptatif | Standard | Invalidé par Realtime |
| Données de référence | 5 minutes | 15 minutes | Changent rarement |
| Dashboard stats | 30 secondes | 5 minutes | Données agrégées |
| Gestionnaires | 5 minutes | Standard | Changent rarement |
| Profil utilisateur | 5 minutes | Standard | Session-bound |

### Singleton ReferenceCacheManager

Les données de référence (statuts, agences, métiers, users) sont cachées dans un singleton côté client :

```typescript
class ReferenceCacheManager {
  private cache: ReferenceCache | null = null
  private fetchPromise: Promise<ReferenceCache> | null = null

  async get(): Promise<ReferenceCache> {
    // TTL: 5 minutes
    if (this.cache && !this.isExpired()) return this.cache

    // Protection thundering herd : réutilise la requête en vol
    if (this.fetchPromise) return this.fetchPromise

    this.fetchPromise = this.fetchData()
    return await this.fetchPromise
  }
}
```

Les données sont stockées dans des `Map<string, T>` pour des lookups O(1) par ID.

### Prefetching

Le hook `useInterventionsQuery` précharge automatiquement la page suivante :

```typescript
// Prefetch page N+1 pendant l'affichage de la page N
useEffect(() => {
  if (hasNextPage) {
    queryClient.prefetchQuery({
      queryKey: interventionKeys.list({ ...params, page: page + 1 }),
      queryFn: () => interventionsApi.getAll({ ...params, page: page + 1 }),
    })
  }
}, [page])
```

### Preloading des vues

Le hook `usePreloadDefaultViews` pré-charge les données des vues par défaut en utilisant `requestIdleCallback` :

```typescript
// Batch adaptatif : charge les vues pendant les temps morts du navigateur
requestIdleCallback(() => {
  preloadViews(defaultViews)
}, { timeout: 2000 })
```

---

## Optimisations React

### React.memo

Utilisé sur les composants enfants qui re-render fréquemment sans changement de props :

- Lignes de tableau (`ArtisanTableRow`)
- Cartes d'intervention (`InterventionCard`)
- Badges de statut

### useMemo et useCallback

Utilisés pour les calculs coûteux et les callbacks stables :

```typescript
// Calcul de marge mémorisé
const margin = useMemo(() => {
  return interventionsApi.calculateMarginForIntervention(costs)
}, [costs])

// Callback stable pour les handlers
const handleFilterChange = useCallback((filter: Filter) => {
  setFilters(prev => [...prev, filter])
}, [])
```

### Debounce

Le hook `useDebounce` est utilisé pour limiter les appels coûteux :

| Usage | Délai |
|-------|-------|
| Recherche universelle | 300ms |
| Filtres de colonnes | Variable |
| Refresh des compteurs | Variable |

---

## Optimisations réseau

### Requêtes légères (getAllLight)

L'API interventions propose une version allégée pour le warm-up :

```typescript
// Version complète : tous les champs + relations
interventionsApi.getAll(params)

// Version légère : champs essentiels uniquement (warm-up)
interventionsApi.getAllLight(params)
```

### Headers dynamiques

Le système de headers adapte automatiquement l'authentification selon le contexte (browser vs Node.js) :

```typescript
// Browser: token session utilisateur
// Node.js: service role key (bypass RLS)
// Fallback: anon key
const headers = await getHeaders()
```

### Filtre Realtime

Le channel Supabase Realtime filtre côté serveur pour réduire le trafic :

```typescript
channel.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'interventions',
  filter: 'is_active=eq.true',  // Réduit ~50% le trafic
})
```

---

## Optimisations de rendu

### Animations conditionnelles

Le composant `LowPowerModeDetector` détecte les appareils a faible puissance et désactive les animations :

```typescript
// Respecte prefers-reduced-motion
// Désactive les animations lourdes (Framer Motion, Genie Effect)
```

### Lazy loading

Les composants lourds sont chargés a la demande :

- Carte MapLibre : chargée uniquement sur les pages analytics
- Graphiques Recharts : chargés uniquement dans le dashboard
- WorkflowVisualizer : chargé uniquement dans les paramètres

### Console removal en production

Le `next.config.mjs` supprime les `console.log` en production tout en conservant `console.error` et `console.warn` :

```javascript
compiler: {
  removeConsole: process.env.NODE_ENV === 'production'
    ? { exclude: ['error', 'warn'] }
    : false,
}
```

---

## Optimisations base de données

### Index

La migration `00006_indexes_all.sql` crée des index sur toutes les colonnes fréquemment utilisées dans les WHERE et JOIN.

### Vues matérialisées

Les recherches full-text utilisent des vues matérialisées rafraîchies de manière asynchrone (migrations 00020, 00033, 00035).

### Extension pg_trgm

L'extension `pg_trgm` est activée pour les recherches ILIKE performantes sur les champs texte.

---

## Monitoring des performances

### Mesures recommandées

| Métrique | Outil | Seuil acceptable |
|----------|-------|-----------------|
| First Contentful Paint | Web Vitals | < 1.8s |
| Largest Contentful Paint | Web Vitals | < 2.5s |
| Time to Interactive | DevTools | < 3.8s |
| DOM nodes | DevTools | < 1500 |
| Re-renders par seconde | React Profiler | < 5 |

### Web Vitals

Le package `web-vitals` (v5.1) est inclus dans les dépendances pour le monitoring des Core Web Vitals.

### Bundle Analysis

```bash
# Analyse de la taille du bundle
ANALYZE=true npm run build
```

Le package `@next/bundle-analyzer` (v15.5) est disponible en dev dependencies.
