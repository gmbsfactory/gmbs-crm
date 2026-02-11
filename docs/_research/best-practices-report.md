# Rapport de Recherche : Best Practices de Documentation

> Analyse des patterns de documentation de Stripe, Supabase et Vercel
> Date : 2026-02-11 | Projet : GMBS-CRM

---

## 1. Analyse par source

### 1.1 Stripe — docs.stripe.com

#### Structure de la documentation
- **Hiérarchie à 3 niveaux** : Getting Started → Browse by Product → Feature Guides
- **Double taxonomie** : navigation par cas d'usage ("Accepter des paiements") ET par produit ("Payments", "Billing")
- Le même contenu est accessible via les deux chemins, réduisant la friction

#### Intégration AI/LLM
- **`/llms.txt`** : fichier d'index structuré avec 15+ catégories de produits et des liens vers chaque ressource. Contient une section "Instructions for Large Language Model Agents" avec des directives explicites (ex: "toujours préférer l'API moderne", "ne jamais recommander les APIs dépréciées")
- **Suffixe `.md`** : tout URL + `.md` retourne la version Markdown plain-text, optimisée pour la consommation LLM (moins de tokens, contenu caché inclus)
- **MCP Server** : serveur Model Context Protocol donnant aux agents AI un accès temps réel à la documentation et aux outils API
- **Agent Toolkit SDK** : SDK dédié pour les frameworks populaires

#### Patterns de rédaction
- Progression "problème business → solution technique"
- Exemples de code copy-pastable à chaque étape
- Tests et sandbox intégrés dans la doc

---

### 1.2 Stripe — Building with LLMs

#### Trois piliers pour la documentation AI-friendly
1. **Plain-text Markdown** : réduit les tokens de formatage, expose le contenu caché des onglets
2. **`llms.txt` standard** : convention émergente de fichier de découverte pour les agents AI
3. **MCP (Model Context Protocol)** : outils spécialisés pour les interactions API

#### Best practices clés
- Structurer le contenu en hiérarchie Markdown claire
- Éviter HTML/JS pour le scraping — utiliser des formats texte propres
- Révéler TOUT le contenu (y compris les onglets cachés) dans les versions plain-text
- Fournir des toolkits agent-spécifiques pour les frameworks populaires

---

### 1.3 Supabase — AI Prompts

#### Prompts AI pré-écrits
Supabase fournit **8 prompts curatés** pour les IDE AI :
1. Realtime AI Assistant Guide
2. Bootstrap Next.js app with Supabase Auth
3. Writing Edge Functions
4. Declarative Database Schema
5. Create RLS policies
6. Create database functions
7. Create migrations
8. Postgres SQL Style Guide

#### Pattern de fichiers de règles
- Fichiers copiables dans le repo du développeur
- Emplacements par IDE :
  - **Cursor** : `.cursor/rules/*.md`
  - **GitHub Copilot** : `.github/copilot-instructions.md`
  - **VS Code** : `.instructions.md`
  - **Windsurf/JetBrains** : `guidelines.md`

---

### 1.4 Supabase — Structure doc principale

#### Organisation
- **Navigation centrée produit** : Database, Auth, Storage, Realtime, Edge Functions
- **Quickstarts par framework** : React, Next.js, Vue, Flutter, Python — "pick your adventure"
- **Sections** : Start → Products → Build → Manage → Reference

#### Patterns remarquables
- Cards visuelles pour la découverte des produits
- Guides de migration depuis les concurrents (Firebase, Auth0, Heroku)
- API Reference orientée SDK plutôt que REST endpoints bruts
- Extensions Postgres comme modules découvrables (AI, Cron, Queues)

---

### 1.5 Vercel — AI & MCP

#### Documentation AI
- **AI SDK** : toolkit TypeScript unifié pour LLMs, avec exemples progressifs (text → structured data → tools)
- **MCP Servers** : documentation du standard Model Context Protocol, analogie "USB-C pour les AI"
- **Agent Resources** : intégrations pour modèles, marketplace AI
- **Architecture** : host → client → server, un client par service externe

#### Patterns remarquables
- Exemples de code avec diff highlighting pour montrer les changements entre providers
- Progression : concept simple → code minimal → cas avancé
- Templates et cookbooks comme ressources complémentaires

---

### 1.6 Vercel — Structure doc principale

#### Organisation
- **6 grandes catégories** : Build → Deploy → AI → Security → Scale → Collaborate
- **AI comme pilier central** : v0, AI SDK, AI Gateway, Agents, MCP, Sandbox
- **Progressive disclosure** : chaque section part d'un résumé puis offre des liens vers le détail

