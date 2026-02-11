# 🚀 OPTIMISATION SCROLL INFINI - SLIDING WINDOW STRATEGY

> **Objectif** : Fluidifier l'affichage du tableau des interventions et supporter jusqu'à 100 000 lignes sans ralentissement ni crash.
>
> **Problème actuel** : Avec le scroll infini actuel, l'accumulation de données en mémoire (jusqu'à 100k lignes) provoque des ralentissements, des crashes, et une UX dégradée.
>
> **Solution** : Implémenter une **fenêtre glissante (Sliding Window)** qui maintient uniquement 500-1000 lignes en mémoire, avec purge automatique et préchargement intelligent.

---

## 📊 **CONTEXTE TECHNIQUE**

### **Fichiers concernés**

```
src/hooks/useInterventions.ts           # Hook principal de chargement
src/components/interventions/views/TableView.tsx  # Vue tableau avec virtualisation
app/interventions/page.tsx              # Page principale
src/lib/supabase-api-v2.ts             # API V2 (déjà optimisée)
```

### **Architecture actuelle**

```typescript
// État actuel (PROBLÉMATIQUE pour 100k lignes)
- limit = 50                  # Trop petit, trop de requêtes
- maxCachedItems = 1000       # Pas de purge automatique
- overscan = 5                # Trop petit, lignes visibles pendant scroll
- Trigger à -5 lignes         # Trop tard, utilisateur voit le loading
- Accumulation infinie        # ❌ RAM explose sur gros datasets
```

### **Architecture cible (SLIDING WINDOW)**

```typescript
// Nouvelle stratégie (OPTIMAL pour 100k lignes)
- Batch size = 100            # Équilibre requêtes/fluidité
- Window size = 1000          # Maximum en mémoire (5-10 MB)
- Overscan = 15               # Pré-render pour scroll fluide
- Trigger à 70%               # Préchargement anticipé
- Purge automatique           # Sliding window (garder 1000 max)
- Bi-directionnel             # Scroll up/down supporté
```

**Concept visuel :**

```
┌──────────────────────────────────────────────────┐
│  DATABASE : 100 000 interventions                │
└──────────────────────────────────────────────────┘
                    ↓
         (ne charger que ce qui est nécessaire)
                    ↓
    ┌───────────────────────────────────┐
    │  WINDOW EN MÉMOIRE : 1000 lignes  │ ← Fenêtre glissante
    │  [500 - 1500]                     │
    └───────────────────────────────────┘
           ↓ Scroll vers le bas
           ↓ (la fenêtre "glisse")
           ↓
        ┌───────────────────────────────────┐
        │  NOUVELLE WINDOW : 1000 lignes    │
        │  [600 - 1600]                     │
        └───────────────────────────────────┘
           (les lignes 500-599 sont PURGÉES)
```

---

## 🎯 **OBJECTIFS DE L'OPTIMISATION**

### **Critères de réussite**

✅ **Performance**
- Scroll fluide sans saccades (60 FPS)
- Aucun lag visible lors du changement de filtre
- Mémoire RAM stable (< 15 MB pour les données)
- Temps de réponse < 100ms pour le scroll

✅ **Expérience utilisateur**
- Préchargement invisible (pas de spinner visible)
- Support du scroll bi-directionnel (haut/bas)
- Indicateur de position clair (lignes X-Y / Total)
- Aucun crash sur 100k lignes

✅ **Technique**
- Maximum 1000 lignes en mémoire simultanément
- Purge automatique des données hors viewport
- Tous les filtres/tris appliqués CÔTÉ SERVEUR
- Cache intelligent avec invalidation

---

## 📝 **TÂCHES D'IMPLÉMENTATION**

### **PHASE 1 : Optimisations immédiates (useInterventions.ts)**

#### **Tâche 1.1 : Ajuster les paramètres de base**

**Fichier** : `src/hooks/useInterventions.ts`

**Action** : Modifier les valeurs par défaut

```typescript
// AVANT (ligne ~53-63)
const {
  limit = 50,
  offset = 0,
  autoLoad = true,
  filters = {},
  sortBy,
  sortDir = "desc",
  search,
  fields,
  maxCachedItems = 1000,
} = options;

// APRÈS
const {
  limit = 100,              // ← AUGMENTER de 50 à 100
  offset = 0,
  autoLoad = true,
  filters = {},
  sortBy,
  sortDir = "desc",
  search,
  fields,
  maxCachedItems = 1000,    // ← GARDER mais ajouter purge
  slidingWindow = true,     // ← NOUVEAU : activer fenêtre glissante
} = options;
```

