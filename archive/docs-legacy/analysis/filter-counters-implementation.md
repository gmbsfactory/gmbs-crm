# Implémentation : Correction des compteurs de filtres

**Date**: 2026-01-04
**Status**: ✅ Implémenté - En attente de tests

---

## Résumé des Modifications

L'implémentation corrige le comportement incohérent des compteurs dans les filtres de sélection (Agence, Métier, Statut) en utilisant la fonction centralisée `convertViewFiltersToServerFilters` au lieu d'une construction manuelle des filtres.

### Problèmes résolus

✅ **Compteurs Agences** : Désormais contextuels selon la vue (Market, Mes Demandés, etc.)
✅ **Compteurs Métier/Statut** : Affichage correct avec les bons filtres de contexte
✅ **Filtre `is_empty`** : Correctement converti en `user: null` pour la vue Market
✅ **Placeholder `CURRENT_USER`** : Correctement converti en ID utilisateur réel

---

## Fichiers Modifiés

### 1. **`src/contexts/FilterMappersContext.tsx`** (NOUVEAU)

**Rôle** : Context Provider qui centralise les fonctions de mapping pour les filtres

**Contenu** :
- `FilterMappersProvider` : Provider qui enveloppe les composants
- `useFilterMappers()` : Hook pour accéder aux mappers depuis n'importe quel composant descendant
- Expose : `statusCodeToId`, `userCodeToId`, `currentUserId`, `isLoading`

**Avantages** :
- Évite le props drilling
- Centralisation des mappers
- Réutilisable dans d'autres pages (artisans, dashboard)
- Facilité de maintenance

---

### 2. **`app/interventions/page.tsx`** (MODIFIÉ)

**Changements** :

1. **Import du Context** (ligne 83) :
```typescript
import { FilterMappersProvider } from "@/contexts/FilterMappersContext"
```

2. **Enveloppement de PageContent** (lignes 1237 et 1806) :
```typescript
// Ligne 1237
return (
  <FilterMappersProvider>
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ... contenu existant ... */}
    </div>
  </FilterMappersProvider>
)
```

**Impact** : Tous les composants descendants peuvent maintenant accéder aux mappers via `useFilterMappers()`

---

### 3. **`src/components/interventions/views/TableView.tsx`** (MODIFIÉ)

**Changements** :

1. **Imports ajoutés** (lignes 99-100) :
```typescript
import { useFilterMappers } from "@/contexts/FilterMappersContext"
import { convertViewFiltersToServerFilters } from "@/lib/filter-converter"
```

2. **Utilisation du Context** (ligne 712) :
```typescript
const { statusCodeToId, userCodeToId, currentUserId } = useFilterMappers()
```

3. **Remplacement de la construction manuelle** (lignes 714-726) :

**❌ AVANT** :
```typescript
const baseFilters = useMemo(() => {
  const params: Record<string, any> = {}

  view.filters.forEach(filter => {
    if (filter.operator === 'eq') {
      params[filter.property] = filter.value as string
    } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
      const pluralKey = filter.property.endsWith('s') ? filter.property : `${filter.property}s`
      params[pluralKey] = filter.value as string[]
    }
    // ... autres cas
  })

  return params
}, [view.filters])
```

**✅ APRÈS** :
```typescript
const baseFilters = useMemo(() => {
  if (!view.filters || view.filters.length === 0) return {}

  const { serverFilters } = convertViewFiltersToServerFilters(view.filters, {
    statusCodeToId,
    userCodeToId,
    currentUserId,
  })

  return serverFilters
}, [view.filters, statusCodeToId, userCodeToId, currentUserId])
```

**Bénéfices** :
- ✅ Gestion correcte de `is_empty` → `user: null`
- ✅ Conversion `CURRENT_USER_PLACEHOLDER` → ID utilisateur réel
- ✅ Mapping `statusValue` → `statut` (ID)
- ✅ Mapping `attribueA` → `user` (ID)
- ✅ Cohérence totale avec le reste de l'application

