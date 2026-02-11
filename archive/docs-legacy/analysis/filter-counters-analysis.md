# Analyse du comportement des compteurs dans les filtres de sélection

**Date**: 2026-01-04
**Auteur**: Analyse technique

---

## Résumé Exécutif

Les compteurs des filtres (Agence, Métier, Statut) dans les vues d'interventions présentent des comportements incohérents dus à une **désynchronisation entre les filtres de la vue et les filtres passés au hook `useFilterCounts`**.

### Problèmes identifiés

1. **Compteurs Agences identiques** : Les compteurs ne tiennent pas compte du filtre `user` (Market/Mes Demandés)
2. **Compteurs Métier/Statut invisibles** : Pas de valeurs possibles car extraction depuis les interventions locales filtrées

### Cause racine

Le composant `TableView` construit manuellement `baseFilters` depuis `view.filters` (lignes 710-731) **sans utiliser la fonction centralisée `convertViewFiltersToServerFilters`**, ce qui entraîne :
- Perte du filtre `user` (is_empty ou eq CURRENT_USER)
- Mauvaise conversion des filtres complexes
- Incohérence avec le reste de l'application

---

## 1. Architecture Actuelle

### 1.1 Flux de données pour les compteurs

```
Vue (Market/Mes Demandés)
  ↓ view.filters (incluant attribueA avec is_empty ou eq CURRENT_USER)
  ↓
TableView (lignes 710-731)
  ↓ Construction MANUELLE de baseFilters (PROBLÈME ICI)
  ↓ Conversion simpliste qui IGNORE les opérateurs is_empty
  ↓
SelectColumnFilter
  ↓ Extraction des possibleValues depuis interventions LOCALES
  ↓
useFilterCounts(filterPropertyType, possibleValues, baseFilters)
  ↓
interventionsApi.getCountByPropertyValue(property, value, baseFilters INCOMPLET)
```

### 1.2 Code problématique dans TableView.tsx (lignes 710-731)

```typescript
const baseFilters = useMemo(() => {
  const params: Record<string, any> = {}

  view.filters.forEach(filter => {
    // Ignorer les filtres temporaires ou système
    if (!filter.property) return

    if (filter.operator === 'eq') {
      params[filter.property] = filter.value as string  // ❌ Ne gère pas CURRENT_USER_PLACEHOLDER
    } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
      const pluralKey = filter.property.endsWith('s') ? filter.property : `${filter.property}s`
      params[pluralKey] = filter.value as string[]
    } else if (filter.operator === 'gte' && filter.property === 'date') {
      params.startDate = filter.value as string
    } else if (filter.operator === 'lte' && filter.property === 'date') {
      params.endDate = filter.value as string
    }
    // ❌ MANQUE : gestion de l'opérateur 'is_empty' pour Market (user === null)
  })

  return params
}, [view.filters])
```

**Problèmes** :
- ❌ L'opérateur `is_empty` n'est PAS géré → le filtre `user: null` pour Market n'est jamais ajouté
- ❌ Le placeholder `CURRENT_USER_PLACEHOLDER` n'est PAS converti en ID réel
- ❌ Pas de mapping statusValue → statut_id
- ❌ Pas de mapping attribueA → user_id

---

## 2. Définition des Vues Market et Mes Demandés

### 2.1 Vue Market (src/hooks/useInterventionViews.ts:319-325)

```typescript
{
  id: "market",
  filters: [
    { property: "statusValue", operator: "eq", value: "DEMANDE" },
    { property: "attribueA", operator: "is_empty" },  // ← user === null
  ],
  // ...
}
```

**Filtre attendu pour l'API** : `{ statut: "DEMANDE_ID", user: null }`

**Filtre réel construit par TableView** : `{ statusValue: "DEMANDE" }` ❌

### 2.2 Vue Mes Demandés (src/hooks/useInterventionViews.ts:362-368)

```typescript
{
  id: "mes-demandes",
  filters: [
    { property: "statusValue", operator: "eq", value: "DEMANDE" },
    { property: "attribueA", operator: "eq", value: "__CURRENT_USER_USERNAME__" },
  ],
  // ...
}
```

**Filtre attendu pour l'API** : `{ statut: "DEMANDE_ID", user: "abc-123-user-id" }`

**Filtre réel construit par TableView** : `{ statusValue: "DEMANDE", attribueA: "__CURRENT_USER_USERNAME__" }` ❌

---

## 3. Conversion des Filtres : Comparaison

### 3.1 Fonction centralisée (CORRECTE)