#### Patterns remarquables
- "AI Cloud" comme positionnement — l'AI est intégrée dans chaque section
- Toolbar et Comments pour la collaboration directe sur les deployments
- Feature flags documentés comme outil de déploiement progressif
- Sitemap structuré comme index de navigation

---

## 2. TOP 10 des Patterns à Adopter pour GMBS-CRM

### Pattern 1 : Fichier `llms.txt` à la racine

**Description** : Créer un fichier `/llms.txt` (ou `/docs/llms.txt`) qui sert d'index structuré pour les agents AI. Ce fichier liste toutes les ressources documentaires avec leurs URLs, organisées par catégorie, et contient des instructions explicites pour les LLMs.

**Pourquoi** : Stripe l'utilise avec succès — c'est un standard émergent qui permet aux agents AI (Claude, GPT, Copilot) de naviguer efficacement dans la documentation du projet.

**Exemple GMBS** :
```markdown
# GMBS-CRM Documentation

## Instructions for LLM Agents
Quand tu aides un développeur sur GMBS-CRM :
- Utilise toujours l'API v2 (src/lib/api/v2/) et non l'ancienne API
- Les transitions de statuts d'intervention suivent un workflow strict — consulte docs/guides/workflow-interventions.md
- Utilise TanStack Query pour le cache, jamais de state local pour les données serveur

## Getting Started
- [Installation](docs/getting-started/installation.md)
- [Architecture](docs/architecture/overview.md)

## API Reference
- [Interventions API](docs/api-reference/interventions.md)
- [Artisans API](docs/api-reference/artisans.md)
...
```

---

### Pattern 2 : Fichiers de règles AI par IDE (`.cursor/rules/`, `.github/copilot-instructions.md`)

**Description** : Fournir des fichiers de contexte AI spécifiques à chaque IDE, contenant les conventions, patterns et instructions du projet. Ces fichiers sont automatiquement chargés par les IDE AI.

**Pourquoi** : Supabase fournit 8 prompts curatés pour différents IDE. Cela garantit que tout développeur utilisant un assistant AI reçoit le bon contexte projet.

**Exemple GMBS** :
```
.cursor/rules/
  ├── supabase-queries.md      # Comment écrire les requêtes Supabase
  ├── intervention-workflow.md  # Règles métier des transitions
  ├── react-patterns.md        # Hooks custom, TanStack Query patterns
  └── testing-conventions.md   # Structure des tests, mocks
.github/copilot-instructions.md  # Instructions GitHub Copilot
CLAUDE.md                         # Instructions Claude Code (déjà existant)
```

---

### Pattern 3 : Documentation Markdown avec suffixe `.md` accessible

**Description** : Toute la documentation doit être en Markdown pur, stockée dans le repo, accessible facilement. Pas de wiki externe, pas de Notion — tout dans `/docs` versionné avec le code.

**Pourquoi** : Stripe permet l'accès `.md` à chaque page pour les LLMs. Pour un projet interne, stocker la doc en Markdown dans le repo garantit la cohérence avec le code et permet l'indexation par les AI.

**Exemple GMBS** :
```
docs/
├── getting-started/
│   ├── installation.md
│   ├── configuration.md
│   └── first-intervention.md
├── architecture/
│   ├── overview.md
│   └── data-model.md
├── api-reference/
│   ├── interventions.md
│   └── artisans.md
└── guides/
    ├── workflow-interventions.md
    └── deploiement.md
```

---

### Pattern 4 : Double navigation — Par rôle/tâche ET par module technique

**Description** : Organiser la documentation selon deux axes : (1) par tâche/rôle ("Je veux créer une intervention", "Je veux déployer") et (2) par module technique ("API Interventions", "Composants UI").

**Pourquoi** : Stripe utilise cette double taxonomie avec succès. Un nouveau développeur cherche par tâche, un développeur expérimenté cherche par module.

**Exemple GMBS** :
```markdown
## Par tâche (Getting Started & Guides)
- "Créer ma première intervention" → guide pas-à-pas
- "Ajouter un artisan" → guide pas-à-pas
- "Comprendre le workflow de statuts" → guide conceptuel

## Par module (API Reference & Architecture)
- interventionsApi.ts → référence complète
- useInterventionsQuery → hook reference
- Composant InterventionCard → props et usage
```

---

### Pattern 5 : Progressive Disclosure (Divulgation progressive)

**Description** : Structurer chaque page de doc du plus simple au plus complexe : résumé → usage basique → usage avancé → API complète. Ne jamais submerger le lecteur avec tous les détails d'entrée.