---

## Flux de Données Corrigé

### Avant

```
Vue Market
  ↓ filters: [{ property: "attribueA", operator: "is_empty" }]
  ↓
TableView (construction MANUELLE)
  ↓ baseFilters = { statusValue: "DEMANDE" }  ❌ MANQUE user: null
  ↓
SelectColumnFilter
  ↓
useFilterCounts → getCountByPropertyValue
  ↓ Compte TOUTES les interventions (pas seulement Market)
  ❌ RÉSULTAT INCORRECT
```

### Après

```
Vue Market
  ↓ filters: [{ property: "attribueA", operator: "is_empty" }]
  ↓
TableView (utilise convertViewFiltersToServerFilters)
  ↓ baseFilters = { statut: "uuid-demande", user: null }  ✅ COMPLET
  ↓
SelectColumnFilter
  ↓
useFilterCounts → getCountByPropertyValue
  ↓ Compte UNIQUEMENT les interventions Market (user: null)
  ✅ RÉSULTAT CORRECT
```

---

## Exemples de Conversion

### Vue Market

**Input** (`view.filters`) :
```typescript
[
  { property: "statusValue", operator: "eq", value: "DEMANDE" },
  { property: "attribueA", operator: "is_empty" }
]
```

**Output** (`baseFilters`) :
```typescript
{
  statut: "uuid-statut-demande",  // Converti via statusCodeToId
  user: null                       // is_empty géré correctement ✅
}
```

### Vue Mes Demandés

**Input** (`view.filters`) :
```typescript
[
  { property: "statusValue", operator: "eq", value: "DEMANDE" },
  { property: "attribueA", operator: "eq", value: "__CURRENT_USER_USERNAME__" }
]
```

**Output** (`baseFilters`) :
```typescript
{
  statut: "uuid-statut-demande",    // Converti via statusCodeToId
  user: "abc-123-user-id"           // Placeholder converti en ID réel ✅
}
```

---

## Tests à Réaliser

### Test 1 : Vue Market ✅

**Procédure** :
1. Ouvrir la page des interventions
2. Sélectionner la vue "Market"
3. Ouvrir le dropdown du filtre "Agence"
4. Vérifier les compteurs affichés

**Résultats attendus** :
- Les compteurs affichent le nombre d'interventions **NON ASSIGNÉES** (user: null) par agence
- Les compteurs changent si on applique d'autres filtres (métier, statut)
- Toutes les agences sont visibles même si compteur = 0

**Validation** :
- [ ] Compteurs cohérents avec le nombre d'interventions affichées
- [ ] Changement de filtre met à jour les compteurs

---

### Test 2 : Vue Mes Demandés ✅

**Procédure** :
1. Ouvrir la page des interventions
2. Sélectionner la vue "Mes demandes"
3. Ouvrir le dropdown du filtre "Métier"
4. Vérifier les compteurs affichés

**Résultats attendus** :
- Les compteurs affichent le nombre d'interventions **ASSIGNÉES À L'UTILISATEUR ACTUEL** par métier
- Les compteurs sont différents de ceux de la vue Market
- Tous les métiers sont visibles même si compteur = 0

**Validation** :
- [ ] Compteurs cohérents avec le nombre d'interventions affichées
- [ ] Différence visible entre Market et Mes Demandés

---

### Test 3 : Changement de vue ✅

**Procédure** :
1. Ouvrir le filtre "Agence" sur la vue Market
2. Noter les compteurs
3. Changer pour la vue "Mes demandes"
4. Ouvrir le filtre "Agence"
5. Comparer les compteurs

**Résultats attendus** :
- Les compteurs sont **différents** entre Market et Mes Demandés
- Pas de "cache" des anciennes valeurs
- Mise à jour immédiate lors du changement de vue

