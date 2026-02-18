# Documentation GMBS-CRM

CRM pour la gestion des interventions, artisans et clients. Stack : Next.js 15, React 18, TypeScript 5, Supabase, TanStack Query v5, Zustand, Tailwind CSS, shadcn/ui.

---

## Quick Navigation

### Getting Started

Prise en main du projet pour les nouveaux developpeurs.

| Page | Description |
|------|-------------|
| [Vue d'ensemble du projet](getting-started/project-overview.md) | Contexte metier, objectifs et perimetre fonctionnel |
| [Quick Start](getting-started/quick-start.md) | Installation, configuration et premier lancement |
| [Structure du projet](getting-started/folder-structure.md) | Organisation des dossiers, conventions de nommage |
| [Stack technique](getting-started/tech-stack.md) | Technologies utilisees, versions et justifications |

---

### Architecture

Conception technique du systeme, flux de donnees et patterns architecturaux.

| Page | Description |
|------|-------------|
| [Flux de donnees](architecture/data-flow.md) | Du composant a PostgreSQL, cache, realtime, sync cross-tab |
| [Couche API](architecture/api-layer.md) | API v2, facade, modules, pattern d'appel |
| [Synchronisation Realtime](architecture/realtime-sync.md) | Cache sync, broadcast, conflict detection, enrichment |
| [State Management](architecture/state-management.md) | TanStack Query vs Zustand vs Context vs URL |
| [Authentification et Securite](architecture/auth-and-security.md) | Auth Supabase, RBAC, RLS, middleware |
| [Workflow Engine](architecture/workflow-engine.md) | Machine a etats des interventions, transitions, validation cumulative |

---

### Authentification

Documentation de la migration et du systeme d'authentification.

| Page | Description |
|------|-------------|
| [Migration SSR](authentification/supabase_ssr_migration.md) | Plan de migration de cookies custom vers @supabase/ssr (sessions cookie) |

---

### Guides

Guides pratiques pour les cas d'usage courants du developpement.

| Page | Description |
|------|-------------|
| [Ajouter une feature](guides/adding-a-feature.md) | Processus complet : composant, hook, API, tests, documentation |
| [Creer un endpoint API](guides/creating-an-api-endpoint.md) | Ajout d'un module API v2, Edge Function, route Next.js |
| [Ecrire des tests](guides/writing-tests.md) | Tests unitaires, integration, E2E, mocks, couverture |
| [Travailler avec les formulaires](guides/working-with-forms.md) | React Hook Form + Zod, validation, patterns |
| [Utiliser la carte](guides/using-the-map.md) | MapLibre GL, geocodage, markers, interactions |
| [Gerer la base de donnees](guides/managing-database.md) | Migrations Supabase, types, seeds |
| [Gestion des erreurs](guides/error-handling.md) | ErrorHandler, boundaries, patterns |

---

### API Reference

Reference technique des modules API, hooks et Edge Functions.

| Page | Description |
|------|-------------|
| [Interventions API](api-reference/interventions.md) | CRUD, statuts, couts, stats, filtres (5 sous-modules) |
| [Artisans API](api-reference/artisans.md) | CRUD, metiers, zones, absences, statuts |
| [Users API](api-reference/users.md) | Auth, roles, permissions, gestion utilisateurs |
| [Documents API](api-reference/documents.md) | Upload, stockage Supabase Storage, types supportes |
| [Settings API](api-reference/settings.md) | Agencies, enums, metiers, roles |
| [Query Keys Reference](api-reference/query-keys.md) | Reference complete des query keys TanStack Query |
| [Edge Functions](api-reference/edge-functions.md) | 13+ fonctions Deno, patterns, CORS, auth, logging |

---

### Components

Bibliotheque de composants et patterns UI.

| Page | Description |
|------|-------------|
| [Composants UI (shadcn)](components/ui-components.md) | 30+ composants de base : Button, Card, Dialog, etc. |
| [Composants Intervention](components/intervention-components.md) | Modal, Card, Views, Filters, Workflow |
| [Composants Artisan](components/artisan-components.md) | Modal, Card, formulaires, context menu |
| [Patterns partages](components/shared-patterns.md) | CommentSection, ErrorBoundary, TruncatedCell, etc. |

---

### Database

Schema, migrations et modele de donnees.

| Page | Description |
|------|-------------|
| [Schema de la base](database/schema.md) | Tables, relations, types, contraintes, diagramme ER |
| [Migrations](database/migrations.md) | 85 migrations SQL, conventions, bonnes pratiques |
| [Politiques RLS](database/rls-policies.md) | Row Level Security, policies par table |

---

### Navigation Clavier

Raccourcis clavier et navigation sans souris dans le CRM.

| Page | Description |
|------|-------------|
| [Vue d'ensemble](keyboard-navigation/README.md) | Tous les raccourcis, resume par page, architecture |
| [Guide developpeur](keyboard-navigation/developer-guide.md) | Reference des hooks, styles CSS, guide d'integration |

---

### Conventions

Regles et standards du projet.

| Page | Description |
|------|-------------|
| [Standards de code](conventions/coding-standards.md) | TypeScript strict, React, CSS/Tailwind |
| [Nommage des fichiers](conventions/file-naming.md) | Conventions de nommage, ou placer quoi |
| [Workflow Git](conventions/git-workflow.md) | Commits conventionnels, branches, PR |
| [Standards de tests](conventions/testing-standards.md) | Structure, nommage, mocks, couverture |

---

### Maintenance

Operations, monitoring et procedures de maintenance.

| Page | Description |
|------|-------------|
| [Problemes courants](maintenance/common-issues.md) | Troubleshooting et solutions |
| [Performance](maintenance/performance.md) | Optimisation, virtualisation, lazy loading |
| [Monitoring](maintenance/monitoring.md) | Logs, erreurs, metriques |
| [Mise a jour des dependances](maintenance/updating-dependencies.md) | npm audit, updates, breaking changes |

---

### AI Integration

Configuration des outils AI pour le developpement.

| Page | Description |
|------|-------------|
| [LLMs.txt](ai-integration/llms.txt) | Index structure pour agents LLM (pattern Stripe) |
| [Rules Cursor](ai-integration/cursor-rules.md) | Fichiers de regles pour Cursor IDE |
| [Instructions Copilot](ai-integration/copilot-instructions.md) | Configuration GitHub Copilot |
| [Agent Guidelines](ai-integration/agent-guidelines.md) | Guidelines pour Claude Code et autres agents |

---

## Pour les agents AI

- **CLAUDE.md** : [/CLAUDE.md](../CLAUDE.md) -- Reference rapide des conventions, architecture et regles du projet
- **llms.txt** : [/llms.txt](../llms.txt) -- Index structure de la documentation pour agents LLM

---

## Documentation historique

L'ancienne documentation (livrables, diagnostics, data-mapping, sync Google Sheets, fixes) a ete archivee dans [`archive/docs-legacy/`](../archive/docs-legacy/).

---

Derniere mise a jour : Fevrier 2026
Maintenu par : DD & H
