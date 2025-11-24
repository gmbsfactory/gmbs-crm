# GMBS CRM Constitution

## Core Principles

### I. Architecture Modulaire et API-First
Toute nouvelle fonctionnalité doit suivre l'architecture modulaire API v2 établie. Les APIs sont organisées par domaine métier (interventions, artisans, documents, etc.) dans `src/lib/api/v2/`. Chaque API expose des fonctions typées TypeScript avec gestion d'erreurs robuste. Les imports doivent utiliser l'alias `@/` et jamais les imports relatifs (`../`). Les hooks personnalisés encapsulent la logique de récupération de données via React Query.

### II. TypeScript Strict et Typage Fort
TypeScript strict est activé et non négociable. Tous les types doivent être explicitement définis, jamais `any`. Les interfaces et types sont centralisés dans les modules API correspondants. Les types de base de données sont générés depuis Supabase et disponibles dans `src/lib/database.types.ts`. Les composants React doivent être typés avec leurs props.

### III. Validation Centralisée (Single Source of Truth)
Toute validation de données doit utiliser le système centralisé dans `scripts/data-processing/validation/`. Une seule source de vérité pour chaque règle de validation. Les validations sont réutilisables entre les scripts d'import, les APIs et les formulaires. Les règles communes sont dans `common-rules.js`, les validations spécialisées dans leurs modules respectifs (artisan, intervention, client).

### IV. React Query pour la Gestion d'État Serveur
Toutes les données serveur sont gérées via React Query (@tanstack/react-query). Les hooks personnalisés dans `src/hooks/` encapsulent les queries et mutations. Le cache est optimisé avec des query keys centralisées dans `src/lib/query-keys.ts`. Les mutations invalident automatiquement les queries concernées. Les données sont préchargées quand possible pour améliorer les performances.

### V. Design System et UI Components
Le design system utilise shadcn/ui (Radix UI primitives) avec Tailwind CSS. Dark mode first : le thème par défaut est dark avec fond `bg-[#0A0A0A]`. Les composants UI sont dans `src/components/ui/` et suivent les conventions shadcn. Les couleurs sémantiques sont définies dans `src/config/status-colors.ts` et `src/config/metier-colors.ts`. Les icônes utilisent lucide-react exclusivement.

### VI. Performance et Optimisation
Les listes longues utilisent la virtualisation (@tanstack/react-virtual). Les données critiques sont préchargées via `src/lib/preload-critical-data.ts`. Les composants sont optimisés avec React.memo et useMemo/useCallback quand approprié. Les images sont optimisées via Next.js Image avec les patterns Supabase configurés. Le webpack watch exclut les répertoires non nécessaires en développement.

### VII. Sécurité et RLS (Row Level Security)
Toutes les tables Supabase utilisent RLS (Row Level Security). Les politiques RLS sont définies dans les migrations SQL. L'authentification passe par Supabase Auth avec JWT. Les clés de service (`SUPABASE_SERVICE_ROLE_KEY`) ne sont jamais exposées côté client. Les validations côté serveur complètent toujours les validations côté client.

## Architecture Technique

### Stack Technologique
- **Framework** : Next.js 15.5+ (App Router)
- **React** : 18.3+ avec Server Components
- **TypeScript** : 5+ en mode strict
- **Styling** : Tailwind CSS 3.4+ avec CSS Variables
- **UI** : shadcn/ui (Radix UI primitives)
- **State Management** : React Query 5.90+ pour les données serveur, Zustand pour l'état client local
- **Base de données** : Supabase (PostgreSQL) avec migrations SQL
- **Authentification** : Supabase Auth (JWT)
- **Cartographie** : MapLibre GL + MapTiler SDK
- **Tests** : Vitest + Testing Library

### Structure des Imports
```typescript
// ✅ CORRECT - Utiliser l'alias @/
import { interventionsApiV2 } from '@/lib/api/v2/interventionsApi';
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';
import { Button } from '@/components/ui/button';

// ❌ INCORRECT - Imports relatifs interdits
import { something } from '../../../lib/api';
import { Component } from '../components/Component';
```