`src/lib/filter-converter.ts:19-182` - `convertViewFiltersToServerFilters()`

**Gère correctement** :
- ✅ Opérateur `is_empty` → `user: null`
- ✅ Placeholder `CURRENT_USER` → ID utilisateur réel
- ✅ Mapping `statusValue` → `statut` (avec conversion code → ID)
- ✅ Mapping `attribueA` → `user` (avec conversion code → ID)
- ✅ Mapping `metier` → `metier` (ID direct)
- ✅ Mapping `agence` → `agence` (ID direct)

**Exemple pour Market** :
```typescript
Input:  [
  { property: "statusValue", operator: "eq", value: "DEMANDE" },
  { property: "attribueA", operator: "is_empty" }
]

Output: {
  serverFilters: {
    statut: "uuid-statut-demande",  // Converti via statusCodeToId()
    user: null                       // is_empty géré ✅
  },
  clientFilters: []
}
```

### 3.2 Construction manuelle dans TableView (INCORRECTE)

**Ne gère PAS** :
- ❌ Opérateur `is_empty` (ignoré silencieusement)
- ❌ Placeholder `CURRENT_USER` (gardé tel quel)
- ❌ Mapping `statusValue` → `statut`
- ❌ Mapping `attribueA` → `user`

**Exemple pour Market** :
```typescript
Input:  [
  { property: "statusValue", operator: "eq", value: "DEMANDE" },
  { property: "attribueA", operator: "is_empty" }
]

Output: {
  statusValue: "DEMANDE"  // ❌ Pas de conversion
  // ❌ MANQUE : user: null
}
```

---

## 4. Impact sur les Compteurs

### 4.1 Problème 1 : Compteurs Agences toujours identiques

**Flux actuel** :
1. `SelectColumnFilter` charge `allAgencies` depuis l'API (toutes les agences)
2. `possibleValues` = toutes les agences (lignes 174-177)
3. `useFilterCounts` appelle `getCountByPropertyValue` avec `baseFilters` **INCOMPLET**
4. L'API compte TOUTES les interventions de chaque agence (sans filtre `user`)

**Résultat** : Les compteurs sont identiques pour Market, Mes Demandés, et toutes les vues

### 4.2 Problème 2 : Compteurs Métier/Statut invisibles

**Flux actuel** :
1. `SelectColumnFilter` extrait `possibleValues` depuis `interventions` (lignes 179-206)
2. Si `interventions` est vide (aucune intervention chargée pour Market/Mes Demandés)
3. Alors `possibleValues` = `[]` (liste vide)
4. `useFilterCounts` ne charge aucun compteur (car `possibleValues.length === 0`)

**Résultat** : Aucun compteur affiché pour Métier et Statut

---

## 5. Pourquoi les `interventions` sont vides/filtrées

Les interventions passées à `SelectColumnFilter` proviennent de la requête principale qui utilise **la fonction centralisée `convertViewFiltersToServerFilters`** (voir `app/interventions/page.tsx:356`).

Donc :
- L'API retourne correctement les interventions filtrées (Market = user null, Mes Demandés = user actuel)
- **Mais** : `baseFilters` passé à `SelectColumnFilter` n'inclut PAS ces filtres
- **Donc** : Les compteurs sont calculés sur TOUTES les interventions, pas seulement celles de la vue

**Exemple concret** :
- Vue Market charge 50 interventions non assignées ✅
- `baseFilters` passé à SelectColumnFilter = `{ statusValue: "DEMANDE" }` (sans user: null) ❌
- `getCountByPropertyValue("metier", "PLOMBERIE", baseFilters)` compte TOUTES les DEMANDES (assignées + non assignées)

---

## 6. Solutions Proposées

### Solution 1 : Utiliser `convertViewFiltersToServerFilters` dans TableView ✅ RECOMMANDÉE

**Avantages** :
- ✅ Cohérence totale avec le reste de l'application
- ✅ Gestion centralisée de la logique de conversion
- ✅ Support de tous les opérateurs (`is_empty`, `in`, `eq`, etc.)
- ✅ Conversion automatique des placeholders et codes en IDs

**Code à modifier** dans `TableView.tsx` (lignes 709-731) :