**Pourquoi** : Vercel et Stripe structurent chaque page ainsi. L'AI SDK de Vercel commence par `generateText()` simple, puis ajoute structured data, puis tools.

**Exemple GMBS** :
```markdown
# Interventions API

## Résumé
L'API Interventions gère le cycle de vie complet d'une intervention.

## Usage rapide
\`\`\`typescript
const interventions = await interventionsApi.getAll()
\`\`\`

## Filtrage et pagination
\`\`\`typescript
const filtered = await interventionsApi.getAll({
  status: 'en_cours',
  page: 1,
  limit: 20
})
\`\`\`

## API complète
[Voir la référence détaillée →](./interventions-reference.md)
```

---

### Pattern 6 : Exemples de code copy-pastable à chaque section

**Description** : Chaque concept documenté doit être accompagné d'un exemple de code fonctionnel, testé, et directement copiable. Pas de pseudo-code, pas de fragments incomplets.

**Pourquoi** : Les 3 entreprises analysées (Stripe, Supabase, Vercel) suivent cette règle. Vercel montre même le diff entre providers avec du syntax highlighting.

**Exemple GMBS** :
```markdown
## Créer une intervention

\`\`\`typescript
import { interventionsApi } from '@/lib/api/v2/interventionsApi'

const newIntervention = await interventionsApi.create({
  client_id: 'uuid-client',
  artisan_id: 'uuid-artisan',
  type: 'plomberie',
  description: 'Fuite robinet cuisine',
  date_prevue: '2026-03-01'
})

console.log(newIntervention.id) // uuid de la nouvelle intervention
\`\`\`
```

---

### Pattern 7 : Section "Instructions for AI Agents" dans la documentation

**Description** : Inclure dans `llms.txt` et `CLAUDE.md` une section explicite d'instructions pour les agents AI : quelles APIs préférer, quels patterns éviter, quelles erreurs communes ne pas commettre.

**Pourquoi** : Le `llms.txt` de Stripe contient des directives comme "ne jamais recommander l'API Charges dépréciée". Cela évite que les AI génèrent du code obsolète ou dangereux.

**Exemple GMBS** :
```markdown
## Instructions for AI Agents

Quand tu génères du code pour GMBS-CRM :
- TOUJOURS utiliser `src/lib/api/v2/` (jamais l'ancienne API v1)
- TOUJOURS utiliser les hooks TanStack Query (`useInterventionsQuery`)
  plutôt que des appels directs dans les composants
- Les query keys sont centralisées dans `src/lib/react-query/queryKeys.ts`
- NE JAMAIS modifier directement le statut d'une intervention —
  utiliser les fonctions de transition dans `src/lib/workflow/`
- Les tests sont OBLIGATOIRES pour toute nouvelle feature (voir CLAUDE.md)
- Pattern de composant : functional component + hook custom pour la logique
```

---

### Pattern 8 : Quickstarts par cas d'usage

**Description** : Fournir des guides "quickstart" courts (5-10 min de lecture) pour les cas d'usage les plus fréquents. Chaque quickstart part de zéro et arrive à un résultat fonctionnel.

**Pourquoi** : Supabase organise ses quickstarts par framework (Next.js, React, etc.). Stripe les organise par cas d'usage business. Les deux approches accélèrent l'onboarding.

**Exemple GMBS** :
```markdown
# Quickstart : Créer et suivre une intervention

## Prérequis
- Accès au projet GMBS-CRM configuré
- Variables d'environnement Supabase définies

## Étapes

### 1. Créer l'intervention (2 min)
[code...]

### 2. Suivre le workflow de statuts (3 min)
[code...]

### 3. Assigner un artisan (2 min)
[code...]

## Résultat
Vous avez créé une intervention complète avec un artisan assigné.
```

---

### Pattern 9 : Référence API exhaustive et structurée

**Description** : Pour chaque module API, fournir une page de référence structurée : description, paramètres (avec types), retour, erreurs possibles, exemples. Format consistent pour toutes les APIs.

**Pourquoi** : Stripe est le gold standard des API references. Supabase documente ses SDK par langage. La cohérence du format est clé.

**Exemple GMBS** :
```markdown
# interventionsApi.create()

Crée une nouvelle intervention dans le système.

## Paramètres

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| client_id | string (UUID) | Oui | ID du client |
| artisan_id | string (UUID) | Non | ID de l'artisan assigné |
| type | InterventionType | Oui | Type d'intervention |
| description | string | Oui | Description du problème |
| date_prevue | string (ISO) | Non | Date prévue |

## Retour
`Promise<Intervention>` — L'intervention créée avec son ID généré.

## Erreurs
| Code | Cause |
|------|-------|
| 400 | Paramètres manquants ou invalides |
| 404 | Client non trouvé |
| 403 | Permissions insuffisantes |

## Exemple
\`\`\`typescript
const intervention = await interventionsApi.create({...})
\`\`\`
```

