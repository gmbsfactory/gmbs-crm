# Optimisations Préchargement et Réduction des Requêtes - 2025

**Date** : 2025-01-XX  
**Statut** : ✅ Implémenté

---

## 🎯 Problèmes Résolus

### 1. Préchargements Multiples
**Problème** : Les préchargements TanStack partaient trois fois :
- Pendant le login (`app/(auth)/login/page.tsx`)
- Dès que Supabase signale `SIGNED_IN` (`AuthStateListenerProvider.tsx`)
- À chaque rendu de la page interventions (`usePreloadDefaultViews`)

**Solution** : Flag global `hasPreloadedRef` dans `src/lib/preload-flag.ts`
- `preloadCriticalData` vérifie le flag avant de précharger
- `usePreloadDefaultViews` se désactive si le préchargement global a déjà été fait
- Flag réinitialisé lors de la déconnexion

### 2. Dépendances Instables dans `usePreloadInterventions`
**Problème** : L'objet `options` était recréé à chaque rendu, déclenchant des re-exécutions infinies.

**Solution** : Mémorisation des dépendances réelles avec `useMemo`
```typescript
const stableOptions = useMemo(() => ({
  statusCodeToId,
  userCodeToId,
  currentUserId,
}), [statusCodeToId, userCodeToId, currentUserId])
```

### 3. Préchargements Sans Limite de Concurrence
**Problème** : `preloadCriticalData` lançait toutes les requêtes en parallèle sans `await`.

**Solution** : Traitement par batch avec limitation
- Batch de 2 requêtes parallèles maximum
- Délai de 300ms entre chaque batch
- Utilisation de `await` pour sérialiser les batches

### 4. Duplication de `useCurrentUser`
**Problème** : `usePreloadDefaultViews` réimplémentait la logique de `useCurrentUser`.

**Solution** : Utilisation directe de `useCurrentUser()` pour mutualiser la requête `["currentUser"]`.

### 5. Compteurs Déclenchés Avant Résolution des Mappers
**Problème** : Les comptages partaient avant que `statusCodeToId`/`userCodeToId` soient résolus, causant des `count(*)` globaux très lourds.

**Solution** : Vérification réelle de la disponibilité des maps
```typescript
const mappersReady = useMemo(() => {
  return {
    statusMapReady: !statusMapLoading && Object.keys(statusMap).length > 0,
    userMapReady: !userMapLoading && Object.keys(userMap).length > 0,
    currentUserIdReady: currentUserId !== undefined,
  }
}, [statusMapLoading, statusMap, userMapLoading, userMap, currentUserId])
```

### 6. Duplication de Logique de Conversion de Filtres
**Problème** : `convertFiltersToApiParams` dupliquait la logique de `convertViewFiltersToServerFilters`.

**Solution** : Réutilisation directe de `convertViewFiltersToServerFilters` pour garantir la cohérence.

### 7. Préchargement Manquant Après Refresh
**Problème** : `AuthStateListenerProvider` ignorait `INITIAL_SESSION`, donc après un refresh seul `usePreloadDefaultViews` tournait (pas de préchargement artisans/dashboard).

**Solution** : Gestion de `INITIAL_SESSION` avec la même logique que `SIGNED_IN`.

---

## 📊 Résultats Attendus

### Réduction des Requêtes
- **Avant** : ~18 requêtes (3×6 vues) au chargement
- **Après** : 6 requêtes maximum (une seule fois)

### Amélioration de la Performance
- Pas de doublons grâce au flag global
- Limitation de concurrence (2 requêtes parallèles max)
- Compteurs précis (attendent que les mappers soient prêts)
- Préchargement complet même après refresh

### Réduction des Erreurs 503/500
- Batch processing avec délais entre batches
- Retry avec backoff exponentiel pour les erreurs temporaires
- Debouncing des comptages (500ms)

---

## 🔧 Configuration Ajustable

Les paramètres suivants peuvent être ajustés selon la charge réelle en production :

### `src/lib/preload-critical-data.ts`
```typescript
const batchSize = 2 // Limiter à 2 requêtes parallèles
const batchDelay = 300 // Délai entre les batches (ms)
```

### `src/hooks/usePreloadInterventions.ts`
```typescript
const batchSize = 2 // Limiter à 2 requêtes parallèles
const batchDelay = 800 // Délai entre les batches (ms)
```

### `app/interventions/page.tsx`
```typescript
// Debounce des comptages
const timeoutId = setTimeout(async () => { ... }, 500)

// Limitation de concurrence pour les comptages
const counts = await loadCountsInBatches(views, 2) // 2 requêtes parallèles

// Retry avec backoff exponentiel
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000)
```

---

## ⚠️ Points à Surveiller

### 1. `queryClient.clear()` lors de SIGNED_OUT
**Impact** : Vide complètement le cache TanStack Query pour éviter qu'un second utilisateur hérite des données du premier.

**Vérification** : Les autres caches (NavigationContext, SimpleOptimizedContext, useReferenceData) utilisent des Maps en mémoire, donc ils ne sont pas affectés. ✅

### 2. Centralisation des Mappers
**État actuel** : Les pages artisans/interventions utilisent leurs propres hooks (`useInterventionStatusMap`, `useUserMap`).

**Recommandation** : Si centralisation future, exposer un état `loading/ready` similaire pour éviter les requêtes prématurées.

### 3. Monitoring Production
**Métriques à suivre** :
- Taux d'erreurs 503/500
- Temps de réponse moyen des requêtes
- Nombre de requêtes par session

**Ajustements possibles** :
- Augmenter `batchDelay` si trop de 503
- Réduire `batchSize` à 1 si nécessaire
- Ajuster le debounce des comptages

---

## 📝 Fichiers Modifiés

- `src/lib/preload-flag.ts` (nouveau)
- `src/lib/preload-critical-data.ts`
- `src/hooks/usePreloadInterventions.ts`
- `src/hooks/usePreloadDefaultViews.ts`
- `src/providers/AuthStateListenerProvider.tsx`
- `app/interventions/page.tsx`
- `src/hooks/useInterventionsQuery.ts`

---

## ✅ Checklist de Validation

- [x] Flag global empêche les préchargements multiples
- [x] Dépendances stabilisées dans `usePreloadInterventions`
- [x] Limitation de concurrence dans `preloadCriticalData`
- [x] Mutualisation de `useCurrentUser`
- [x] Compteurs attendent que les mappers soient prêts
- [x] Réutilisation de `convertViewFiltersToServerFilters`
- [x] Gestion de `INITIAL_SESSION` pour le refresh
- [x] Retry avec backoff exponentiel pour les erreurs 503/500
- [x] Debouncing et limitation de concurrence pour les comptages

---

## 🚀 Prochaines Étapes

1. **Monitoring Production** : Suivre la baisse des erreurs 503/500
2. **Ajustements** : Modifier `batchSize`/`batchDelay` si nécessaire selon la charge réelle
3. **Optimisation Artisans** : Appliquer les mêmes optimisations à `app/artisans/page.tsx` si nécessaire










