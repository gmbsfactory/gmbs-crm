# Migration des Types Intervention - Guide

## 📋 Contexte

**Problème identifié:** 4 définitions différentes de `Intervention` dans différents fichiers :
- `src/types/intervention.ts`
- `src/types/interventions.ts`
- `src/types/intervention-view.ts`
- `src/lib/api/v2/common/types.ts`

**Solution:** Types consolidés générés depuis le schéma SQL (source unique de vérité)

## ✅ Solution Implémentée

### 1. Types Consolidés (`src/types/intervention-generated.ts`)

Les types sont maintenant générés depuis `database.types.ts` qui est lui-même généré depuis le schéma Supabase.

**Types de base:**
- `InterventionRow` - Type exact de la table SQL
- `InterventionInsert` - Pour les INSERT
- `InterventionUpdate` - Pour les UPDATE
- `Intervention` - Type enrichi avec relations
- `InterventionWithStatus` - Avec statut
- `InterventionView` - Pour l'affichage UI

### 2. Migration des Fichiers Existants

Les fichiers existants ont été mis à jour pour ré-exporter les types consolidés :

- ✅ `src/types/intervention.ts` - Ré-exporte depuis `intervention-generated.ts`
- ✅ `src/types/intervention-view.ts` - Ré-exporte depuis `intervention-generated.ts`
- ✅ `src/lib/api/v2/common/types.ts` - Ré-exporte depuis `intervention-generated.ts`

## 🔄 Comment Migrer

### Étape 1: Mettre à jour les imports

**Avant:**
```typescript
import type { Intervention } from "@/lib/api/v2/common/types";
```

**Après:**
```typescript
import type { Intervention } from "@/types/intervention-generated";
// ou pour compatibilité temporaire:
import type { Intervention } from "@/lib/api/v2/common/types"; // ✅ Fonctionne toujours
```

### Étape 2: Utiliser les nouveaux types

```typescript
import type { 
  Intervention,
  InterventionRow,
  InterventionInsert,
  InterventionUpdate,
  InterventionWithStatus,
  InterventionView,
  CreateInterventionData,
  UpdateInterventionData
} from "@/types/intervention-generated";
```

## 🔧 Génération des Types

### Commande pour régénérer les types depuis Supabase

```bash
# Générer depuis Supabase local
npx supabase gen types typescript --local > src/lib/database.types.ts

# Générer depuis Supabase distant (production)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### Script NPM (à ajouter dans package.json)

```json
{
  "scripts": {
    "types:generate": "supabase gen types typescript --local > src/lib/database.types.ts"
  }
}
```

## ⚠️ Notes Importantes

1. **Ne pas modifier manuellement** `src/types/intervention-generated.ts`
2. **Toujours régénérer** les types après une migration SQL
3. **Les types legacy** sont conservés pour compatibilité mais marqués `@deprecated`
4. **Migration progressive** - Les anciens imports fonctionnent encore

## 📝 Checklist de Migration

- [x] Créer `src/types/intervention-generated.ts`
- [x] Mettre à jour `src/types/intervention.ts`
- [x] Mettre à jour `src/types/intervention-view.ts`
- [x] Mettre à jour `src/lib/api/v2/common/types.ts`
- [ ] Migrer tous les imports dans le codebase
- [ ] Supprimer les définitions dupliquées
- [ ] Ajouter le script de génération dans package.json
- [ ] Documenter dans le README

## 🎯 Prochaines Étapes

1. Migrer progressivement tous les fichiers qui importent les anciens types
2. Ajouter des tests pour vérifier la cohérence des types
3. Configurer un hook pre-commit pour vérifier que les types sont à jour