```typescript
// ❌ AVANT (lignes 710-731)
const baseFilters = useMemo(() => {
  const params: Record<string, any> = {}
  view.filters.forEach(filter => {
    // Conversion manuelle simpliste
  })
  return params
}, [view.filters])

// ✅ APRÈS
const baseFilters = useMemo(() => {
  if (!view.filters || view.filters.length === 0) return {}

  // Utiliser la fonction centralisée avec le contexte de conversion
  const { serverFilters } = convertViewFiltersToServerFilters(view.filters, {
    statusCodeToId: (code) => {
      // Utiliser le hook useInterventionStatusMap pour obtenir l'ID
      // À implémenter : récupérer depuis le contexte ou props
    },
    userCodeToId: (code) => {
      // Utiliser le hook useUserMap pour obtenir l'ID
      // À implémenter : récupérer depuis le contexte ou props
    },
    currentUserId: currentUserData?.id
  })

  return serverFilters
}, [view.filters, currentUserData?.id])
```

**Problème** : Besoin d'accéder aux fonctions de mapping `statusCodeToId` et `userCodeToId`

**Solutions pour accéder aux mappers** :
1. **Option A** : Passer via props depuis `page.tsx` (qui a déjà accès)
2. **Option B** : Utiliser un Context Provider pour partager les mappers
3. **Option C** : Dupliquer les hooks dans TableView (moins optimal)

---

### Solution 2 : Charger toutes les valeurs possibles depuis l'API

**Avantages** :
- ✅ Affichage de toutes les options même si 0 résultat
- ✅ Pas de dépendance aux interventions locales

**Inconvénients** :
- ❌ Requêtes API supplémentaires
- ❌ Ne résout pas le problème des `baseFilters` incomplets

**Code à ajouter** dans `SelectColumnFilter.tsx` :

```typescript
// Pour Métier : charger depuis l'API
useEffect(() => {
  if (filterPropertyType === 'metier') {
    metiersApi.getAll().then(metiers => {
      setPossibleValues(metiers.map(m => ({ id: m.id, label: m.label })))
    })
  }
}, [filterPropertyType])

// Idem pour Statut
```

**Note** : Cette solution est **partielle** car elle ne résout pas le problème des `baseFilters` incomplets.

---

## 7. Plan d'Implémentation Recommandé

### Étape 1 : Préparer le terrain
1. Créer un Context Provider pour partager `statusCodeToId` et `userCodeToId`
2. Modifier `page.tsx` pour envelopper les composants avec ce Context

### Étape 2 : Modifier TableView
1. Consommer le Context pour accéder aux fonctions de mapping
2. Remplacer la construction manuelle de `baseFilters` par `convertViewFiltersToServerFilters`
3. Tester les vues Market et Mes Demandés

### Étape 3 : Améliorer SelectColumnFilter (optionnel)
1. Charger les valeurs possibles depuis l'API pour Métier/Statut
2. Afficher toutes les options même si compteur = 0
3. Tester la performance avec beaucoup d'options

### Étape 4 : Tests
1. Vérifier que les compteurs sont corrects pour Market (user null)
2. Vérifier que les compteurs sont corrects pour Mes Demandés (user actuel)
3. Vérifier que les compteurs sont corrects pour les autres vues

---

## 8. Code Exemple : Implémentation Complète

### 8.1 Créer le Context pour les mappers

**Fichier** : `src/contexts/FilterMappersContext.tsx`

```typescript
import React, { createContext, useContext, ReactNode } from 'react'
import { useInterventionStatusMap } from '@/hooks/useInterventionStatusMap'
import { useUserMap } from '@/hooks/useUserMap'
import { useCurrentUser } from '@/hooks/useCurrentUser'

interface FilterMappersContextType {
  statusCodeToId: (code: string | string[]) => string | string[] | undefined
  userCodeToId: (code: string | string[]) => string | string[] | undefined
  currentUserId: string | undefined
}

const FilterMappersContext = createContext<FilterMappersContextType | null>(null)

export function FilterMappersProvider({ children }: { children: ReactNode }) {
  const { data: currentUserData } = useCurrentUser()
  const { statusCodeToId } = useInterventionStatusMap()
  const { userCodeToId } = useUserMap()

  return (
    <FilterMappersContext.Provider
      value={{
        statusCodeToId,
        userCodeToId,
        currentUserId: currentUserData?.id
      }}
    >
      {children}
    </FilterMappersContext.Provider>
  )
}

export function useFilterMappers() {
  const context = useContext(FilterMappersContext)
  if (!context) {
    throw new Error('useFilterMappers must be used within FilterMappersProvider')
  }
  return context
}
```

### 8.2 Modifier page.tsx

**Fichier** : `app/interventions/page.tsx`