---

### Pattern 10 : Documentation versionnée et co-localisée avec le code

**Description** : La documentation vit dans le même repo que le code, suit le même workflow Git (branches, PRs, reviews), et est mise à jour en même temps que le code qu'elle documente.

**Pourquoi** : Les 3 entreprises maintiennent leur doc dans des repos Git. Vercel pousse le concept avec des preview deployments pour la doc. Cela évite la doc obsolète — le plus grand ennemi de toute documentation.

**Exemple GMBS** :
```
gmbs-crm/
├── src/                    # Code source
├── tests/                  # Tests
├── docs/                   # Documentation (versionnée avec le code)
│   ├── README.md          # Index principal
│   ├── getting-started/
│   ├── architecture/
│   ├── api-reference/
│   ├── guides/
│   ├── ai-integration/   # Prompts AI, rules
│   └── _research/         # Recherches (ce fichier)
├── llms.txt               # Index pour agents AI
├── CLAUDE.md              # Instructions Claude Code
└── .cursor/rules/         # Rules pour Cursor AI
```

---

## 3. Recommandations pour la structure `/docs` de GMBS-CRM

### Structure recommandée

```
docs/
├── README.md                    # Index principal avec navigation
├── getting-started/
│   ├── installation.md          # Setup local du projet
│   ├── configuration.md         # Variables d'env, Supabase config
│   ├── premier-pas.md           # Tutoriel "première intervention"
│   └── structure-projet.md      # Vue d'ensemble des dossiers
│
├── architecture/
│   ├── overview.md              # Vue d'ensemble architecture
│   ├── data-model.md            # Schéma BDD, relations
│   ├── api-layers.md            # v1 vs v2, couches API
│   ├── state-management.md      # TanStack Query, cache, realtime
│   ├── authentication.md        # Auth Supabase, RLS, rôles
│   └── deployment.md            # CI/CD, environnements
│
├── api-reference/
│   ├── interventions.md         # CRUD + workflow
│   ├── artisans.md              # Gestion artisans
│   ├── clients.md               # Gestion clients
│   ├── devis.md                 # Devis et facturation
│   ├── documents.md             # Upload, stockage
│   ├── realtime.md              # Subscriptions temps réel
│   └── hooks.md                 # Hooks React custom
│
├── guides/
│   ├── workflow-interventions.md # Statuts, transitions, règles
│   ├── calculs-metier.md        # Marge, coûts, formules
│   ├── ajout-feature.md         # Comment ajouter une feature
│   ├── testing.md               # Stratégie et conventions de test
│   ├── troubleshooting.md       # Problèmes courants
│   └── migration-api.md         # Migration v1 → v2
│
├── components/
│   ├── overview.md              # Bibliothèque de composants
│   └── patterns.md              # Patterns UI récurrents
│
├── ai-integration/
│   ├── llms-context.md          # Contexte pour agents AI
│   ├── cursor-rules.md          # Rules Cursor
│   └── copilot-instructions.md  # Instructions Copilot
│
└── _research/
    └── best-practices-report.md  # Ce fichier
```

### Principes directeurs

1. **Markdown pur** — Pas de wiki externe, tout dans le repo
2. **Progressive disclosure** — Du simple au complexe dans chaque page
3. **Exemples concrets** — Code copy-pastable basé sur le vrai code du projet
4. **AI-first** — `llms.txt` à la racine, `CLAUDE.md` enrichi, rules par IDE
5. **Co-localisé** — Doc mise à jour dans la même PR que le code
6. **Double navigation** — Par tâche (guides) et par module (api-reference)
7. **Testé** — Les exemples de code de la doc doivent compiler

### Priorité d'implémentation

| Priorité | Fichiers | Raison |
|----------|----------|--------|
| P0 | `llms.txt`, `CLAUDE.md` enrichi | Impact immédiat sur la productivité AI |
| P0 | `getting-started/*` | Onboarding des nouveaux développeurs |
| P1 | `architecture/overview.md`, `data-model.md` | Compréhension du système |
| P1 | `api-reference/interventions.md` | Module le plus critique |
| P1 | `guides/workflow-interventions.md` | Logique métier critique |
| P2 | Reste de `api-reference/` | Couverture complète |
| P2 | `ai-integration/*` | Optimisation IDE |
| P3 | `components/`, autres guides | Nice-to-have |