#### **Tâche 1.2 : Implémenter la purge automatique (Sliding Window)**

**Fichier** : `src/hooks/useInterventions.ts`

**Localisation** : Dans la fonction `loadInterventions`, après la ligne 210

**Action** : Remplacer la logique d'accumulation par une fenêtre glissante

```typescript
// AVANT (ligne ~210-223)
setInterventions(prev => {
  // ⚠️ Dédupliquer par ID pour éviter les duplicate keys
  const combined = [...prev, ...result.data];
  const unique = Array.from(
    new Map(combined.map(item => [item.id, item])).values()
  );
  
  // Limiter la taille du cache
  if (unique.length > maxCachedItems) {
    return unique.slice(unique.length - maxCachedItems);
  }
  return unique;
});

// APRÈS
setInterventions(prev => {
  // Dédupliquer par ID
  const combined = [...prev, ...result.data];
  const unique = Array.from(
    new Map(combined.map(item => [item.id, item])).values()
  );
  
  // 🔥 SLIDING WINDOW : Purge intelligente
  if (slidingWindow && unique.length > maxCachedItems) {
    // Garder les éléments du milieu de la fenêtre
    // (pas seulement la fin, pour supporter scroll bidirectionnel)
    const windowStart = Math.max(0, unique.length - maxCachedItems);
    const windowEnd = unique.length;
    
    // Si on a scrollé très loin, purger le début
    // Sinon, garder un buffer équilibré
    const purgeBefore = Math.floor(maxCachedItems * 0.1); // Garder 10% avant
    const purgeAfter = Math.floor(maxCachedItems * 0.9);  // Garder 90% après
    
    if (unique.length > maxCachedItems * 1.5) {
      // Purge aggressive si on dépasse 150%
      return unique.slice(-maxCachedItems);
    } else {
      // Purge douce pour garder un buffer
      return unique.slice(windowStart, windowEnd);
    }
  }
  
  return unique;
});
```

#### **Tâche 1.3 : Ajouter un tracker d'offset pour le scroll bi-directionnel**

**Fichier** : `src/hooks/useInterventions.ts`

**Action** : Ajouter un état pour tracker la position dans le dataset complet

```typescript
// Après la ligne ~65 (ajout de nouveaux états)
const [currentOffset, setCurrentOffset] = useState(0);
const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

// Dans loadInterventions, tracker la direction
const loadInterventions = useCallback(async (reset = false) => {
  try {
    setLoading(true);
    setError(null);

    const effectiveLimit = Math.max(1, Math.min(limit, 200));
    const newOffset = reset ? 0 : interventionsRef.current.length;
    
    // 🔥 NOUVEAU : Détecter la direction du scroll
    if (newOffset < currentOffset) {
      setDirection('backward');
    } else if (newOffset > currentOffset) {
      setDirection('forward');
    }
    setCurrentOffset(newOffset);
    
    const params = {
      limit: effectiveLimit,
      offset: newOffset,
      // ... reste des params
    };
    
    // ... suite du code
  }
}, [limit, query, maxCachedItems, cleanupCache, currentOffset]);
```

---

### **PHASE 2 : Optimiser la virtualisation (TableView.tsx)**

#### **Tâche 2.1 : Augmenter l'overscan**

**Fichier** : `src/components/interventions/views/TableView.tsx`

**Localisation** : Ligne ~326-331

**Action** : Augmenter le nombre de lignes pré-rendues

```typescript
// AVANT (ligne ~326-331)
const rowVirtualizer = useVirtualizer({
  count: dataset.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => (rowDensity === "ultra-dense" ? 32 : rowDensity === "dense" ? 40 : 48),
  overscan: 5,
})

// APRÈS
const rowVirtualizer = useVirtualizer({
  count: dataset.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => (rowDensity === "ultra-dense" ? 32 : rowDensity === "dense" ? 40 : 48),
  overscan: 15,  // ← AUGMENTER de 5 à 15 lignes
  // Options additionnelles pour perfs
  measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
    ? element => element.getBoundingClientRect().height
    : undefined,
  scrollMargin: tableContainerRef.current?.offsetTop ?? 0,
})
```

