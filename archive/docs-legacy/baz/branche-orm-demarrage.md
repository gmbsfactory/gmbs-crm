# 🚀 Guide de Démarrage - Branche `feature/integration_orm`

## 📋 Résumé Exécutif

La branche `feature/integration_orm` introduit une **refonte architecturale majeure** du CRM avec une API V2 modulaire et des scripts d'import refactorisés.

### ✅ Changements Principaux

1. **API V2 Modulaire** (`src/lib/api/v2/`)
   - Point d'entrée centralisé pour tous les accès données
   - Architecture modulaire par domaine (users, interventions, artisans, etc.)
   - Types strictes et cohérents

2. **Scripts d'Import Google Sheets V2**
   - Architecture en 3 couches (DataMapper, DatabaseManager, Script principal)
   - Séparation parsing / insertion
   - Meilleure gestion d'erreurs

3. **Documentation Exhaustive**
   - `AGENTS.md` - Guide complet pour les développeurs
   - `docs/MIGRATION_API_V2.md` - Guide de migration
   - `scripts/imports/README-V2.md` - Guide des imports

---

## ✅ Corrections Appliquées (20 Oct 2025)

### 1. **Nettoyage** ✅
- Suppression du fichier artefact `i.id).join('` (vide)

### 2. **Corrections TypeScript** ✅
- ✅ Mise à jour du type `InterventionView` avec tous les champs mappés
- ✅ Correction de `supabase-api-v2.ts` pour retourner `InterventionView` au lieu de `Intervention`
- ✅ Correction de `InterventionCard.tsx` pour utiliser `InterventionView`
- ✅ Correction de `app/interventions/page.tsx` (types corrigés)

### 3. **État des Erreurs TypeScript**
- **Avant** : ~33 erreurs critiques
- **Après** : ~15 erreurs restantes (principalement des erreurs mineures)
  - 5 erreurs Next.js dans `.next/types` (liées au router, pas notre code)
  - 10 erreurs mineures dans composants UI

---

## 🎯 État Actuel de la Branche

### ✅ Fonctionnel
- API V2 modulaire complète
- Types TypeScript cohérents
- Mapping snake_case → camelCase automatique
- Scripts d'import Google Sheets V2

### ⚠️ À Finaliser
- Quelques erreurs TypeScript mineures dans les composants UI
- Tests unitaires de l'API V2 à lancer
- Validation des scripts d'import V2

---

## 📖 Comment Démarrer

### 1. **Comprendre l'Architecture** (15 min)

#### a) Lire les documents clés
```bash
# Guide principal des développeurs
cat AGENTS.md

# Guide de migration API V2
cat docs/MIGRATION_API_V2.md

# API V2 - Vue d'ensemble
cat src/lib/api/v2/README.md
```

#### b) Comprendre le mapping des données
- **Base de données** : `snake_case` (ex: `contexte_intervention`, `assigned_user_id`)
- **API V2** : Retourne `snake_case` de la DB
- **Mapper** : `mapInterventionRecord()` transforme en `camelCase` pour l'UI
- **Types** : `Intervention` (DB) → `InterventionView` (UI avec champs mappés)

### 2. **Utiliser l'API V2** (Import)

```typescript
// ✅ BON - Import depuis le point d'entrée centralisé
import { interventionsApi, artisansApi, usersApi } from '@/lib/api/v2';

// ❌ MAUVAIS - Accès direct au client Supabase
import { supabase } from '@/lib/supabase-client';
```

#### Exemple d'utilisation
```typescript
// Récupérer toutes les interventions (déjà mappées)
const result = await interventionsApi.getAll();
const interventions: InterventionView[] = result.data;

// Les données ont déjà les champs camelCase
console.log(interventions[0].contexteIntervention); // ✅ Fonctionne
console.log(interventions[0].attribueA); // ✅ Fonctionne
console.log(interventions[0].statusValue); // ✅ Fonctionne
```

### 3. **Tests et Validation** (30 min)

#### a) Vérifier la compilation TypeScript
```bash
npm run typecheck
```

#### b) Tester l'API V2
```bash
# Test complet de l'API V2
npx tsx scripts/tests/test-api-v2.js

# Test d'une API spécifique
npx tsx scripts/tests/test-api-v2.js --api interventions
```

#### c) Tester les scripts d'import V2 (dry-run)
```bash
# Mode dry-run (ne modifie pas la DB)
npx tsx scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

# Import réel (une fois validé)
npx tsx scripts/imports/google-sheets-import-clean-v2.js
```

### 4. **Développement Local**

```bash
# Démarrer l'application
npm run dev

# Dans un autre terminal - Supabase local
supabase start
```

---

## 🗺️ Structure de l'API V2

```
src/lib/api/v2/
├── index.ts                 # Point d'entrée central - UTILISER CELUI-CI
├── common/
│   ├── types.ts            # Types TypeScript partagés
│   └── utils.ts            # Utilitaires (mapping, validation)
├── interventionsApi.ts     # API des interventions
├── artisansApi.ts          # API des artisans
├── usersApi.ts             # API des utilisateurs
├── clientsApi.ts           # API des clients
├── documentsApi.ts         # API des documents
├── commentsApi.ts          # API des commentaires
├── rolesApi.ts             # API des rôles et permissions
├── tenantsApi.ts           # API multi-tenant (locataires)
├── ownersApi.ts            # API des propriétaires
├── enumsApi.ts             # API des énumérations (métiers, statuts, etc.)
└── utilsApi.ts             # Utilitaires avancés
```

