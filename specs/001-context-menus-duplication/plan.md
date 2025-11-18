# Implementation Plan: Menus contextuels et duplication "Devis supp"

**Branch**: `001-context-menus-duplication` | **Date**: 2025-01-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-context-menus-duplication/spec.md`

**Note**: Ce plan se concentre sur les modifications apportées lors de la session de clarification du 2025-01-16.

## Summary

Cette fonctionnalité ajoute des menus contextuels (clic droit) pour les interventions et les artisans, permettant des actions rapides (duplication "Devis supp", transitions de statut, assignation, archivage). Les clarifications apportées concernent principalement :

1. **Duplication sans vérification de doublons** : La duplication "Devis supp" ignore la vérification de doublons pour permettre plusieurs devis supplémentaires
2. **Gestion des états de chargement** : Options désactivées pendant les mutations (pas de spinner)
3. **Permissions simplifiées** : Tous les utilisateurs authentifiés ont accès à toutes les actions
4. **Gestion d'erreurs améliorée** : Messages explicites pour les cas d'erreur (intervention supprimée, etc.)

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode)  
**Primary Dependencies**: Next.js 15.5.6, React 18.3.1, @tanstack/react-query 5.90.2, @radix-ui/react-context-menu 2.2.4, Supabase 2.58.0  
**Storage**: Supabase (PostgreSQL) avec RLS  
**Testing**: Vitest 3.2.4 + Testing Library  
**Target Platform**: Web (Next.js App Router)  
**Project Type**: Single project (web application)  
**Performance Goals**: Menu contextuel < 100ms d'affichage (SC-004), duplication < 2 secondes (SC-002)  
**Constraints**: TypeScript strict, alias `@/` pour les imports, React Query pour l'état serveur  
**Scale/Scope**: Application CRM avec gestion d'interventions et d'artisans

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Architecture Modulaire et API-First
- Utilisation de l'architecture API v2 existante (`src/lib/api/v2/`)
- Hooks React Query dans `src/hooks/` pour encapsuler la logique
- Imports avec alias `@/` uniquement

### ✅ TypeScript Strict et Typage Fort
- Tous les types explicitement définis
- Types centralisés dans les modules API correspondants
- Pas de `any` autorisé

### ✅ React Query pour la Gestion d'État Serveur
- Mutations React Query pour toutes les actions du menu contextuel
- Invalidation automatique des queries après mutations
- Query keys centralisées dans `src/lib/react-query/queryKeys.ts`

### ✅ Design System et UI Components
- Utilisation du composant ContextMenu existant (`@/components/ui/context-menu`) basé sur Radix UI
- Icônes Lucide React exclusivement
- Toasts pour les messages d'erreur/succès

### ✅ Performance et Optimisation
- Menu contextuel optimisé pour affichage < 100ms
- Mutations optimistes où approprié (déjà implémentées dans `useInterventionContextMenu`)

### ✅ Sécurité et RLS
- Authentification Supabase requise pour toutes les actions
- Pas de restrictions basées sur les rôles (tous les authentifiés ont accès)

**Status**: ✅ Toutes les vérifications passent. Aucune violation de la constitution.

## Project Structure

### Documentation (this feature)

```text
specs/001-context-menus-duplication/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (si nécessaire)
├── data-model.md        # Phase 1 output (si nécessaire)
├── quickstart.md        # Phase 1 output (si nécessaire)
├── contracts/          # Phase 1 output (si nécessaire)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── hooks/
│   ├── useInterventionContextMenu.ts    # Hook existant - MODIFIER pour ignorer vérification doublons
│   └── useArtisanContextMenu.ts         # Hook existant - vérifier conformité
├── components/
│   ├── ui/
│   │   └── context-menu.tsx            # Composant existant - vérifier utilisation
│   ├── interventions/
│   │   └── InterventionContextMenu.tsx  # Composant existant - MODIFIER pour états disabled
│   └── artisans/
│       └── ArtisanContextMenu.tsx       # Composant existant - vérifier conformité
├── lib/
│   └── api/
│       └── interventions.ts            # MODIFIER duplicateIntervention pour ignorer doublons
└── app/
    └── api/
        └── interventions/
            └── [id]/
                ├── duplicate/
                │   └── route.ts         # Endpoint existant - MODIFIER gestion erreur intervention supprimée
                └── assign/
                    └── route.ts         # Endpoint existant - vérifier conformité
