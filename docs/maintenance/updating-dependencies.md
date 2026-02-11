# Mise a jour des dépendances

> Guide pour la mise a jour et la maintenance des dépendances npm de GMBS-CRM.

---

## Vue d'ensemble

Le projet comporte **96 dépendances de production** et **22 dépendances de développement**. Le runtime requis est **Node.js 20.x ou 22.x**.

---

## Vérification des vulnérabilités

### npm audit

```bash
# Vérifier les vulnérabilités connues
npm audit

# Corriger automatiquement les vulnérabilités (patches sûrs)
npm audit fix

# Forcer la correction (peut introduire des breaking changes)
npm audit fix --force
```

### Routine recommandée

Exécuter `npm audit` au minimum :
- Avant chaque release
- Une fois par semaine en développement actif
- Après chaque ajout de dépendance

---

## Mise a jour des dépendances

### Vérifier les mises a jour disponibles

```bash
# Voir les packages obsolètes
npm outdated
```

### Stratégie de mise a jour

| Type | Risque | Fréquence | Approche |
|------|--------|-----------|----------|
| Patch (x.y.Z) | Faible | Hebdomadaire | Automatique via `npm update` |
| Minor (x.Y.0) | Modéré | Bi-mensuel | Tester avant merge |
| Major (X.0.0) | Élevé | Selon besoin | Branch dédiée, tests complets |

### Mise a jour par lot (patches et minors)

```bash
# Mettre a jour dans les ranges du package.json
npm update

# Vérifier que rien n'est cassé
npm run lint && npm run typecheck && npm run test && npm run build
```

### Mise a jour d'une dépendance spécifique

```bash
# Installer une version spécifique
npm install <package>@<version> --legacy-peer-deps

# Exemple
npm install next@15.6.0 --legacy-peer-deps
```

---

## Dépendances critiques et breaking changes

### Next.js

**Version actuelle :** 15.5.7

Points de vigilance lors d'une mise a jour majeure :
- Changements dans le App Router
- Modifications du middleware
- Changements de la configuration webpack
- Compatibilité styled-components compiler

```bash
# Suivre le guide de migration officiel
# https://nextjs.org/docs/upgrading
```

### React

**Version actuelle :** 18.3.1

Le projet utilise React 18. Une migration vers React 19 nécessiterait :
- Vérification de compatibilité de toutes les librairies Radix UI
- Test des hooks custom (changements potentiels dans les effets)
- Vérification de react-hook-form et @tanstack/react-query

### Supabase

**Version actuelle :** @supabase/supabase-js 2.58

Points de vigilance :
- Changements dans l'API Realtime
- Modifications de l'authentification
- Compatibilité des Edge Functions avec la version du SDK

### TanStack Query

**Version actuelle :** 5.90

Points de vigilance :
- Changements dans les options de cache (staleTime, gcTime)
- Modifications des hooks (useQuery, useMutation)
- Rétro-compatibilité des query keys

### Radix UI

Le projet utilise **20+ packages Radix UI**. Ils sont généralement mis a jour ensemble :

```bash
# Mettre a jour tous les packages Radix
npm install @radix-ui/react-dialog@latest @radix-ui/react-popover@latest ...
```

Vérifier la compatibilité avec shadcn/ui après chaque mise a jour Radix.

### Tailwind CSS

**Version actuelle :** 3.4.17

Une migration vers Tailwind v4 nécessiterait :
- Réécriture de `tailwind.config.ts` (nouveau format)
- Vérification de toutes les classes utilitaires
- Migration du plugin `tailwindcss-animate`

---

## Processus de mise a jour majeure

### 1. Préparation

```bash
# Créer une branche dédiée
git checkout -b chore/update-<package>-v<version>

# Sauvegarder le lockfile actuel
cp package-lock.json package-lock.json.backup
```

### 2. Installation

```bash
npm install <package>@<version> --legacy-peer-deps
```

### 3. Vérification

```bash
# Toutes les vérifications doivent passer
npm run lint
npm run typecheck
npm run test
npm run build

# Vérification manuelle
npm run dev
# Tester les fonctionnalités clés dans le navigateur
```

### 4. Résolution des breaking changes

- Consulter le changelog de la dépendance
- Appliquer les modifications de code nécessaires
- Ajouter des tests si le comportement change

### 5. Merge

- Créer une PR avec un titre descriptif (`chore: update <package> to v<version>`)
- Documenter les breaking changes dans la description
- Attendre que le CI passe

---

## Dépendances a surveiller

### Potentiellement problématiques

| Dépendance | Raison |
|------------|--------|
| `framer-motion` | Mises a jour fréquentes avec breaking changes API |
| `reactflow` | API qui évolue rapidement |
| `maplibre-gl` | Changements d'API de rendu |
| `@prisma/client` | Listé mais possiblement inutilisé (a vérifier) |

### Peer dependencies

Le flag `--legacy-peer-deps` est utilisé car certaines dépendances ont des conflits de versions React. Ce flag est nécessaire tant que toutes les dépendances ne supportent pas la même version de React.

---

## Automatisation

### Dependabot / Renovate

Il est recommandé de configurer un bot de mise a jour automatique :

- **Dependabot** (GitHub natif) : crée des PR pour les mises a jour de sécurité
- **Renovate** : plus configurable, peut grouper les mises a jour

### Configuration recommandée

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      radix-ui:
        patterns:
          - "@radix-ui/*"
      tanstack:
        patterns:
          - "@tanstack/*"
```

---

## Commandes utiles

```bash
# Voir les dépendances obsolètes
npm outdated

# Vérifier les vulnérabilités
npm audit

# Mettre a jour les patches
npm update

# Trouver les packages inutilisés (outil externe)
npx depcheck

# Analyser la taille des dépendances
npx bundle-phobia <package-name>
```
