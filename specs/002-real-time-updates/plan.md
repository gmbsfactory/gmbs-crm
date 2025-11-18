# Implementation Plan: Mise à jour en temps réel de la table vue des interventions

**Branch**: `002-real-time-updates` | **Date**: 2025-01-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-real-time-updates/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implémentation d'un système de mise à jour en temps réel pour la table vue des interventions utilisant Supabase Realtime. Les modifications d'interventions (assignation, changement de statut, etc.) doivent être visibles instantanément (< 500ms) pour tous les utilisateurs sans nécessiter de refresh de page. Le système intègre Supabase Realtime avec le cache TanStack Query existant (staleTime 30s) pour garantir la cohérence des données tout en conservant les performances.

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode), React 18.3+, Next.js 15.5+  
**Primary Dependencies**: 
- `@supabase/supabase-js` ^2.58.0 (Realtime)
- `@tanstack/react-query` ^5.90.2 (cache management)
- Next.js 15.5+ (App Router)
- React 18.3+ (Server Components)

**Storage**: Supabase (PostgreSQL) avec Row Level Security (RLS) activé  
**Testing**: Vitest + Testing Library pour les tests unitaires, Playwright pour les tests E2E  
**Target Platform**: Web (navigateurs modernes), Next.js App Router  
**Project Type**: Web application (Next.js monorepo)  
**Performance Goals**: 
- Mise à jour visible en < 500ms après action utilisateur
- Synchronisation multi-utilisateurs en < 2 secondes
- Support de 10 utilisateurs simultanés sans dégradation
- Debounce de 500ms pour les appels API de comptage

**Constraints**: 
- Conserver le cache TanStack Query existant (staleTime 30s)
- Utiliser les appels API de comptage existants (pas de calcul mathématique local)
- Row Level Security (RLS) doit filtrer automatiquement les événements Realtime
- Basculement automatique vers polling (5s) si Realtime indisponible
- File d'attente FIFO limitée à 50 modifications pour synchronisation différée

**Scale/Scope**: 
- ~10 utilisateurs simultanés
- Gestion de toutes les transitions de statut autorisées
- Synchronisation entre plusieurs onglets par utilisateur
- Gestion des conflits de modification simultanée (dernier écrit gagne)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Architecture Modulaire et API-First ✅
- **Conformité**: Utilise l'API v2 existante (`interventionsApiV2` depuis `src/lib/supabase-api-v2.ts`)
- **Imports**: Utilise l'alias `@/` (pas d'imports relatifs)
- **Hooks**: Utilise les hooks React Query existants (`useInterventionsQuery`, `useInterventionsMutations`)

### II. TypeScript Strict et Typage Fort ✅
- **Conformité**: TypeScript strict activé, tous les types explicitement définis
- **Types**: Utilise les types existants de `src/lib/database.types.ts` et `src/lib/api/v2/common/types.ts`
- **Composants**: Composants React typés avec leurs props

### III. Validation Centralisée ✅
- **Conformité**: Pas de nouvelle validation nécessaire (utilise les validations existantes)
- **Source unique**: Les validations existantes dans `scripts/data-processing/validation/` sont réutilisées

### IV. React Query pour la Gestion d'État Serveur ✅
- **Conformité**: Utilise React Query (@tanstack/react-query) existant
- **Hooks**: Utilise les hooks personnalisés dans `src/hooks/`
- **Cache**: Utilise les query keys centralisées dans `src/lib/react-query/queryKeys.ts`
- **StaleTime**: Conserve le staleTime 30s existant

### V. Design System et UI Components ✅
- **Conformité**: Utilise shadcn/ui existant avec Tailwind CSS
- **Composants**: Utilise les composants UI existants dans `src/components/ui/`
- **Icônes**: Utilise lucide-react exclusivement

### VI. Performance et Optimisation ✅
- **Conformité**: 
  - Debounce de 500ms pour les appels API de comptage
  - Mise à jour optimiste du cache TanStack Query
  - Invalidation silencieuse en arrière-plan
- **Virtualisation**: Conserve la virtualisation existante pour les listes longues

### VII. Sécurité et RLS (Row Level Security) ✅
- **Conformité**: Utilise RLS de Supabase pour filtrer les événements Realtime
- **Authentification**: Utilise Supabase Auth existant avec JWT
- **Permissions**: RLS filtre automatiquement les événements selon les permissions utilisateur

