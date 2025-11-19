# Research: Menus contextuels et duplication "Devis supp"

**Date**: 2025-01-16  
**Phase**: Phase 0 - Outline & Research  
**Status**: ✅ Complete - All clarifications resolved

## Overview

Ce document consolide les décisions techniques prises pour l'implémentation des menus contextuels et de la duplication "Devis supp". Toutes les inconnues identifiées dans le Technical Context ont été résolues en analysant le codebase existant et les patterns établis.

## Décisions Techniques

### 1. Composant UI pour les menus contextuels

**Décision**: Utiliser le composant `ContextMenu` existant basé sur Radix UI

**Rationale**:
- Le composant existe déjà dans `src/components/ui/context-menu.tsx`
- Basé sur `@radix-ui/react-context-menu` 2.2.4, déjà installé
- Suit les conventions shadcn/ui du projet
- Déjà utilisé dans `ViewTabs.tsx` pour les menus contextuels des vues
- Conforme à la constitution (Gate 4: Design System)

**Alternatives considérées**:
- Créer un nouveau composant custom : ❌ Rejeté car dupliquerait la fonctionnalité existante
- Utiliser DropdownMenu : ❌ Rejeté car moins adapté au clic droit (UX)

**Référence**: `src/components/ui/context-menu.tsx`, `src/components/interventions/views/ViewTabs.tsx`

---

### 2. Gestion des transitions de statut

**Décision**: Réutiliser la fonction `transitionStatus` existante dans `src/lib/api/interventions.ts`

**Rationale**:
- Fonction existante qui gère déjà les transitions de statut
- Respecte les règles de workflow existantes
- Utilise l'API route `/app/api/interventions/[id]/status/route.ts`
- Gère la validation des prérequis (ex: `id_inter` pour "Devis envoyé")
- Conforme à la constitution (Gate 1: Architecture API-First)

**Alternatives considérées**:
- Créer une nouvelle API : ❌ Rejeté car dupliquerait la logique existante
- Appeler directement Supabase : ❌ Rejeté car bypasserait les validations métier

**Référence**: `src/lib/api/interventions.ts:231`, `app/api/interventions/[id]/status/route.ts`

---

### 3. Duplication d'intervention "Devis supp"

**Décision**: Créer une nouvelle fonction `duplicateIntervention` dans `src/lib/api/interventions.ts` qui réutilise `createIntervention`

**Rationale**:
- Réutilise la logique existante de création d'intervention
- Respecte les règles métier (exclusion de `contexte_intervention`, `consigne_intervention`)
- Crée automatiquement le commentaire système via `commentsApi.create`
- Utilise les types existants (`CreateInterventionInput`, `UpdateInterventionData`)
- Conforme à la constitution (Gate 1: Architecture API-First)

**Alternatives considérées**:
- Duplication directe en SQL : ❌ Rejeté car bypasserait les validations et règles métier
- Utiliser une fonction Supabase Edge Function : ❌ Rejeté car complexité inutile pour cette opération

**Référence**: `src/lib/api/interventions.ts:166`, `src/lib/api/v2/commentsApi.ts:66`

---

### 4. Création de commentaires système

**Décision**: Utiliser `commentsApi.create` de `src/lib/api/v2/commentsApi.ts`

**Rationale**:
- API v2 existante et typée
- Supporte `entity_type`, `entity_id`, `comment_type`, `author_id`
- Gère automatiquement les champs requis (`content`, `is_internal`)
- Conforme à la constitution (Gate 1: Architecture API-First)

**Alternatives considérées**:
- Insertion directe en SQL : ❌ Rejeté car bypasserait l'API et les validations
- Utiliser l'ancienne API : ❌ Rejeté car l'API v2 est la référence

**Référence**: `src/lib/api/v2/commentsApi.ts:66`, `supabase/functions/comments/index.ts:204`

---

### 5. Archivage d'artisan avec motif obligatoire

**Décision**: Réutiliser le composant `StatusReasonModal` existant

**Rationale**:
- Composant existant dans `src/components/shared/StatusReasonModal.tsx`
- Gère déjà le motif obligatoire avec validation bloquante
- Supporte le type `archive` avec badge et messages appropriés
- Conforme à la constitution (Gate 4: Design System)

**Alternatives considérées**:
- Créer un nouveau modal : ❌ Rejeté car dupliquerait la fonctionnalité existante
- Utiliser un simple prompt : ❌ Rejeté car ne respecterait pas les règles métier (motif obligatoire)

**Référence**: `src/components/shared/StatusReasonModal.tsx`, `docs/livrable-2025-11-04/BUSINESS_RULES_2025-11-04.md:617`

---

### 6. Assignation "Je gère" pour interventions

**Décision**: Créer une mutation React Query qui met à jour `assigned_user_id` via l'API v2

**Rationale**:
- Utilise l'API v2 existante (`interventionsApiV2.update`)
- Respecte les patterns React Query du projet
- Invalide automatiquement les queries concernées
- Conforme à la constitution (Gate 3: React Query)

**Alternatives considérées**:
- Mise à jour directe Supabase : ❌ Rejeté car bypasserait l'API v2
- Utiliser l'ancienne API : ❌ Rejeté car l'API v2 est la référence

**Référence**: `src/lib/api/v2/common/types.ts:319`, `src/lib/supabase-api-v2.ts`

---

### 7. Gestion d'état et rafraîchissement des vues

**Décision**: Utiliser React Query avec invalidation automatique des queries

