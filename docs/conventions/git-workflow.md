# Workflow Git

> Conventions Git et processus de contribution pour GMBS-CRM.

---

## Commits conventionnels

Le projet utilise la convention [Conventional Commits](https://www.conventionalcommits.org/) pour les messages de commit.

### Format

```
type(scope?): description courte

Corps optionnel avec plus de détails.
```

### Types de commit

| Type | Description | Exemple |
|------|-------------|---------|
| `feat` | Nouvelle fonctionnalité | `feat: ajouter filtres avancés sur la page artisans` |
| `fix` | Correction de bug | `fix: corriger le calcul de marge pour le 2e artisan` |
| `refactor` | Restructuration sans changement fonctionnel | `refactor: extraire la logique de cache dans un module séparé` |
| `chore` | Tâches de maintenance | `chore: mettre a jour les dépendances Radix UI` |
| `test` | Ajout ou modification de tests | `test: ajouter tests pour cumulative-validation` |
| `docs` | Documentation | `docs: documenter le workflow de migration` |
| `style` | Formatage, pas de changement logique | `style: corriger l'indentation du composant Modal` |
| `perf` | Amélioration de performance | `perf: virtualiser la table artisans` |
| `ci` | Configuration CI/CD | `ci: corriger OOM vitest sur GitHub Actions` |

### Scope optionnel

Le scope précise la zone affectée :

```
feat(interventions): ajouter la vue timeline
fix(auth): corriger la résolution username -> email
refactor(api): migrer vers l'API v2
test(workflow): couvrir les transitions de statut
fix(ci): corriger lint error scripts/
```

### Bonnes pratiques

- Le message décrit le "quoi" et le "pourquoi", pas le "comment"
- Cohérence linguistique par PR (français ou anglais)
- Première ligne : 72 caractères maximum
- Corps : détails si nécessaire, séparé par une ligne vide

---

## Branches

### Branches principales

| Branche | Rôle |
|---------|------|
| `main` | Production stable |
| `develop` | Intégration des features (si utilisé) |

### Branches de travail

| Pattern | Usage | Exemple |
|---------|-------|---------|
| `feature/description` | Nouvelle fonctionnalité | `feature/pop_up_intervention_` |
| `fix/description` ou `fix_*` | Correction de bug | `fix_login_redirect` |
| `audit_*` | Audit ou review | `audit_preview_pop_inter` |

---

## CI/CD

### Pipeline GitHub Actions

Le fichier `.github/workflows/ci.yml` définit 4 jobs :

```
Déclencheurs: push (main, develop, fix_*) + PR (main, develop)

Jobs parallèles:
  lint       → npm run lint
  typecheck  → npm run typecheck
  test       → npm run test (NODE_OPTIONS='--max-old-space-size=4096')

Job séquentiel:
  build      → npm run build (après lint + typecheck + test)
             → nécessite secrets: SUPABASE_URL, SUPABASE_ANON_KEY, MAPTILER_KEY
```

### Exigences CI

Avant merge, tous les jobs doivent passer :
- **Lint** : aucune erreur ESLint
- **Typecheck** : aucune erreur TypeScript
- **Test** : tous les tests Vitest passent
- **Build** : le build Next.js compile sans erreur

---

## Processus de Pull Request

### Avant de créer une PR

1. S'assurer que la branche est a jour avec `main`
2. Vérifier localement :
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   ```
3. Relire les changements (`git diff main...HEAD`)

### Contenu de la PR

- Titre descriptif suivant les conventions de commit
- Description expliquant le contexte et les changements
- Screenshots si modifications UI
- Référence aux issues liées

### Review

- Au moins une review avant merge
- Les commentaires doivent être traités ou discutés
- Le CI doit être vert

---

## Fichiers sensibles

### Ne jamais committer

| Fichier | Raison |
|---------|--------|
| `.env` / `.env.local` | Variables d'environnement avec secrets |
| `user-credentials*.json` | Credentials d'authentification |
| Données clients | Information personnelle |
| `*.log` | Fichiers de log |

Le `.gitignore` du projet exclut ces fichiers. Vérifier avant chaque commit que des fichiers sensibles ne sont pas inclus.

---

## Commandes Git utiles

```bash
# Voir les changements par rapport a main
git diff main...HEAD

# Voir les commits de la branche
git log main..HEAD --oneline

# Rebase interactif sur main
git rebase -i main

# Créer une branche depuis main
git checkout -b feature/ma-feature main
```