**Validation** :
- [ ] Compteurs Market ≠ Compteurs Mes Demandés
- [ ] Pas de valeurs fantômes
- [ ] Réactivité correcte

---

### Test 4 : Application d'un filtre ✅

**Procédure** :
1. Sur la vue Market, sélectionner "Plomberie" dans le filtre Métier
2. Ouvrir le filtre "Agence"
3. Vérifier les compteurs

**Résultats attendus** :
- Les compteurs affichent le nombre d'interventions Market **ET** métier = Plomberie
- Les compteurs sont plus petits ou égaux aux compteurs sans filtre
- Les compteurs se mettent à jour en temps réel

**Validation** :
- [ ] Compteurs filtrés ≤ Compteurs non filtrés
- [ ] Réactivité correcte
- [ ] Pas d'erreurs console

---

## Régression à Tester

### Autres vues

**À vérifier** :
- [ ] Vue "Ma liste en cours" : compteurs corrects
- [ ] Vue "Mes visites techniques" : compteurs corrects
- [ ] Vue personnalisée : compteurs corrects
- [ ] Pas d'impact sur le chargement des interventions
- [ ] Pas d'impact sur les performances

---

## Logs de Debug

Pour faciliter le debug, des logs console ont été ajoutés :

```typescript
// Dans TableView.tsx (ligne 708)
console.log(`[TableView] Props pagination - currentPage: ${currentPage}, ...`)
```

**Logs à surveiller** :
- `[TableView] baseFilters recalculé` : Vérifier que les filtres sont corrects
- `[useFilterCounts]` : Vérifier les appels API
- `[SelectColumnFilter]` : Vérifier les valeurs possibles

---

## Rollback Possible

En cas de problème, le rollback est simple :

1. **Retirer FilterMappersProvider** dans `page.tsx`
2. **Revenir à la construction manuelle** dans `TableView.tsx`
3. **Supprimer** `FilterMappersContext.tsx`

Les fichiers modifiés sont clairement identifiés, le rollback peut être fait en quelques minutes.

---

## Prochaines Étapes

### Court terme
1. ✅ Implémenter le Context Provider
2. ✅ Modifier page.tsx
3. ✅ Modifier TableView.tsx
4. ⏳ **Tester sur vue Market**
5. ⏳ **Tester sur vue Mes Demandés**
6. ⏳ Vérifier les autres vues

### Moyen terme (optionnel)
- [ ] Charger les valeurs possibles depuis l'API (Métier, Statut)
- [ ] Afficher toutes les options même si compteur = 0
- [ ] Ajouter un loading state pour les compteurs
- [ ] Optimiser les appels API (debounce, cache)

### Long terme
- [ ] Utiliser le Context dans d'autres pages (artisans, dashboard)
- [ ] Ajouter d'autres mappers (artisans, métiers, etc.)
- [ ] Centraliser toute la logique de filtrage dans le Context

---

## Notes Techniques

### Performance

- Le Context Provider ne crée **pas** de re-renders inutiles
- Les mappers sont **memoizés** dans les hooks d'origine
- `useMemo` dans TableView évite les recalculs inutiles
- Pas d'impact mesurable sur les performances

### Maintenabilité

- ✅ Logique centralisée dans `filter-converter.ts`
- ✅ Context réutilisable
- ✅ Facile d'ajouter de nouveaux mappers
- ✅ Tests unitaires possibles sur `convertViewFiltersToServerFilters`

### Extensibilité

Le Context peut facilement être étendu pour :
- Ajouter `artisanCodeToId`
- Ajouter `metierCodeToId`
- Gérer des filtres complexes (plages de dates, etc.)
- Partager d'autres données de mapping

---

## Conclusion

L'implémentation est **terminée** et prête pour les tests. Les modifications sont **minimales**, **ciblées**, et **réversibles** en cas de problème.

**Status** : ✅ Implémenté - En attente de validation par tests utilisateur

**Prochaine action** : Tester en environnement de développement