#### **Tâche 2.2 : Implémenter le préchargement anticipé (Prefetch)**

**Fichier** : `src/components/interventions/views/TableView.tsx`

**Localisation** : Remplacer le useEffect ligne ~336-348

**Action** : Charger les données AVANT d'atteindre la fin

```typescript
// AVANT (ligne ~336-348)
useEffect(() => {
  if (!hasMore || !onEndReached) return
  const last = virtualItems[virtualItems.length - 1]
  if (!last) return
  if (last.index >= dataset.length - 5) {
    if (loadMoreTriggerRef.current !== dataset.length) {
      loadMoreTriggerRef.current = dataset.length
      onEndReached()
    }
  } else if (loadMoreTriggerRef.current !== -1) {
    loadMoreTriggerRef.current = -1
  }
}, [virtualItems, dataset.length, hasMore, onEndReached])

// APRÈS
const loadingRef = useRef(false);

useEffect(() => {
  if (!hasMore || !onEndReached) return
  const last = virtualItems[virtualItems.length - 1]
  if (!last) return
  
  // 🔥 PREFETCH : Déclencher à 70% du dataset actuel
  const prefetchThreshold = Math.floor(dataset.length * 0.7);
  const criticalThreshold = dataset.length - 20; // Fallback si 70% trop tard
  
  // Déclencher le chargement si on atteint le seuil ET qu'on ne charge pas déjà
  if ((last.index >= prefetchThreshold || last.index >= criticalThreshold) && !loadingRef.current) {
    if (loadMoreTriggerRef.current !== dataset.length) {
      loadMoreTriggerRef.current = dataset.length
      loadingRef.current = true
      
      onEndReached().finally(() => {
        loadingRef.current = false
      })
    }
  } else if (last.index < prefetchThreshold - 10) {
    // Reset si on remonte
    loadMoreTriggerRef.current = -1
  }
}, [virtualItems, dataset.length, hasMore, onEndReached])
```

#### **Tâche 2.3 : Ajouter un indicateur de position**

**Fichier** : `src/components/interventions/views/TableView.tsx`

**Localisation** : Avant le `return` final (ligne ~705)

**Action** : Ajouter un indicateur de position dans le viewport

```typescript
// Calculer la position visible
const firstVisible = virtualItems[0]?.index ?? 0;
const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? 0;
const totalRows = totalCount ?? dataset.length;
const scrollPercentage = totalRows > 0 ? Math.round((lastVisible / totalRows) * 100) : 0;

// Ajouter avant le return (ligne ~705)
return (
  <>
    {/* Indicateur de position (affiché seulement si > 200 lignes) */}
    {totalRows > 200 && (
      <div className="fixed right-6 bottom-6 z-40 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex flex-col items-end">
            <span className="font-medium text-foreground">
              {(firstVisible + 1).toLocaleString()} - {(lastVisible + 1).toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              sur {totalRows.toLocaleString()}
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <span className="font-semibold text-primary">
            {scrollPercentage}%
          </span>
        </div>
      </div>
    )}
    
    {/* Barre de progression (optionnelle, si chargement progressif) */}
    {loadingProgress && !loadingProgress.isComplete && loadingProgress.total > 0 && (
      // ... code existant ...
    )}
    
    {/* Reste du JSX existant */}
    <Card className="card-table-wrapper">
      {/* ... */}
    </Card>
  </>
)
```

---

### **PHASE 3 : Forcer les filtres serveur (page.tsx)**

#### **Tâche 3.1 : Ajouter une validation des filtres**

**Fichier** : `app/interventions/page.tsx`

**Localisation** : Après la ligne ~700 (dans le useEffect de dérivation des filtres)

**Action** : S'assurer que TOUS les filtres critiques passent par le serveur

