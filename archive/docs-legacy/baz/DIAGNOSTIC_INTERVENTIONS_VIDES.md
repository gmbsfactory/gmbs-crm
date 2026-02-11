# 🔍 Diagnostic : Interventions ne s'affichent pas

**Date**: 2025-10-23  
**Problème**: Les interventions ne s'affichent plus après la migration vers l'API V2  
**Erreur initiale**: 404 sur `interventions_view`

---

## 🐛 Analyse du problème

### 1. Symptômes

- Page `/interventions` vide
- Erreurs 404 dans la console : `interventions_view` not found
- Warning : Multiple GoTrueClient instances

### 2. Corrections déjà appliquées

✅ Corrigé `interventions_view` → `interventions` dans :
- `src/lib/api/v2/interventionsApi.ts` (ligne 147)
- `src/lib/supabase-api-v2.ts` (ligne 492)

✅ Changé l'import dans `app/interventions/page.tsx` :
- De : `interventionsApiV2` (supabase-api-v2)
- Vers : `interventionsApi` (api/v2)

### 3. Problèmes potentiels restants

#### A. Type de retour incompatible

Le hook `useProgressiveLoad` attend un certain format, mais l'API V2 retourne peut-être un format différent.

```typescript
// app/interventions/page.tsx:235
const result = await interventionsApi.getAll({ limit, offset })
const data = "data" in result ? result.data : result
return data as InterventionEntity[]
```

**Question** : Est-ce que `result` a bien une propriété `data` ?

#### B. Transformation des données

La fonction `mapInterventionRecord` hydrate les données :

```typescript
// src/lib/api/v2/common/utils.ts:138
export const mapInterventionRecord = (item: any, refs: any): any => {
  // ... récupère status depuis item.status (JOIN) ou refs cache
  const statusRelationship = item.status ?? item.intervention_statuses ?? null;
  const status = statusRelationship ?? 
    (item.statut_id ? refs.interventionStatusesById?.get(item.statut_id) : undefined);
  
  return {
    ...item,
    status: normalizedStatus,
    statusLabel: normalizedStatus?.label,
    statusValue: statusCode,
    statusColor: normalizedStatus?.color,
    // ...
  }
}
```

**Question** : Est-ce que le JOIN retourne bien `item.status` ?

#### C. Cache de référence

```typescript
// src/lib/api/v2/interventionsApi.ts:125
const refs = await getReferenceCache();
const transformedData = (data || []).map((item) =>
  mapInterventionRecord(item, refs) as InterventionWithStatus
);
```

**Question** : Est-ce que `getReferenceCache()` charge bien les statuts ?

---

## 🔧 Solution proposée

### ÉTAPE 1 : Vérifier le format des données brutes

Ajoutez des logs temporaires pour déboguer :

```typescript
// app/interventions/page.tsx:234
fetchBatch: async (offset, limit) => {
  console.log('🔍 Fetching interventions...', { offset, limit });
  const result = await interventionsApi.getAll({ limit, offset });
  console.log('📦 Result structure:', {
    hasData: 'data' in result,
    dataLength: result.data?.length || 0,
    firstItem: result.data?.[0] || null
  });
  
  const data = "data" in result ? result.data : result;
  console.log('📊 Data to return:', {
    length: data.length,
    firstItem: data[0] || null,
    hasStatus: data[0]?.status || null
  });
  
  return data as InterventionEntity[];
},
```

### ÉTAPE 2 : Vérifier le cache de référence

```typescript
// src/lib/api/v2/interventionsApi.ts:125
const refs = await getReferenceCache();
console.log('🔍 Reference cache:', {
  hasInterventionStatuses: refs.interventionStatusesById?.size || 0,
  hasUsers: refs.usersById?.size || 0,
  hasAgencies: refs.agenciesById?.size || 0
});

const transformedData = (data || []).map((item) => {
  const mapped = mapInterventionRecord(item, refs);
  console.log('🔄 Mapped intervention:', {
    id: item.id,
    hasStatus: !!mapped.status,
    statusLabel: mapped.status?.label || 'N/A'
  });
  return mapped as InterventionWithStatus;
});
```

### ÉTAPE 3 : Vérifier le JOIN SQL

Testez directement dans Supabase SQL Editor :

```sql
SELECT 
  i.*,
  s.id as status_id,
  s.code as status_code,
  s.label as status_label,
  s.color as status_color
FROM interventions i
LEFT JOIN intervention_statuses s ON s.id = i.statut_id
LIMIT 5;
```

**Vérifiez** :
- Est-ce que la colonne `statut_id` existe ?
- Est-ce que le JOIN retourne des données de statut ?
- Combien d'interventions ont un `statut_id` non null ?

### ÉTAPE 4 : Vérifier la foreign key

```sql
-- Vérifier la foreign key
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'interventions'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'statut_id';
```

**Note** : Le JOIN utilise `interventions_statut_id_fkey` comme nom de FK. Vérifiez que c'est le bon nom.

---

## 🎯 Script de correction complet

### Fichier : `src/lib/api/v2/interventionsApi.ts`