```typescript
import { FilterMappersProvider } from '@/contexts/FilterMappersContext'

export default function InterventionsPage() {
  // ... code existant

  return (
    <FilterMappersProvider>
      {/* ... composants existants */}
      <TableView
        view={activeView}
        interventions={displayedInterventions}
        // ... props existants
      />
    </FilterMappersProvider>
  )
}
```

### 8.3 Modifier TableView.tsx

**Fichier** : `src/components/interventions/views/TableView.tsx`

```typescript
import { useFilterMappers } from '@/contexts/FilterMappersContext'
import { convertViewFiltersToServerFilters } from '@/lib/filter-converter'

export function TableView({ view, interventions, ... }: TableViewProps) {
  const { statusCodeToId, userCodeToId, currentUserId } = useFilterMappers()

  // ✅ Construction correcte de baseFilters
  const baseFilters = useMemo(() => {
    if (!view.filters || view.filters.length === 0) return {}

    const { serverFilters } = convertViewFiltersToServerFilters(view.filters, {
      statusCodeToId,
      userCodeToId,
      currentUserId
    })

    return serverFilters
  }, [view.filters, statusCodeToId, userCodeToId, currentUserId])

  // ... reste du code
}
```

---

## 9. Tests de Validation

### Test 1 : Vue Market
**Scénario** : Ouvrir la vue Market

**Résultats attendus** :
- ✅ Compteurs Agences affichent le nombre d'interventions NON ASSIGNÉES (user: null)
- ✅ Compteurs Métiers affichent le nombre d'interventions NON ASSIGNÉES (user: null)
- ✅ Compteurs Statuts affichent le nombre d'interventions NON ASSIGNÉES (user: null)

### Test 2 : Vue Mes Demandés
**Scénario** : Ouvrir la vue Mes Demandés

**Résultats attendus** :
- ✅ Compteurs Agences affichent le nombre d'interventions ASSIGNÉES À L'UTILISATEUR ACTUEL
- ✅ Compteurs Métiers affichent le nombre d'interventions ASSIGNÉES À L'UTILISATEUR ACTUEL
- ✅ Compteurs Statuts affichent le nombre d'interventions ASSIGNÉES À L'UTILISATEUR ACTUEL

### Test 3 : Changement de vue
**Scénario** : Passer de Market à Mes Demandés

**Résultats attendus** :
- ✅ Les compteurs se mettent à jour pour refléter les filtres de la nouvelle vue
- ✅ Pas de valeurs "fantômes" des filtres précédents

---

## 10. Conclusion

La problématique des compteurs incohérents est causée par une **construction manuelle et incomplète des `baseFilters` dans TableView**, qui ne tire pas parti de la fonction centralisée `convertViewFiltersToServerFilters`.

**Action immédiate recommandée** :
1. Créer un Context Provider pour partager les fonctions de mapping
2. Modifier TableView pour utiliser `convertViewFiltersToServerFilters`
3. Valider avec les tests ci-dessus

**Bénéfices attendus** :
- ✅ Compteurs cohérents dans toutes les vues
- ✅ Support correct des filtres complexes (is_empty, placeholders, etc.)
- ✅ Maintenabilité améliorée (logique centralisée)
- ✅ Pas de régression sur les autres vues

---

## Annexes

### A1. Références de Code

- **Fonction centralisée** : `src/lib/filter-converter.ts:19-182`
- **Construction manuelle** : `src/components/interventions/views/TableView.tsx:710-731`
- **Vues Market/Mes Demandés** : `src/hooks/useInterventionViews.ts:319-397`
- **Hook compteurs** : `src/hooks/useFilterCounts.ts`
- **API compteurs** : `src/lib/api/v2/interventionsApi.ts:4042-4075`

### A2. Schéma de l'Architecture Corrigée

```
page.tsx
  ↓ Fournit FilterMappersProvider (statusCodeToId, userCodeToId, currentUserId)
  ↓
TableView
  ↓ Consomme useFilterMappers()
  ↓ Appelle convertViewFiltersToServerFilters(view.filters, mappers)
  ↓ baseFilters = serverFilters (CORRECT avec user: null ou user: UUID)
  ↓
SelectColumnFilter
  ↓ Reçoit baseFilters COMPLET
  ↓ Charge possibleValues (depuis API ou interventions)
  ↓
useFilterCounts(filterPropertyType, possibleValues, baseFilters COMPLET)
  ↓
interventionsApi.getCountByPropertyValue(property, value, baseFilters COMPLET)
  ↓
Compteurs CORRECTS par vue ✅
```
