# Quickstart for Collaborators

Suivez ces étapes (macOS/Linux) pour lancer l’app localement avec des données de démo.

## Prérequis
- Node 20 (nvm: `nvm use v20`)
- npm
- Supabase CLI (recommandé) ou Postgres local

## Installation rapide (5 minutes)

```
git clone <repo>
cd CRM_template
cp .env.example .env.local
npm ci
npm run setup
npm run db:init
npm run db:seed
npm run dev
```

- Application: http://localhost:3000
- Attendu: page d’accueil avec données (seed) visibles.

## Base de données
- Option A: Supabase CLI. Les scripts `db:*` démarrent et appliquent les migrations.
- Option B: Postgres local. Définir `DATABASE_URL` dans `.env.local`.
- Reset: `npm run db:reset` (destructif, confirmation demandée).

## Scripts utiles
- setup: installe les deps, vérifie l’environnement
- db:init: démarre Supabase local et applique migrations
- db:seed: insère des données de démonstration
- db:reset: réinitialise la base (destructif)
- lint: ESLint
- typecheck: TypeScript
- test: Vitest

## Dépannage
- Ports occupés: arrêtez Supabase (`supabase stop`) ou Docker.
- Docker non démarré: démarrez Docker Desktop.
- Variables manquantes: vérifiez `.env.local`.

## Sécurité
- Ne commitez jamais de secrets. Utilisez `.env.local`.
- En cas de fuite, faites une rotation des clés et invalidez les tokens.