### Structure des Dossiers
```
src/
├── components/          # Composants React réutilisables
│   ├── ui/            # Composants shadcn/ui
│   └── [feature]/     # Composants par domaine métier
├── hooks/             # Hooks personnalisés React Query
├── lib/
│   ├── api/v2/        # APIs modulaires par domaine
│   └── utils/         # Utilitaires partagés
├── config/            # Configuration (couleurs, statuts, etc.)
└── types/             # Types TypeScript partagés
```

## Conventions de Code

### Composants React
- Utiliser des Server Components par défaut, Client Components uniquement si nécessaire (`"use client"`)
- Props typées avec des interfaces TypeScript
- Utiliser `useMemo` et `useCallback` pour optimiser les recalculs
- Les composants UI suivent les conventions shadcn/ui

### Gestion des Erreurs
- Les APIs retournent `{ data, error }` selon le pattern Supabase
- Les erreurs sont typées et gérées dans les hooks React Query
- Les composants affichent des messages d'erreur utilisateur-friendly
- Les erreurs critiques sont loggées côté serveur

### Validation des Données
- Utiliser le système centralisé de validation pour toute donnée métier
- Les formulaires utilisent react-hook-form avec zod pour la validation côté client
- La validation serveur complète toujours la validation client
- Les règles de validation sont définies une seule fois dans `scripts/data-processing/validation/`

## Base de Données

### Migrations SQL
- Toutes les migrations sont dans `supabase/migrations/`
- Format de nommage : `YYYYMMDDHHMMSS_description.sql`
- Les migrations incluent les politiques RLS nécessaires
- Les migrations sont réversibles quand possible

### RLS (Row Level Security)
- Toutes les tables publiques ont RLS activé
- Les politiques permettent l'accès selon le rôle utilisateur
- Les utilisateurs ne peuvent accéder qu'à leurs propres données sauf si admin
- Les admins ont des politiques spécifiques pour l'accès global

## Workflow de Développement

### Ajout d'une Nouvelle Fonctionnalité
1. Créer les types TypeScript dans le module API approprié
2. Implémenter les fonctions API dans `src/lib/api/v2/[domain]Api.ts`
3. Créer les hooks React Query dans `src/hooks/use[Domain]Query.ts`
4. Créer les composants UI dans `src/components/[domain]/`
5. Ajouter les validations dans `scripts/data-processing/validation/` si nécessaire
6. Créer les migrations SQL si le schéma change

### Tests
- Tests unitaires avec Vitest pour la logique métier
- Tests d'intégration pour les APIs
- Tests E2E avec Playwright pour les flux critiques
- Les tests sont dans le dossier `tests/`

## Performance

### Optimisations Requises
- Virtualisation pour les listes > 100 éléments
- Preloading des données critiques au chargement
- Code splitting automatique via Next.js
- Images optimisées avec Next.js Image
- Cache React Query configuré avec des TTL appropriés

### Monitoring
- Web Vitals trackés via `src/analytics/webvitals.ts`
- Erreurs loggées côté serveur
- Performance monitoring en production

## Sécurité

### Secrets et Variables d'Environnement
- Jamais de secrets dans le code source
- Utiliser `.env.local` pour le développement local
- Les variables `NEXT_PUBLIC_*` sont exposées côté client
- Les clés de service restent côté serveur uniquement

### Authentification
- Supabase Auth avec JWT
- Les tokens sont vérifiés sur chaque requête API
- Les routes protégées vérifient l'authentification
- Les rôles utilisateur sont gérés via Supabase Auth

## Governance

Cette constitution est la référence absolue pour toutes les décisions techniques. Toute déviation doit être documentée et justifiée. Les PRs doivent vérifier la conformité avec cette constitution. Les amendements nécessitent une discussion et une mise à jour de ce document.

**Version**: 1.0.0 | **Ratifié**: 2025-01-16 | **Dernière modification**: 2025-01-16