```

**Structure Decision**: Single project structure avec architecture modulaire existante. Les modifications se concentrent sur les fichiers existants pour intégrer les clarifications.

## Modifications Requises Suite aux Clarifications

### 1. Modification de `duplicateIntervention` (FR-006)

**Fichier**: `src/lib/api/interventions.ts`

**Changement**: Ignorer la vérification de doublons lors de la duplication "Devis supp"

**Code actuel** (lignes 344-348):
```typescript
const duplicates = await findDuplicates(duplicatePayload, supabase)
if (duplicates.length > 0) {
  throw new Error("Des doublons ont été détectés lors de la duplication")
}
```

**Code modifié**:
```typescript
// Clarification: Ignorer la vérification de doublons pour permettre plusieurs devis supplémentaires
// const duplicates = await findDuplicates(duplicatePayload, supabase)
// if (duplicates.length > 0) {
//   throw new Error("Des doublons ont été détectés lors de la duplication")
// }
```

### 2. Gestion d'erreur pour intervention supprimée (User Story 5, scénario 5)

**Fichier**: `app/api/interventions/[id]/duplicate/route.ts`

**Changement**: Ajouter une vérification explicite et message d'erreur clair si l'intervention originale n'existe plus

**Code à ajouter** après la ligne 36:
```typescript
// Vérifier que l'intervention originale existe toujours
if (!original) {
  return NextResponse.json(
    { error: "L'intervention originale n'existe plus" },
    { status: 404 }
  )
}
```

Note: La fonction `duplicateIntervention` lance déjà une erreur si l'intervention n'existe pas (ligne 310-312), mais le message doit être plus explicite.

### 3. États disabled pendant mutations (FR-014)

**Fichier**: `src/components/interventions/InterventionContextMenu.tsx`

**Changement**: S'assurer que les options du menu sont désactivées pendant les mutations (pas de spinner)

**Vérification**: Le hook `useInterventionContextMenu` expose déjà `isLoading` avec les états par mutation. Le composant doit utiliser ces états pour désactiver les options correspondantes.

**Pattern attendu**:
```typescript
<ContextMenuItem
  disabled={isLoading.duplicate}
  onSelect={handleDuplicate}
>
  Devis supp
</ContextMenuItem>
```

### 4. Permissions (FR-016)

**Statut**: ✅ Déjà conforme - L'authentification Supabase est vérifiée dans les endpoints API. Aucune restriction basée sur les rôles n'est nécessaire.

## Phase 0: Outline & Research

**Status**: ✅ Pas de recherche nécessaire - Les clarifications sont techniques et concernent des modifications de code existant.

Les technologies et patterns sont déjà établis dans le projet :
- React Query pour les mutations (déjà utilisé)
- Radix UI ContextMenu (déjà intégré)
- Supabase pour l'authentification (déjà configuré)
- Gestion d'erreurs avec toasts (déjà implémentée)

## Phase 1: Design & Contracts

### Modifications du Modèle de Données

**Aucune modification du schéma de base de données requise**. Les clarifications concernent uniquement la logique applicative :

1. **Duplication sans vérification de doublons** : Logique métier uniquement
2. **États disabled** : Logique UI uniquement
3. **Gestion d'erreurs** : Messages d'erreur améliorés, pas de changement de structure

### Contrats API

**Aucun nouveau contrat API requis**. Les endpoints existants sont utilisés :

- `POST /api/interventions/[id]/duplicate` - Modifié pour gestion d'erreur améliorée
- `POST /api/interventions/[id]/assign` - Aucune modification nécessaire
- `POST /api/interventions/[id]/transition` (via `transitionStatus`) - Aucune modification nécessaire

### Mise à jour du Contexte Agent

**Action requise**: Exécuter `.specify/scripts/bash/update-agent-context.sh cursor-agent` après validation du plan pour mettre à jour le contexte avec les clarifications.

## Phase 2: Implementation Tasks

Les tâches d'implémentation seront générées par `/speckit.tasks` et se concentreront sur :

1. **T003** (modifié) : Mettre à jour `duplicateIntervention` pour ignorer la vérification de doublons
2. **T004** (modifié) : Améliorer la gestion d'erreur dans l'endpoint `/duplicate` pour le cas "intervention supprimée"
3. **T007** (vérification) : S'assurer que `useInterventionContextMenu` expose correctement les états `isLoading`
4. **T019** (vérification) : Vérifier que `InterventionContextMenuContent` utilise les états `isLoading` pour désactiver les options

## Complexity Tracking

> **Aucune violation de la constitution détectée**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Next Steps

1. ✅ Plan créé et validé
2. ⏭️ Exécuter `/speckit.tasks` pour générer les tâches d'implémentation détaillées
3. ⏭️ Implémenter les modifications selon les clarifications
4. ⏭️ Tester les scénarios d'acceptation mis à jour (notamment User Story 5, scénario 5)
