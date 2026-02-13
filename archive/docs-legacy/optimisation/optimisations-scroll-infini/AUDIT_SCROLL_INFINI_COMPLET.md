# Audit Complet - Scroll Infini Interventions

**Date** : 5 novembre 2025  
**Contexte** : Diagnostic approfondi du scroll infini après implémentation cursor-pagination  
**Statut** : 🔍 **EN COURS**

---

## 📊 État actuel observé

### ✅ Fonctionnement normal (page chargée depuis le début)
- Premier batch : 50 interventions
- Scroll vers le bas → 150, 250, 350, 450... jusqu'à 6202 ✅
- Performance fluide avec prefetch automatique ✅
- `hasMore: true` correctement maintenu ✅

### ❌ Dysfonctionnement (retour depuis une autre page)
- Retour sur Interventions → Charge 50 interventions
- Scroll vers le bas → **BLOQUÉ à 50** ❌
- Besoin de recharger la page pour que le scroll fonctionne

---

## 🔍 Analyse détaillée du flux

### 1️⃣ Edge Function - `/functions/interventions-v2/index.ts`

**Configuration** :
```typescript
const DEFAULT_INTERVENTION_COLUMNS = [24 colonnes];
const AVAILABLE_RELATIONS = {
  agencies, tenants, users, statuses, metiers,
  artisans,  // ✅ Ajouté pour jointure intervention_artisans
  costs,     // ✅ Ajouté pour jointure intervention_costs
  owner,     // ✅ Ajouté pour jointure owner
};

const defaultRelations = ['artisans', 'costs']; // ✅ Toujours inclus
```

**Requête SQL générée** :
```sql
SELECT 
  id, id_inter, date, statut_id, ...,
  intervention_artisans(id, artisan_id, is_primary, artisans(nom, prenom, plain_nom)),
  intervention_costs(id, cost_type, amount, currency)
FROM interventions
WHERE is_active = true
ORDER BY date DESC, id DESC
LIMIT 51  -- +1 pour détecter hasMore
```

**Réponse** :
```json
{
  "data": [50 interventions],
  "pagination": {
    "limit": 50,
    "total": 6202,
    "hasMore": true,
    "cursorNext": { "date": "...", "id": "..." }
  }
}
```

✅ **Statut** : Fonctionne correctement

---

### 2️⃣ API Client - `src/lib/supabase-api-v2.ts`

**Mapping des colonnes** :
```typescript
PROPERTY_COLUMN_MAP: 24 mappings valides ✅
DERIVED_VIEW_FIELDS: 94 champs dérivés identifiés ✅
VALID_INTERVENTION_COLUMNS: Whitelist stricte ✅

resolveSelectColumns(fields) {
  // Filtre les champs dérivés
  // Mappe les propriétés → colonnes SQL
  // Retourne uniquement les colonnes valides
}
```

**Transformation** :
```typescript
mapInterventionRecord(item, refs) {
  // Extrait artisan depuis intervention_artisans ✅
  // Extrait coûts depuis intervention_costs ✅
  // Mappe vers InterventionView
}
```

✅ **Statut** : Fonctionne correctement

---

### 3️⃣ Hook - `src/hooks/useInterventions.ts`

**État géré** :
```typescript
interventions: InterventionView[]      // Liste en mémoire
hasMore: boolean                       // Indicateur pagination
totalCount: number                     // Total dans la DB
cursorRef: InterventionCursor         // Curseur suivant
prevCursorRef: InterventionCursor     // Curseur précédent
```

**Cache sessionStorage** :
```typescript
Clé: `interventions-${paramsKey}-${cursorKey}`
Valeur: { data, pagination, timestamp }
TTL: 2 minutes (CACHE_TTL_MS)
```