Remplacez la méthode `getAll()` par cette version avec logs :

```typescript
async getAll(params?: InterventionQueryParams): Promise<PaginatedResponse<InterventionWithStatus>> {
  console.log('🚀 interventionsApi.getAll called with params:', params);
  
  // Version ultra-rapide : requête simple sans joins complexes
  let query = supabase
    .from("interventions")
    .select(
      `
        *,
        status:intervention_statuses!statut_id (
          id,
          code,
          label,
          color,
          sort_order
        )
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  // Appliquer les filtres
  if (params?.statut) {
    query = query.eq("statut_id", params.statut);
  }
  if (params?.agence) {
    query = query.eq("agence_id", params.agence);
  }
  if (params?.user) {
    query = query.eq("assigned_user_id", params.user);
  }

  // Pagination
  const limit = params?.limit || 100;
  const offset = params?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  console.log('📊 Query result:', {
    dataLength: data?.length || 0,
    error: error?.message || null,
    count,
    firstItem: data?.[0] || null,
    firstItemHasStatus: data?.[0]?.status || null
  });

  if (error) {
    console.error('❌ Error fetching interventions:', error);
    throw error;
  }

  // Si pas de données jointes, c'est un problème de FK
  if (data && data.length > 0 && !data[0].status) {
    console.warn('⚠️ WARNING: JOIN did not return status data. Check foreign key name.');
  }

  const refs = await getReferenceCache();
  console.log('🗂️ Reference cache loaded:', {
    interventionStatuses: refs.interventionStatusesById?.size || 0,
    users: refs.usersById?.size || 0
  });

  const transformedData = (data || []).map((item) => {
    const mapped = mapInterventionRecord(item, refs);
    return mapped as InterventionWithStatus;
  });

  console.log('✅ Transformed data:', {
    length: transformedData.length,
    firstItemHasStatus: transformedData[0]?.status || null
  });

  return {
    data: transformedData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    },
  };
},
```

---

## 🔍 Test manuel dans la console du navigateur

Ouvrez la console et testez :

```javascript
// Test 1 : Import l'API
const { interventionsApi } = await import('/src/lib/api/v2/index.ts');

// Test 2 : Charger les interventions
const result = await interventionsApi.getAll({ limit: 5, offset: 0 });
console.log('Result:', result);

// Test 3 : Vérifier la structure
console.log('First intervention:', result.data[0]);
console.log('Has status?', result.data[0]?.status);
console.log('Status label:', result.data[0]?.status?.label);
```

---

## 🎯 Causes probables (par ordre de probabilité)

### 1. **Nom de foreign key incorrect** (80%)

Le JOIN utilise : `intervention_statuses!statut_id`

Mais la vraie FK s'appelle peut-être : `interventions_statut_id_fkey`

**Fix** :
```typescript
// Option A : Utiliser le nom exact de la FK
status:intervention_statuses!interventions_statut_id_fkey (...)

// Option B : Utiliser la colonne directement
status:intervention_statuses(statut_id) (...)
```

### 2. **Pas de statut_id sur les interventions** (15%)

84% des interventions n'ont pas de statut_id (diagnostiqué précédemment).

**Fix** : Créer le script de migration SQL pour assigner un statut par défaut.

### 3. **Type incompatible** (5%)

Le type `InterventionEntity` attendu n'est pas compatible avec `InterventionWithStatus`.

**Fix** : Aligner les types.

---

## 🚀 Action immédiate

### 1. Vérifier le nom de la FK

```sql
-- Dans Supabase SQL Editor
SELECT 
  constraint_name, 
  table_name, 
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'interventions'
  AND column_name = 'statut_id';
```

### 2. Corriger le JOIN si nécessaire

Si la FK s'appelle différemment, remplacez dans `interventionsApi.ts` :

```typescript
// De :
status:intervention_statuses!statut_id (...)

// Vers (adaptez selon le résultat de la requête) :
status:intervention_statuses!interventions_statut_id_fkey (...)
```

### 3. Test rapide sans JOIN

Pour isoler le problème, testez temporairement SANS JOIN :

```typescript
async getAll(params?: InterventionQueryParams) {
  let query = supabase
    .from("interventions")
    .select("*", { count: "exact" })  // ⚠️ Sans JOIN temporairement
    .order("created_at", { ascending: false });
  
  // ... reste du code
}
```

Si ça fonctionne → le problème vient du JOIN  
Si ça ne fonctionne pas → le problème est ailleurs

---

## 📋 Checklist de debug

- [ ] Vérifier que la table `interventions` existe
- [ ] Vérifier que la colonne `statut_id` existe
- [ ] Vérifier le nom exact de la foreign key
- [ ] Tester le SELECT sans JOIN
- [ ] Tester le SELECT avec JOIN dans SQL Editor
- [ ] Vérifier les logs dans la console
- [ ] Vérifier le cache de référence
- [ ] Vérifier que `getTotalCount()` retourne > 0

---

**Priorité** : Vérifier le nom de la FK et corriger le JOIN en conséquence.




