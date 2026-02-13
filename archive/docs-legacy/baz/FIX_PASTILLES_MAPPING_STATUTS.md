# 🔧 Fix des Pastilles - Correction du Mapping de Statuts

**Date** : 2025-10-24  
**Statut** : ✅ Résolu  
**Version** : 1.0.1

---

## 🐛 Problème Identifié

Les pastilles des vues d'interventions affichaient des valeurs **incorrectes** :

**Pour Andréa** :
- ❌ "En cours" : **868** (affiché dans CRM)
- ✅ "Inter en cours" : **34** (vraie valeur en BDD)

### Analyse

Le problème venait d'un **désalignement entre les codes frontend et les codes BDD** :

| Code Frontend | Code BDD | Match? |
|---------------|----------|--------|
| `EN_COURS` | `INTER_EN_COURS` | ❌ |
| `TERMINE` | `INTER_TERMINEE` | ❌ |

**Conséquence** : Quand une vue filtrait par `"EN_COURS"`, le code n'existait pas en BDD, donc **aucun filtre n'était appliqué** et la requête retournait TOUTES les interventions (868) au lieu de seulement celles avec le statut "INTER_EN_COURS" (34).

---

## 🔍 Distribution Réelle en BDD (Andrea)

| Statut | Code BDD | Nombre |
|--------|----------|--------|
| Demandé | `DEMANDE` | **100** |
| Accepté | `ACCEPTE` | **23** |
| **Inter en cours** | **`INTER_EN_COURS`** | **34** ⭐ |
| Inter terminée | `INTER_TERMINEE` | 188 |
| Devis Envoyé | `DEVIS_ENVOYE` | 332 |
| Stand by | `STAND_BY` | 104 |
| Annulé | `ANNULE` | 41 |
| Visite Technique | `VISITE_TECHNIQUE` | 24 |
| Refusé | `REFUSE` | 11 |
| SAV | `SAV` | 9 |
| Att Acompte | `ATT_ACOMPTE` | 2 |
| **TOTAL** | | **868** |

---

## ✅ Solution Implémentée

### 1. Ajout d'Alias dans le Hook de Mapping

**Fichier** : `src/hooks/useInterventionStatusMap.ts`

Ajout de mappings **bidirectionnels** pour résoudre les codes legacy (frontend) vers les codes BDD :

```typescript
// Ajouter des alias pour les codes legacy (frontend) → codes BDD
// Permet de résoudre "EN_COURS" → UUID de "INTER_EN_COURS"
const interEnCoursId = map["INTER_EN_COURS"]
const interTermineeId = map["INTER_TERMINEE"]

if (interEnCoursId) {
  map["EN_COURS"] = interEnCoursId
}
if (interTermineeId) {
  map["TERMINE"] = interTermineeId
}
```

**Résultat** :
- ✅ `"EN_COURS"` → UUID de `"INTER_EN_COURS"`
- ✅ `"TERMINE"` → UUID de `"INTER_TERMINEE"`
- ✅ Les deux codes pointent vers le même UUID

### 2. Conservation des Codes Frontend

On garde les codes frontend existants (`"EN_COURS"`, `"TERMINE"`) pour **éviter de casser tout le code existant** qui utilise ces codes dans :
- Formulaires
- Validations
- Règles de workflow
- Composants UI
- ~30 fichiers du projet

### 3. Mapping Bidirectionnel

Le système de mapping existant dans `src/lib/interventions/mappers.ts` reste en place :
- **Frontend → BDD** : `STATUS_TO_DB` (pour les écritures)
- **BDD → Frontend** : `STATUS_FROM_DB_NORMALIZED` (pour les lectures)

---

## 🧪 Tests de Validation

### Test 1 : Vérification du Mapping

```bash
$ node scripts/tests/test-status-mapping-fixed.js

✅ EN_COURS et INTER_EN_COURS pointent vers le même UUID
✅ TERMINE et INTER_TERMINEE pointent vers le même UUID
```

### Test 2 : Comptage Réel en BDD

```bash
$ node scripts/tests/test-andrea-counts.js

📊 Distribution réelle pour Andrea :
   - Demandé              [DEMANDE]           : 100
   - Accepté              [ACCEPTE]           : 23
   - Inter en cours       [INTER_EN_COURS]    : 34  ⭐
   - Inter terminée       [INTER_TERMINEE]    : 188
   ...
   TOTAL: 868
```

### Test 3 : Comptage avec Alias

```bash
Comptage avec "EN_COURS" (UUID: dd618d57...) : 34
Comptage avec "INTER_EN_COURS" (UUID: dd618d57...) : 34

✅ SUCCÈS : Les deux codes retournent le même comptage !
```

---

## 📊 Résultat Final

### Avant
| Vue | CRM Affiché | BDD Réelle | Match? |
|-----|-------------|------------|--------|
| Demandé | 100 | 100 | ✅ |
| **En cours** | **868** | **34** | **❌** |
| Accepté | 23 | 23 | ✅ |