**Rationale**:
- Pattern établi dans le projet
- Invalidation automatique après mutations (transitions, duplication, assignation)
- Rafraîchissement optimiste possible pour améliorer l'UX
- Conforme à la constitution (Gate 3: React Query)

**Alternatives considérées**:
- Rafraîchissement manuel : ❌ Rejeté car moins fiable et plus verbeux
- État local uniquement : ❌ Rejeté car ne synchroniserait pas avec le serveur

**Référence**: Hooks existants dans `src/hooks/`, `src/lib/query-keys.ts`

---

### 8. Affichage conditionnel des options de menu

**Décision**: Logique conditionnelle dans les hooks `useInterventionContextMenu` et `useArtisanContextMenu`

**Rationale**:
- Encapsule la logique métier dans des hooks réutilisables
- Facilite les tests unitaires
- Réutilisable dans tous les composants (tableau, carte, market)
- Conforme à la constitution (Gate 3: React Query patterns)

**Alternatives considérées**:
- Logique dans les composants : ❌ Rejeté car dupliquerait la logique
- Utiliser un contexte global : ❌ Rejeté car complexité inutile pour cette fonctionnalité

**Référence**: Pattern des hooks existants dans `src/hooks/`

---

### 9. Gestion des erreurs

**Décision**: Utiliser le système de toast existant (`useToast`) avec messages d'erreur clairs

**Rationale**:
- Système existant et cohérent avec le reste de l'application
- Messages d'erreur utilisateur-friendly
- Gestion d'erreurs réseau et validation
- Conforme à la constitution (Conventions de Code)

**Alternatives considérées**:
- Alertes natives : ❌ Rejeté car moins cohérent avec l'UI
- Console.error uniquement : ❌ Rejeté car ne fournirait pas de feedback utilisateur

**Référence**: `src/components/ui/toast`, hooks utilisant `useToast`

---

### 10. Performance et optimisation

**Décision**: 
- Menu contextuel : Pas de préchargement nécessaire (affichage < 100ms requis)
- Duplication : Optimisation avec transaction SQL si possible
- Transitions : Utilisation de mutations optimistes React Query

**Rationale**:
- Respecte les contraintes de performance (SC-002, SC-003, SC-004)
- Utilise les patterns d'optimisation existants du projet
- Conforme à la constitution (Gate 6: Performance)

**Alternatives considérées**:
- Préchargement des données : ❌ Rejeté car complexité inutile pour cette fonctionnalité
- Pas d'optimisation : ❌ Rejeté car ne respecterait pas les contraintes de performance

**Référence**: Patterns d'optimisation dans `src/lib/preload-critical-data.ts`

---

## Intégrations Identifiées

### APIs Existantes à Réutiliser

1. **`interventionsApiV2`** (`src/lib/api/v2/interventionsApi.ts`)
   - Pour les opérations CRUD sur les interventions
   - Pour la duplication (via `createIntervention`)

2. **`commentsApi`** (`src/lib/api/v2/commentsApi.ts`)
   - Pour créer le commentaire système lors de la duplication

3. **`transitionStatus`** (`src/lib/api/interventions.ts`)
   - Pour les transitions de statut depuis le menu contextuel

4. **`artisansApiV2`** (`src/lib/api/v2/artisansApi.ts`)
   - Pour les opérations sur les artisans (archivage)

### Composants Existants à Réutiliser

1. **`ContextMenu`** (`src/components/ui/context-menu.tsx`)
   - Composant de base pour tous les menus contextuels

2. **`StatusReasonModal`** (`src/components/shared/StatusReasonModal.tsx`)
   - Pour l'archivage avec motif obligatoire

### Hooks à Créer

1. **`useInterventionContextMenu`** (`src/hooks/useInterventionContextMenu.ts`)
   - Logique métier pour les menus contextuels d'interventions
   - Gestion des actions conditionnelles
   - Mutations React Query pour transitions, duplication, assignation

2. **`useArtisanContextMenu`** (`src/hooks/useArtisanContextMenu.ts`)
   - Logique métier pour les menus contextuels d'artisans
   - Gestion de l'archivage avec StatusReasonModal

## Points d'Attention

### 1. Conditions d'affichage des options

- **"Passer à Devis envoyé"** : Uniquement si `statut = "DEMANDE"` ET `id_inter` non null
- **"Passer à Accepté"** : Uniquement si `statut = "DEVIS_ENVOYE"`
- **"Je gère"** : Uniquement dans la vue Market
- **"Devis supp"** : Toujours disponible

### 2. Gestion des erreurs réseau

- Afficher un toast d'erreur avec message clair
- Ne pas fermer le menu contextuel en cas d'erreur (permettre retry)
- Logger les erreurs côté serveur pour debugging

### 3. Rafraîchissement après actions

- Invalider les queries React Query concernées
- Rafraîchir la vue actuelle (tableau, carte, market)
- Mettre à jour les counts si nécessaire

### 4. Permissions et RLS

- Vérifier que l'utilisateur a les droits pour chaque action
- Respecter les politiques RLS existantes
- Gérer les cas où l'utilisateur n'a pas les permissions

## Conclusion

Toutes les décisions techniques ont été prises en se basant sur l'analyse du codebase existant. Aucune nouvelle dépendance n'est requise. Tous les composants et APIs nécessaires existent déjà et seront réutilisés. L'implémentation suivra les patterns établis dans le projet et respectera la constitution.

**Status**: ✅ **READY FOR PHASE 1** - Toutes les clarifications résolues, aucune dépendance externe requise





