# Résolution de la Dette Technique

## 📋 Résumé

Ce document décrit la résolution de deux problèmes de dette technique identifiés :

1. **Consolidation des Types Intervention** - 4 définitions différentes
2. **Gestion d'Erreurs Incomplète** - Pattern répété `console.error + return null`

## ✅ Solutions Implémentées

### 1. Consolidation des Types Intervention

#### Problème
- 4 définitions différentes de `Intervention` dans :
  - `src/types/intervention.ts`
  - `src/types/interventions.ts`
  - `src/types/intervention-view.ts`
  - `src/lib/api/v2/common/types.ts`

#### Solution
✅ **Types consolidés générés depuis le schéma SQL** (`src/types/intervention-generated.ts`)

- Source unique de vérité : `database.types.ts` (généré depuis Supabase)
- Types de base : `InterventionRow`, `InterventionInsert`, `InterventionUpdate`
- Types enrichis : `Intervention`, `InterventionWithStatus`, `InterventionView`
- Migration progressive : Les anciens fichiers ré-exportent les nouveaux types

#### Fichiers Créés
- ✅ `src/types/intervention-generated.ts` - Types consolidés
- ✅ `docs/migration-types-intervention.md` - Guide de migration

#### Fichiers Modifiés
- ✅ `src/types/intervention.ts` - Ré-exporte depuis `intervention-generated.ts`
- ✅ `src/types/intervention-view.ts` - Ré-exporte depuis `intervention-generated.ts`
- ✅ `src/lib/api/v2/common/types.ts` - Ré-exporte depuis `intervention-generated.ts`
- ✅ `package.json` - Ajout du script `types:generate`

### 2. Gestion d'Erreurs Centralisée

#### Problème
Pattern répété dans le code :
```typescript
catch (error) {
  console.error(error);
  return null; // Pas de propagation
}
```

#### Solution
✅ **Système centralisé de gestion d'erreurs** (`src/lib/errors/error-handler.ts`)

- Logging structuré avec contexte
- Propagation optionnelle des erreurs
- Valeurs de fallback configurables
- Niveaux de sévérité (low, medium, high, critical)
- Erreurs typées applicatives (`AppError`)
- Wrappers automatiques pour fonctions

#### Fichiers Créés
- ✅ `src/lib/errors/error-handler.ts` - Système de gestion d'erreurs
- ✅ `docs/migration-error-handling.md` - Guide de migration
- ✅ `docs/exemple-migration-erreur.ts` - Exemples de migration

## 📚 Documentation

### Guides de Migration
1. **Types Intervention** : `docs/migration-types-intervention.md`
2. **Gestion d'Erreurs** : `docs/migration-error-handling.md`
3. **Exemples** : `docs/exemple-migration-erreur.ts`

### Utilisation

#### Types Consolidés
```typescript
import type { 
  Intervention,
  InterventionWithStatus,
  InterventionView,
  CreateInterventionData,
  UpdateInterventionData
} from "@/types/intervention-generated";
```

#### Gestion d'Erreurs
```typescript
import { ErrorHandler, Errors } from '@/lib/errors/error-handler';

try {
  // ...
} catch (error) {
  return ErrorHandler.handle(error, {
    context: 'myModule',
    operation: 'myOperation',
    fallback: null,
    propagate: false,
    severity: 'medium'
  });
}
```

## 🔄 Prochaines Étapes

### Migration Progressive
1. ✅ Types consolidés créés
2. ✅ Système d'erreurs créé
3. ⏳ Migrer tous les imports vers les nouveaux types
4. ⏳ Remplacer tous les patterns `console.error + return null`
5. ⏳ Ajouter des tests
6. ⏳ Configurer monitoring (Sentry, etc.)

### Commandes Utiles

```bash
# Générer les types depuis Supabase
npm run types:generate

# Vérifier les types
npm run typecheck

# Linter
npm run lint
```

## 📝 Checklist

### Types Intervention
- [x] Créer `src/types/intervention-generated.ts`
- [x] Mettre à jour `src/types/intervention.ts`
- [x] Mettre à jour `src/types/intervention-view.ts`
- [x] Mettre à jour `src/lib/api/v2/common/types.ts`
- [x] Ajouter script `types:generate` dans package.json
- [ ] Migrer tous les imports dans le codebase
- [ ] Supprimer les définitions dupliquées

### Gestion d'Erreurs
- [x] Créer `src/lib/errors/error-handler.ts`
- [x] Créer documentation
- [ ] Identifier tous les patterns problématiques
- [ ] Migrer les API Routes
- [ ] Migrer les hooks
- [ ] Migrer les composants
- [ ] Ajouter des tests

## 🎯 Bénéfices

### Types Consolidés
- ✅ Source unique de vérité (schéma SQL)
- ✅ Synchronisation automatique avec la BDD
- ✅ Réduction des risques de désynchronisation
- ✅ Maintenance facilitée

### Gestion d'Erreurs
- ✅ Logging structuré et traçable
- ✅ Propagation contrôlée
- ✅ Valeurs de fallback explicites
- ✅ Monitoring facilité
- ✅ Débogage amélioré

## ⚠️ Notes Importantes

1. **Ne pas modifier manuellement** `src/types/intervention-generated.ts`
2. **Toujours régénérer** les types après une migration SQL
3. **Migration progressive** - Les anciens imports fonctionnent encore
4. **Tests requis** avant suppression des anciens types