**Résultat**: ✅ **TOUS LES GATES PASSENT** - Aucune violation de la constitution détectée. La fonctionnalité s'intègre parfaitement dans l'architecture existante.

## Project Structure

### Documentation (this feature)

```text
specs/002-real-time-updates/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── realtime-events.md  # Schéma des événements Realtime
│   └── cache-updates.md    # Contrats de mise à jour du cache
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── hooks/
│   ├── useInterventionsQuery.ts          # Existant - à étendre
│   ├── useInterventionsMutations.ts     # Existant - à étendre
│   └── useInterventionsRealtime.ts      # NOUVEAU - Hook pour Realtime
├── lib/
│   ├── supabase-api-v2.ts               # Existant - API principale (interventionsApiV2)
│   ├── react-query/
│   │   └── queryKeys.ts                 # Existant - utilisé tel quel
│   ├── supabase-client.ts               # Existant - utilisé tel quel
│   └── realtime/
│       ├── realtime-client.ts           # NOUVEAU - Client Realtime configuré
│       ├── realtime-hooks.ts            # NOUVEAU - Hooks utilitaires Realtime
│       ├── cache-sync.ts                # NOUVEAU - Synchronisation cache TanStack Query
│       └── broadcast-sync.ts            # NOUVEAU - Synchronisation multi-onglets via BroadcastChannel
├── components/
│   ├── interventions/
│   │   └── InterventionRealtimeProvider.tsx  # NOUVEAU - Provider Realtime
│   └── ui/
│       └── [composants existants utilisés]
└── utils/
    └── debounce.ts                      # Existant ou NOUVEAU - Debounce pour compteurs

app/
└── interventions/
    └── page.tsx                         # Existant - à modifier pour intégrer Realtime

tests/
├── unit/
│   └── hooks/
│       └── useInterventionsRealtime.test.ts  # NOUVEAU - Tests unitaires
└── integration/
    └── realtime-sync.test.ts            # NOUVEAU - Tests d'intégration
```

**Structure Decision**: Web application Next.js monorepo. La fonctionnalité s'intègre dans l'architecture existante :
- Nouveaux hooks dans `src/hooks/` pour la logique Realtime
- Nouveau module `src/lib/realtime/` pour la configuration et synchronisation Realtime
  - `realtime-client.ts` : Configuration du channel Supabase Realtime
  - `cache-sync.ts` : Synchronisation du cache TanStack Query avec événements Realtime
  - `broadcast-sync.ts` : Synchronisation multi-onglets via BroadcastChannel API
- Nouveau provider dans `src/components/interventions/` pour encapsuler la logique Realtime
- Modification de `app/interventions/page.tsx` pour intégrer le provider Realtime
- Tests unitaires et d'intégration dans `tests/`

**API Utilisée**: 
- `interventionsApiV2` depuis `src/lib/supabase-api-v2.ts` (API principale)
- `getInterventionTotalCount()` et `getInterventionCounts()` pour les comptages
- Hooks existants : `useInterventionsQuery()` et `useInterventionsMutations()`

## Complexity Tracking

> **Aucune violation de la constitution détectée** - Tous les gates passent. La fonctionnalité s'intègre parfaitement dans l'architecture existante sans nécessiter de déviations.

## Résumé de la Phase de Planification

### Phase 0: Research ✅

**Artefact généré**: `research.md`

**Décisions documentées**:
- Utilisation de Supabase Realtime pour la synchronisation multi-utilisateurs
- Intégration avec TanStack Query via `setQueryData` + invalidation silencieuse
- Gestion des conflits avec stratégie "dernier écrit gagne"
- Basculement vers polling si Realtime indisponible
- Debounce de 500ms pour les appels API de comptage
- File d'attente FIFO pour synchronisation différée
- Indicateurs visuels de modification distante

### Phase 1: Design & Contracts ✅

**Artefacts générés**:
- `data-model.md` - Modèle de données et entités
- `contracts/realtime-events.md` - Contrats des événements Realtime
- `contracts/cache-updates.md` - Contrats de mise à jour du cache
- `quickstart.md` - Guide de démarrage rapide

**Contexte agent mis à jour**: `.cursor/rules/specify-rules.mdc`

### Prochaines Étapes

**Phase 2**: Génération des tâches d'implémentation via `/speckit.tasks`

**Branch**: `002-real-time-updates`  
**Plan**: `specs/002-real-time-updates/plan.md`  
**Status**: ✅ Planification complète - Prêt pour implémentation
