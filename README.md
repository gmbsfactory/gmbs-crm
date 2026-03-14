# GMBS-CRM

CRM pour la gestion des interventions, artisans et clients dans le secteur du bâtiment.

> Dernière mise à jour : 2026-03-13 - branche feat00001

## Stack technique

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | Next.js 15, React 18, TypeScript 5, Tailwind CSS, shadcn/ui |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| **State** | TanStack Query v5 (serveur), Zustand (UI), React Context (scope) |
| **Tests** | Vitest, React Testing Library, Playwright (E2E) |
| **Cartographie** | MapLibre GL, MapTiler, OpenCage/Nominatim |

## Installation rapide

```bash
git clone git@github.com:AndreBertea/gmbs-crm.git
cd gmbs-crm
cp .env.example .env.local
npm ci
npm run dev
```

**Prérequis** : Node 20+, npm 9+, Supabase CLI 2.40+

→ Guide complet : [`docs/getting-started/quick-start.md`](docs/getting-started/quick-start.md)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run test` | Lancer les tests (Vitest) |
| `npm run test:watch` | Tests en mode watch |
| `npm run lint` | Linter ESLint |
| `npm run typecheck` | Vérification TypeScript |

## Documentation

La documentation complète du projet est dans [`docs/`](docs/README.md) :

| Section | Description |
|---------|-------------|
| [Getting Started](docs/getting-started/) | Installation, structure du projet, stack technique |
| [Architecture](docs/architecture/) | Data flow, API layer, realtime, state management, auth, workflow |
| [Guides](docs/guides/) | Ajouter une feature, créer un endpoint, écrire des tests, formulaires, carte |
| [API Reference](docs/api-reference/) | Interventions, artisans, users, documents, settings, query keys, edge functions |
| [Components](docs/components/) | Composants UI, intervention, artisan, patterns partagés |
| [Database](docs/database/) | Schéma, migrations, politiques RLS |
| [Conventions](docs/conventions/) | Standards de code, nommage, git workflow, tests |
| [Maintenance](docs/maintenance/) | Troubleshooting, performance, monitoring, mises à jour |
| [AI Integration](docs/ai-integration/) | Cursor rules, Copilot instructions, agent guidelines |

**Pour les agents AI** : voir [`CLAUDE.md`](CLAUDE.md) et [`llms.txt`](llms.txt)

## Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de l'instance Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase (côté serveur uniquement) |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Clé MapTiler (cartographie) |
| `OPENCAGE_API_KEY` | Clé OpenCage (géocodage, optionnel) |

> Ne jamais commiter de secrets. Utiliser `.env.local` pour les valeurs privées.

## Sécurité

- Authentification Supabase (JWT) avec RLS sur toutes les tables
- Middleware Next.js pour la protection des routes
- RBAC (rôles et permissions) géré en base
- CSP (Content Security Policy) configurée

## Licence

Projet privé — GMBS © 2025-2026