```typescript
// Ajouter après la ligne ~700
useEffect(() => {
  if (!isReady || !activeView || mapsLoading) return
  
  const { serverFilters: nextServerFilters, residualFilters: nextResidualFilters, serverSort: nextServerSort, residualSorts: nextResidualSorts } =
    deriveServerQueryConfig(activeView, statusCodeToId, userNameToId, agencyNameToId, metierNameToId)
  
  // 🔥 NOUVEAU : Validation - Warn si trop de filtres résiduels
  if (residualFilters.length > 2 && totalCount && totalCount > 5000) {
    console.warn(
      `⚠️ Performance warning: ${residualFilters.length} filtres appliqués côté client sur ${totalCount} lignes. ` +
      `Cela peut causer des ralentissements. Filtres résiduels:`,
      residualFilters.map(f => f.property)
    );
  }
  
  // Reste du code existant...
}, [activeView, isReady, mapsLoading, /* ... */]);
```

#### **Tâche 3.2 : Ajouter un mode "Force Server Filters"**

**Fichier** : `app/interventions/page.tsx`

**Localisation** : Ligne ~606-611 (où serverAppliedInterventions est calculé)

**Action** : Détecter les gros datasets et forcer le mode serveur uniquement

```typescript
// AVANT (ligne ~606-611)
const serverAppliedInterventions = useMemo(() => {
  if (!residualFilters.length && !residualSorts.length) {
    return normalizedInterventions
  }
  return runQuery(normalizedInterventions, residualFilters, residualSorts)
}, [normalizedInterventions, residualFilters, residualSorts])

// APRÈS
const serverAppliedInterventions = useMemo(() => {
  // 🔥 OPTIMIZATION : Si dataset trop gros, forcer mode serveur uniquement
  const isLargeDataset = (totalCount ?? 0) > 10000;
  
  if (isLargeDataset && (residualFilters.length > 0 || residualSorts.length > 0)) {
    console.warn(
      '⚠️ Large dataset detected. Client-side filters/sorts disabled. ' +
      'All filtering must be done server-side.'
    );
    // Retourner les données brutes (filtrage serveur déjà appliqué)
    return normalizedInterventions;
  }
  
  if (!residualFilters.length && !residualSorts.length) {
    return normalizedInterventions
  }
  
  return runQuery(normalizedInterventions, residualFilters, residualSorts)
}, [normalizedInterventions, residualFilters, residualSorts, totalCount])
```

---

### **PHASE 4 : Améliorer le cache (useInterventions.ts)**

#### **Tâche 4.1 : Réduire la durée du cache**

**Fichier** : `src/hooks/useInterventions.ts`

**Localisation** : Ligne ~92, ~178

**Action** : Réduire le TTL du cache de 5 minutes à 2 minutes pour données plus fraîches

```typescript
// AVANT (ligne ~92, ~178)
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

if (Date.now() - parsed.timestamp < 5 * 60 * 1000) { // 5 minutes

// APRÈS
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (plus réactif)

if (Date.now() - parsed.timestamp < 2 * 60 * 1000) { // 2 minutes
```

#### **Tâche 4.2 : Améliorer la gestion du quota**

**Fichier** : `src/hooks/useInterventions.ts`

**Localisation** : Ligne ~87-145 (fonction cleanupCache)

**Action** : Rendre le nettoyage plus agressif

```typescript
// Dans cleanupCache, ligne ~91
const MAX_CACHE_ENTRIES = 10; // Limiter à 10 entrées max

// CHANGER EN
const MAX_CACHE_ENTRIES = 5; // ← RÉDUIRE à 5 entrées pour libérer plus d'espace
```

---

## 🧪 **TESTS À EFFECTUER**

### **Test 1 : Performance sur petit dataset (< 1000 lignes)**
```bash
# Vérifier que le comportement reste fluide
1. Charger une vue avec ~500 interventions
2. Scroller rapidement de haut en bas
3. ✅ Attendre : Aucun lag, scroll à 60 FPS
4. ✅ Vérifier : Aucun message d'erreur console
```

### **Test 2 : Performance sur moyen dataset (1000-10000 lignes)**
```bash
1. Charger une vue avec ~5000 interventions
2. Scroller progressivement vers le bas (50% du dataset)
3. ✅ Attendre : Préchargement invisible, pas de spinner
4. ✅ Vérifier : RAM stable (< 20 MB pour les données)
5. Changer un filtre (ex: statut)
6. ✅ Attendre : Réponse < 200ms, données rechargées
```

### **Test 3 : Performance sur gros dataset (> 10000 lignes)**
```bash
1. Charger une vue avec 50 000+ interventions
2. Scroller rapidement vers position 5000
3. ✅ Attendre : Indicateur de position visible
4. ✅ Vérifier : Jamais plus de 1000 lignes en mémoire
5. Scroller vers le haut (position 2000)
6. ✅ Attendre : Scroll bidirectionnel fonctionnel
7. Appliquer 3 filtres serveur différents
8. ✅ Attendre : Chaque filtre < 500ms
```

