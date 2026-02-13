# Quick Start

Guide de mise en route pour lancer GMBS-CRM en local en 5 minutes.

---

## Prerequis

| Outil | Version | Verification |
|-------|---------|--------------|
| **Node.js** | 20.x ou 22.x | `node -v` |
| **npm** | >= 9 | `npm -v` |
| **Git** | >= 2.x | `git -v` |
| **Supabase CLI** | >= 2.40 | `supabase --version` |

Le projet utilise `npm` comme gestionnaire de paquets (pas de yarn ni pnpm).

---

## 1. Cloner le repository

```bash
git clone git@github.com:AndreBertea/gmbs-crm.git
cd gmbs-crm
```

---

## 2. Installer les dependances

```bash
npm install --legacy-peer-deps
```

Le flag `--legacy-peer-deps` est necessaire car certains packages Radix UI et shadcn/ui ont des peer dependencies conflictuelles entre React 18 et React 19.

---

## 3. Configurer les variables d'environnement

Creer un fichier `.env.local` a la racine du projet avec les variables suivantes :

```bash
# Supabase - Configuration principale
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...votre-anon-key

# Supabase - Cle serveur (routes API, middleware)
SUPABASE_SERVICE_ROLE_KEY=eyJ...votre-service-role-key

# MapTiler - Cartographie (optionnel en dev)
NEXT_PUBLIC_MAPTILER_API_KEY=votre-cle-maptiler

# URL du site (optionnel en dev, defaut: http://localhost:3000)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Variables obligatoires

| Variable | Usage | Ou la trouver |
|----------|-------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de l'instance Supabase | Dashboard Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle publique (anon) pour le client browser | Dashboard Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle serveur (bypass RLS) pour les routes API | Dashboard Supabase > Settings > API |

### Variables optionnelles

| Variable | Usage | Defaut |
|----------|-------|--------|
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Affichage des cartes MapLibre GL | Pas de carte affichee |
| `NEXT_PUBLIC_SITE_URL` | URL de base du site | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` | URL des Edge Functions (si differente) | Derive de `SUPABASE_URL` |

### Avec Supabase local

Si vous utilisez Supabase en local, les valeurs par defaut fonctionnent sans configuration :

```bash
# Ces valeurs sont les defauts du fichier src/lib/env.ts
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Pour demarrer Supabase en local :

```bash
supabase start
```

---

## 4. Lancer le serveur de developpement

```bash
npm run dev
```

Le serveur demarre sur [http://localhost:3000](http://localhost:3000). La page `/` redirige automatiquement vers `/login` si aucun token de session n'est present.

---

## 5. Verifier l'installation

```bash
# Verification des types TypeScript
npm run typecheck

# Lancement du linter
npm run lint

# Lancement des tests unitaires
npm run test
```

Si les 3 commandes passent sans erreur, l'installation est correcte.

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de developpement (Next.js) |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production (apres build) |
| `npm run test` | Lancer les tests unitaires (Vitest) |
| `npm run test:watch` | Tests en mode watch |
| `npm run lint` | Linter ESLint |
| `npm run typecheck` | Verification TypeScript |
| `npm run types:generate` | Regenerer les types Supabase |
| `npm run deploy:functions` | Deployer les Edge Functions |

### Scripts d'import de donnees

| Commande | Description |
|----------|-------------|
| `npm run import:all` | Import complet depuis Google Sheets |
| `npm run import:interventions` | Import interventions uniquement |
| `npm run import:artisans` | Import artisans uniquement |

### Scripts d'export

| Commande | Description |
|----------|-------------|
| `npm run export:to-excel` | Export vers Google Sheets |
| `npm run export:interventions-csv` | Export interventions en CSV |

---

## Prochaines etapes

- [Vue d'ensemble du projet](./project-overview.md) pour comprendre les modules principaux
- [Structure des dossiers](./folder-structure.md) pour naviguer dans le code
- [Stack technique](./tech-stack.md) pour comprendre les technologies utilisees