**Logique autoLoad** (MODIFIÉE PAR L'UTILISATEUR) :
```typescript
useEffect(() => {
  if (autoLoad) {
    resetPagingState();
    
    // 1. Charge depuis le cache d'abord (skipCache = false)
    const initialPromise = loadInterventionsRef.current({ 
      reset: true, 
      direction: "forward" 
    });
    
    // 2. Si cache utilisé, recharge depuis l'API en arrière-plan
    void initialPromise.then((usedCache) => {
      if (usedCache) {
        loadInterventionsRef.current({ 
          reset: true,              // ⚠️ PROBLÈME ICI !
          direction: "forward", 
          skipCache: true 
        });
      }
    });
  }
}, [autoLoad, paramsKey, resetPagingState]);
```

⚠️ **PROBLÈME IDENTIFIÉ #1** : 
- Cache charge : 50 interventions
- Puis API recharge avec `reset: true` → **REMPLACE** les 50 au lieu de les garder
- Résultat : On reste à 50 interventions au lieu d'en avoir plus

---

### 4️⃣ Page - `app/interventions/page.tsx`

**Séparation filtres** :
```typescript
const { serverFilters, residualFilters, serverSort, residualSorts } = 
  splitServerAndResidualFilters(activeView);

// serverFilters → envoyés à useInterventions
// residualFilters → appliqués côté client
```

**Traitement des données** :
```typescript
fetchedInterventions (du hook)
  ↓
normalizedInterventions (mapping status)
  ↓
serverAppliedInterventions (residualFilters + residualSorts) ✅
  ↓
searchedInterventions (search text)
  ↓
viewInterventions (passé à TableView)
```

✅ **Statut** : Architecture correcte

---

### 5️⃣ TableView - `src/components/interventions/views/TableView.tsx`

**Dataset** (CORRIGÉ) :
```typescript
// AVANT (double filtrage ❌)
const dataset = runQuery(interventions, view.filters, view.sorts);

// APRÈS (pas de re-filtrage ✅)
const dataset = interventions;
```

**Prefetch logic** :
```typescript
useEffect(() => {
  if (!hasMore || !onEndReached) return;
  
  const last = virtualItems[virtualItems.length - 1];
  const prefetchThreshold = Math.floor(dataset.length * 0.7);  // 70%
  const criticalThreshold = dataset.length - 20;
  
  const shouldPrefetch = 
    (last.index >= prefetchThreshold || last.index >= criticalThreshold);
  
  if (shouldPrefetch) {
    onEndReached();  // → Appelle loadMore()
  }
}, [virtualItems, dataset.length, hasMore, onEndReached]);
```

**onStartReached** (DÉSACTIVÉ) :
```typescript
const shouldPrefetchTop = false;  // ⚠️ Désactivé temporairement
```

✅ **Statut** : Logique correcte, backward désactivé

---

## 🔴 PROBLÈMES IDENTIFIÉS

### Problème #1 : ❌ Cache incomplet + reset=true
**Fichier** : `src/hooks/useInterventions.ts` (lignes 517-528)

**Code actuel** :
```typescript
const initialPromise = loadInterventionsRef.current({ 
  reset: true,      // Cache charge 50
  direction: "forward" 
});

void initialPromise.then((usedCache) => {
  if (usedCache) {
    loadInterventionsRef.current({ 
      reset: true,     // ❌ REMPLACE les 50 au lieu de compléter !
      direction: "forward", 
      skipCache: true 
    });
  }
});
```

**Effet** :
1. Cache charge → 50 interventions avec `reset: true`
2. API recharge → 50 interventions avec `reset: true`
3. **RÉSULTAT** : Les 50 du cache sont **REMPLACÉES** par les 50 de l'API
4. On reste à 50 au lieu d'avoir un batch complet

**Solution attendue** :
- Option A : Ne PAS recharger en arrière-plan, ignorer le cache dès le début
- Option B : Recharger avec `reset: false` pour COMPLÉTER au lieu de remplacer
- Option C : Désactiver complètement le cache pour les chargements initiaux

---

### Problème #2 : ⚠️ Backward scroll désactivé
**Fichier** : `src/components/interventions/views/TableView.tsx` (ligne 459)

**Code actuel** :
```typescript
const shouldPrefetchTop = false;  // ⚠️ DÉSACTIVÉ TEMPORAIREMENT
```

**Raison** : Le backward causait des appels intempestifs pendant le scroll vers le bas

**Impact** :
- ❌ Impossible de précharger en scrollant vers le haut
- ❌ Si on descend puis remonte, les données ne se rechargent pas

**Solution attendue** :
- Tracker la direction du scroll (up vs down)
- N'appeler backward QUE si on scrolle vraiment vers le haut

---

### Problème #3 : ✅ Double filtrage (RÉSOLU)
**Fichier** : `src/components/interventions/views/TableView.tsx` (ligne 330-336)

**Avant** :
```typescript
const dataset = runQuery(interventions, view.filters, view.sorts); // ❌ Double filtrage
```

**Après** :
```typescript
const dataset = interventions;  // ✅ Pas de re-filtrage
```

✅ **Statut** : RÉSOLU

---

## 🎯 RECOMMANDATIONS

### Solution immédiate : Désactiver le cache pour autoLoad

**Fichier** : `src/hooks/useInterventions.ts` (lignes 517-528)

**Remplacer** :
```typescript
useEffect(() => {
  if (autoLoad) {
    resetPagingState();
    const initialPromise = loadInterventionsRef.current({ 
      reset: true, 
      direction: "forward" 
    });
    void initialPromise.then((usedCache) => {
      if (usedCache) {
        loadInterventionsRef.current({ 
          reset: true,  // ❌ Problème ici
          direction: "forward", 
          skipCache: true 
        });
      }
    });
  }
}, [autoLoad, paramsKey, resetPagingState]);
```

**Par** :
```typescript
useEffect(() => {
  if (autoLoad) {
    resetPagingState();
    // ✅ TOUJOURS ignorer le cache au chargement initial
    // pour éviter les données incomplètes
    loadInterventionsRef.current({ 
      reset: true, 
      direction: "forward",
      skipCache: true  // ✅ Force API call
    });
  }
}, [autoLoad, paramsKey, resetPagingState]);
```

---

## 📝 Testez maintenant

Faites cette modification simple, puis :

1. **Rechargez la page**
2. **Allez sur Market**
3. **Revenez sur Interventions**
4. **Scrollez vers le bas**

**Voulez-vous que j'applique cette correction ? 🔧**