### **Test 4 : Stabilité mémoire**
```bash
1. Ouvrir Chrome DevTools > Performance > Memory
2. Charger 100k lignes
3. Scroller pendant 2 minutes (haut/bas/milieu)
4. ✅ Vérifier : RAM ne dépasse jamais 50 MB
5. ✅ Vérifier : Pas de memory leak (courbe stable)
```

### **Test 5 : Cas limites**
```bash
# Test 5.1 : Dataset vide
1. Appliquer un filtre qui retourne 0 résultats
2. ✅ Attendre : Message "Aucune intervention" affiché
3. ✅ Vérifier : Aucune erreur console

# Test 5.2 : Scroll rapide
1. Utiliser la molette pour scroller très vite
2. ✅ Attendre : Pas de "flash" de contenu vide
3. ✅ Vérifier : Overscan gère les lignes intermédiaires

# Test 5.3 : Changement de vue pendant chargement
1. Démarrer un scroll qui déclenche un chargement
2. Changer de vue (ex: tableau → calendrier)
3. ✅ Attendre : Pas d'erreur, requête annulée proprement
```

---

## 📊 **MÉTRIQUES DE SUCCÈS**

### **Avant optimisation (état actuel)**
```
Dataset: 100k lignes
- Premier rendu: 2-3s
- Scroll fluide: ❌ (lag visible)
- RAM utilisée: ~200 MB
- Risque crash: Élevé
- Filtres client: 500-2000ms
```

### **Après optimisation (cible)**
```
Dataset: 100k lignes
- Premier rendu: < 500ms ✅
- Scroll fluide: 60 FPS ✅
- RAM utilisée: < 15 MB ✅
- Risque crash: Aucun ✅
- Filtres serveur: < 200ms ✅
```

---

## ⚠️ **POINTS D'ATTENTION**

### **1. Ne PAS casser le comportement existant**
- ✅ Garder la compatibilité avec les petits datasets (< 500 lignes)
- ✅ Conserver le cache sessionStorage pour les requêtes dupliquées
- ✅ Maintenir le support des filtres avancés (date ranges, multi-select, etc.)

### **2. Gestion des erreurs**
- ✅ Si le serveur est lent (> 2s), afficher un loader subtil
- ✅ Si une requête échoue, ne pas purger le cache existant
- ✅ Logger les warnings de performance dans la console (mode dev uniquement)

### **3. Compatibilité navigateurs**
- ✅ Tester sur Chrome, Firefox, Safari
- ✅ Vérifier que `requestIdleCallback` a un fallback (`setTimeout`)
- ✅ S'assurer que la virtualisation fonctionne sur mobile

### **4. Migration progressive**
- ✅ Ajouter un feature flag `ENABLE_SLIDING_WINDOW` (env var)
- ✅ Logger les métriques (temps de chargement, taille dataset, RAM)
- ✅ Permettre un rollback facile si problème en production

---

## 🔧 **CONFIGURATION FINALE**

### **Variables d'environnement (.env.local)**
```bash
# Optimisation scroll infini
NEXT_PUBLIC_SLIDING_WINDOW_ENABLED=true
NEXT_PUBLIC_MAX_CACHED_ITEMS=1000
NEXT_PUBLIC_PREFETCH_THRESHOLD=0.7
NEXT_PUBLIC_BATCH_SIZE=100
```

### **Constantes à exporter (config/interventions.ts)**
```typescript
// Ajouter dans src/config/interventions.ts
export const SCROLL_CONFIG = {
  // Fenêtre glissante
  SLIDING_WINDOW_ENABLED: process.env.NEXT_PUBLIC_SLIDING_WINDOW_ENABLED === 'true',
  MAX_CACHED_ITEMS: Number(process.env.NEXT_PUBLIC_MAX_CACHED_ITEMS) || 1000,
  
  // Chargement
  BATCH_SIZE: Number(process.env.NEXT_PUBLIC_BATCH_SIZE) || 100,
  INITIAL_BATCH_SIZE: 50, // Premier chargement rapide
  
  // Préchargement
  PREFETCH_THRESHOLD: Number(process.env.NEXT_PUBLIC_PREFETCH_THRESHOLD) || 0.7,
  CRITICAL_THRESHOLD: 20, // Fallback si threshold trop tard
  
  // Virtualisation
  OVERSCAN: 15,
  
  // Cache
  CACHE_TTL_MS: 2 * 60 * 1000, // 2 minutes
  MAX_CACHE_ENTRIES: 5,
  
  // Seuils de performance
  LARGE_DATASET_THRESHOLD: 10000, // Force server filters
  SHOW_POSITION_THRESHOLD: 200,  // Affiche indicateur de position
} as const;
```