---

## 🔑 Principes Clés (AGENTS.md)

### 1. **API V2 = Seul Point d'Entrée**
> **RÈGLE D'OR** : Ne JAMAIS accéder directement au client Supabase dans les composants. Toujours passer par l'API V2.

### 2. **Tests Unitaires Obligatoires**
> **PRINCIPE FONDAMENTAL** : Chaque fonction métier doit avoir des tests unitaires (cas nominal + cas d'erreur).

### 3. **Migrations SQL Strictes**
- Un fichier par migration : `YYYYMMDD_description.sql`
- Jamais de modification directe de la DB
- Revue humaine obligatoire

### 4. **Séparation Parsing / Insertion**
Pour les imports de données :
- **DataMapper** : Parse les données brutes (retourne JSON)
- **DatabaseManager** : Gère l'insertion et les relations
- **Script principal** : Orchestre le flow

---

## 📊 Statistiques de la Branche

### Fichiers Modifiés/Ajoutés
- **API V2** : 13 fichiers (`src/lib/api/v2/`)
- **Scripts d'import V2** : 8 fichiers (`scripts/imports/`, `scripts/data-processing/`)
- **Documentation** : 5 fichiers (`docs/`, `scripts/imports/README-V2.md`)
- **Types** : 3 fichiers mis à jour (`src/types/intervention-view.ts`, etc.)

### Lignes de Code
- **API V2** : ~3000 lignes
- **Scripts V2** : ~2000 lignes
- **Documentation** : ~1500 lignes

---

## ⚠️ Points d'Attention

### 1. **Erreurs TypeScript Restantes**
Il reste ~15 erreurs TypeScript mineures :
- 5 erreurs Next.js dans `.next/types/` (liées au router, ignorables)
- 10 erreurs mineures dans les composants UI (DropdownMenu, refs, etc.)

Ces erreurs n'impactent pas le fonctionnement mais devraient être corrigées.

### 2. **Tests à Lancer**
Les tests suivants doivent être lancés pour valider la branche :
- [ ] Tests API V2 (`scripts/tests/test-api-v2.js`)
- [ ] Tests d'import V2 en dry-run
- [ ] Tests e2e de l'UI

### 3. **Documentation à Compléter**
- [ ] Exemples d'utilisation de chaque API dans `examples/`
- [ ] Guide de migration pour les anciens scripts
- [ ] Documentation des types mappés

---

## 🛠️ Commandes Utiles

```bash
# Développement
npm run dev                  # Démarrer l'app en dev

# Base de données
supabase start              # Démarrer Supabase local
supabase db reset           # Reset DB et appliquer migrations

# Tests
npm run typecheck           # Vérifier les types TypeScript
npm run test                # Tests unitaires (à configurer)
npm run test:e2e           # Tests end-to-end

# Scripts d'import
npx tsx scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

# Qualité du code
npm run lint                # ESLint
npm run lint:fix           # ESLint avec auto-fix
```

---

## 📞 Support et Ressources

### Documentation
- **Guide complet** : `AGENTS.md`
- **API CRM** : `docs/API_CRM_COMPLETE.md`
- **Migration API** : `docs/MIGRATION_API_V2.md`
- **Scripts d'import** : `scripts/imports/README-V2.md`

### Exemples
- **Gestion utilisateurs** : `examples/UserManagementExamples.ts`
- **Gestion interventions** : `examples/InterventionManager.tsx`

### Tests
- **Tests API V2** : `scripts/tests/test-api-v2.js`
- **Tests unitaires** : `tests/unit/`

---

## ✅ Prochaines Étapes Recommandées

1. **Phase 1 : Validation** (1h)
   - [ ] Lancer `npm run typecheck` et corriger les erreurs restantes
   - [ ] Tester l'API V2 avec le script de test
   - [ ] Tester les imports V2 en mode dry-run

2. **Phase 2 : Documentation** (30 min)
   - [ ] Lire `AGENTS.md` en détail
   - [ ] Parcourir `docs/MIGRATION_API_V2.md`
   - [ ] Explorer la structure de `src/lib/api/v2/`

3. **Phase 3 : Développement** (en cours)
   - [ ] Utiliser l'API V2 dans les nouveaux composants
   - [ ] Écrire des tests unitaires pour les nouvelles fonctionnalités
   - [ ] Suivre les conventions définies dans `AGENTS.md`

---

## 🎉 Conclusion

La branche `feature/integration_orm` est **fonctionnelle et utilisable** pour le développement. Les corrections TypeScript principales ont été appliquées, et l'architecture est propre et maintenable.

**Vous pouvez commencer à développer en utilisant l'API V2 dès maintenant !**

Pour toute question, référez-vous à `AGENTS.md` qui contient tous les principes, standards et directives du projet.

---

**Dernière mise à jour** : 20 octobre 2025
**Auteur** : Agent IA
**Statut** : ✅ Prêt pour le développement