### Après
| Vue | CRM Affiché | BDD Réelle | Match? |
|-----|-------------|------------|--------|
| Demandé | 100 | 100 | ✅ |
| **En cours** | **34** | **34** | **✅** |
| Accepté | 23 | 23 | ✅ |

---

## 📁 Fichiers Modifiés

### 1. `src/hooks/useInterventionStatusMap.ts`
- ✅ Ajout des alias `EN_COURS` et `TERMINE`
- ✅ Mapping bidirectionnel codes frontend ↔ codes BDD

### 2. Scripts de Test Créés
- `scripts/tests/test-andrea-counts.js` - Vérification des compteurs réels
- `scripts/tests/list-status-codes.js` - Liste tous les codes de statuts
- `scripts/tests/test-status-mapping-fixed.js` - Test du mapping avec alias

---

## 🎯 Impact

### Fonctionnalités Corrigées
- ✅ **Pastilles des vues** : Affichent maintenant les vrais totaux
- ✅ **Filtres par statut** : Fonctionnent correctement même avec codes legacy
- ✅ **Compteurs temps réel** : Reflètent les vraies valeurs en BDD
- ✅ **Compat ibilité** : Aucun code existant n'a besoin d'être modifié

### Avantages de la Solution

1. **Non-invasif** : Aucun refactoring massif requis
2. **Rétrocompatible** : Tous les codes existants continuent de fonctionner
3. **Testable** : Scripts de test pour validation
4. **Performant** : Alias ajoutés au chargement initial (pas de coût runtime)
5. **Maintenable** : Un seul endroit à modifier (hook)

---

## 🔄 Relation avec les Autres Fixes

Ce fix complète le travail fait dans :
- ✅ `FIX_PASTILLES_COMPTEURS_INTERVENTIONS.md` - Compteurs temps réel
- ✅ `OPTIMISATION_INTERVENTIONS_SCROLL_INFINI.md` - Performance
- ✅ `CORRECTIONS_FINALES_UUID_MAPPING.md` - Mapping UUID

**Ensemble**, ces trois fixes assurent que :
1. Les compteurs affichent les **vraies valeurs de la BDD**
2. Les requêtes utilisent les **bons UUID** de statuts
3. Les **alias** permettent la compatibilité avec le code existant

---

## ⚠️ Points d'Attention

### Codes Legacy vs Codes BDD

Il existe maintenant **deux systèmes de codes** :

**Codes Frontend (Legacy)** :
- `EN_COURS`, `TERMINE`
- Utilisés dans l'UI, les formulaires, le workflow
- Conservés pour compatibilité

**Codes BDD (Officiels)** :
- `INTER_EN_COURS`, `INTER_TERMINEE`
- Codes réels dans la base de données
- Utilisés dans les requêtes SQL

**Le hook `useInterventionStatusMap` fait le pont entre les deux**.

### Futures Migrations

Si un jour on veut **uniformiser** les codes :

1. Option A : Changer les codes dans la BDD
   ```sql
   UPDATE intervention_statuses SET code = 'EN_COURS' WHERE code = 'INTER_EN_COURS';
   UPDATE intervention_statuses SET code = 'TERMINE' WHERE code = 'INTER_TERMINEE';
   ```

2. Option B : Remplacer tous les codes frontend par les codes BDD
   - Refactoring de ~30 fichiers
   - Plus cohérent mais plus risqué

**Recommandation actuelle** : Garder le système d'alias tant qu'il fonctionne.

---

## 📝 Scripts de Test

### Test Rapide
```bash
# Vérifier le mapping
node scripts/tests/test-status-mapping-fixed.js

# Vérifier les compteurs pour Andrea
node scripts/tests/test-andrea-counts.js

# Lister tous les codes
node scripts/tests/list-status-codes.js
```

### Test Complet
```bash
# Lancer tous les tests unitaires
npx vitest run tests/unit/supabase-api-v2-total-count.test.ts
npx vitest run tests/unit/hooks/

# Vérifier TypeScript
npx tsc --noEmit
```

---

## ✅ Checklist de Validation

- [x] Le mapping `EN_COURS` → UUID fonctionne
- [x] Le mapping `TERMINE` → UUID fonctionne
- [x] Les compteurs pour Andrea sont corrects (34 au lieu de 868)
- [x] Les tests passent
- [x] Aucune régression TypeScript
- [x] Documentation complète
- [x] Scripts de test créés

---

## 🎉 Conclusion

Le problème des pastilles incorrectes est maintenant **100% résolu** :

1. ✅ **Compteurs temps réel** (`getInterventionTotalCount`)
2. ✅ **Mapping CODE → UUID** (`useInterventionStatusMap`)
3. ✅ **Alias frontend ↔ BDD** (ce fix)

Les pastilles affichent maintenant les **vraies valeurs** sans modifier le code existant.

---

**Auteur** : Assistant IA  
**Validé par** : Andre Bertea  
**Tags** : `interventions`, `statuts`, `mapping`, `pastilles`, `fix`, `hotfix`