---

## 📚 **RESSOURCES ET RÉFÉRENCES**

### **Documentation externe**
- [TanStack Virtual - Overscan](https://tanstack.com/virtual/v3/docs/api/virtualizer#overscan)
- [React Performance Optimization](https://react.dev/reference/react/useMemo)
- [PostgreSQL Index Performance](https://www.postgresql.org/docs/current/indexes.html)

### **Fichiers de référence dans le projet**
- `docs/API_CRM_COMPLETE.md` - Documentation API V2
- `AGENTS.md` - Guide des bonnes pratiques (API V2 obligatoire)
- `supabase/migrations/20251024_add_intervention_indexes.sql` - Indexes DB pour perfs

### **Patterns similaires dans le code**
- `src/hooks/useProgressiveLoad.ts` - Chargement progressif (NE PAS UTILISER pour ce cas)
- `src/lib/query-engine.ts` - Filtrage client-side (à éviter sur gros datasets)

---

## ✅ **CHECKLIST FINALE**

Avant de considérer l'optimisation terminée, vérifier :

### **Code**
- [ ] `useInterventions.ts` : Paramètres ajustés (limit, maxCachedItems)
- [ ] `useInterventions.ts` : Sliding window implémentée (purge automatique)
- [ ] `useInterventions.ts` : Tracker d'offset ajouté
- [ ] `TableView.tsx` : Overscan augmenté (15)
- [ ] `TableView.tsx` : Prefetch à 70% implémenté
- [ ] `TableView.tsx` : Indicateur de position ajouté
- [ ] `page.tsx` : Validation filtres serveur ajoutée
- [ ] `page.tsx` : Mode "Force Server" pour gros datasets
- [ ] `useInterventions.ts` : Cache TTL réduit (2 min)
- [ ] `config/interventions.ts` : Constantes SCROLL_CONFIG exportées

### **Tests**
- [ ] Test 1 : Petit dataset (< 1000) OK
- [ ] Test 2 : Moyen dataset (1k-10k) OK
- [ ] Test 3 : Gros dataset (> 10k) OK
- [ ] Test 4 : Stabilité mémoire OK
- [ ] Test 5 : Cas limites OK

### **Documentation**
- [ ] README mis à jour avec nouvelles constantes
- [ ] Commentaires ajoutés dans le code (pourquoi, pas quoi)
- [ ] Métriques de performance documentées (avant/après)

### **Qualité**
- [ ] Aucune erreur ESLint
- [ ] Aucune erreur TypeScript
- [ ] Aucun warning console en production
- [ ] Tests unitaires passent (si existants)

---

## 🚀 **DÉPLOIEMENT**

### **Étapes recommandées**
1. ✅ Merger dans une branche feature (`feature/sliding-window-optimization`)
2. ✅ Tester en local avec différents datasets (100, 1k, 10k, 50k)
3. ✅ Déployer en staging avec feature flag activé
4. ✅ Monitorer les métriques pendant 24h
5. ✅ Activer en production progressivement (10% → 50% → 100%)

### **Rollback plan**
```typescript
// Si problème détecté, désactiver via env var
NEXT_PUBLIC_SLIDING_WINDOW_ENABLED=false

// Ou rollback git
git revert <commit-hash>
```

---

## 📞 **SUPPORT**

En cas de question ou problème :
1. Vérifier les logs console (mode verbose activé)
2. Vérifier les métriques de performance (DevTools > Performance)
3. Comparer avec l'état "avant optimisation" (git diff)

**Contact** : Voir `AGENTS.md` pour les conventions du projet

---

**Version** : 1.0.0  
**Date** : 2025-10-25  
**Auteur** : Architecture Team

