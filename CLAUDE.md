# CLAUDE.md - GMBS-CRM

## Contexte du projet

CRM pour la gestion des interventions, artisans et clients.
- **Stack** : Next.js 15, React 18, TypeScript 5, Supabase, TanStack Query, Tailwind CSS
- **Tests** : Vitest + React Testing Library + Playwright (E2E)
- **Score audit actuel** : 35/100 (objectif : 75/100)
- **Branche de référence** : `preview` (PAS `main` — main a du retard)

---

## RÈGLES GIT CRITIQUES — À RESPECTER PAR TOUS LES AGENTS

> **INTERDIT** : Commiter ou pusher sur `main`. AUCUNE exception.
> **INTERDIT** : Commiter ou pusher sur `preview`.
> **OBLIGATOIRE** : Tout travail d'audit se fait sur sa branche dédiée d'équipe.
> **MERGE FINAL** : Les branches d'audit seront PR vers `preview` UNIQUEMENT après validation complète de TOUT l'audit.

### Branche de référence

La branche `preview` est la référence actuelle du projet (main a du retard).
Quand un agent crée une branche, il doit la baser sur `preview` :
```bash
git checkout -b fix/audit-<equipe> preview
```

### Branches d'audit autorisées

| Équipe | Branche | Base |
|--------|---------|------|
| DEVOPS | `fix/audit-devops` | `preview` |
| TEST-CORE | `test/audit-coverage` | `preview` |
| SÉCURITÉ | `fix/audit-security` | `preview` |
| CODE QUALITY | `fix/audit-code-quality` | `preview` |
| ARCHITECTURE | `refactor/audit-architecture` | `preview` |
| UX | `fix/audit-ux` | `preview` |

### Workflow de merge

```
1. Agents travaillent sur leur branche d'équipe
2. Quand TOUT l'audit est terminé → revue complète
3. PR de chaque branche vers `preview` (pas main !)
4. CI doit passer sur chaque PR
5. Merge dans `preview` après approbation humaine
6. Plus tard : `preview` sera mergé dans `main`
```

---

## AUDIT EN COURS - Plan de correction orchestré

Un audit complet a identifié **294 problèmes** (59 critiques) répartis en 7 domaines. Un plan de correction de **46 tâches** est en cours d'exécution par des **équipes d'agents IA coordonnées**.

### Hiérarchie des équipes

```
ORCHESTRATEUR (Lead principal)
│   Rôle : Coordination globale, gestion des waves, résolution de conflits
│   Autorité : Seul agent autorisé à modifier PLAN.md
│
├── ÉQUIPE DEVOPS (Wave 1 - Infrastructure)
│   Branche : fix/audit-devops
│   Tâches : DEV-001 à DEV-005, SEC-008
│   Fichiers exclusifs : package.json, .github/workflows/ci.yml, .husky/
│
├── ÉQUIPE TEST-CORE (Waves 1-4 - Tests)
│   Branche : test/audit-coverage
│   Tâches : TEST-001 à TEST-009
│   Fichiers exclusifs : tests/**, vitest.config.ts
│
├── ÉQUIPE SÉCURITÉ (Wave 2 - Corrections sécurité)
│   Branche : fix/audit-security
│   Tâches : SEC-004 à SEC-010
│   Fichiers exclusifs : next.config.mjs, supabase/functions/*, src/lib/api/permissions.ts
│
├── ÉQUIPE CODE QUALITY (Waves 2-3 - Qualité code)
│   Branche : fix/audit-code-quality
│   Tâches : CODE-001 à CODE-010
│   Fichiers exclusifs : src/lib/realtime/sync-queue.ts, src/components/ErrorBoundary.tsx
│
├── ÉQUIPE ARCHITECTURE (Wave 3 - Refactoring)
│   Branche : refactor/audit-architecture
│   Tâches : ARCH-001 à ARCH-004
│   Fichiers exclusifs : Restructuration de interventionsApi.ts, cache-sync.ts
│
└── ÉQUIPE UX (Wave 4 - Accessibilité)
    Branche : fix/audit-ux
    Tâches : UX-001 à UX-003
    Fichiers exclusifs : app/globals.css, app/styles/*, src/components/ui/truncated-cell.tsx
```

### Fichiers du plan de correction

| Fichier | Rôle | Qui modifie |
|---------|------|-------------|
| `PLAN.md` | Dashboard global, waves, dépendances, métriques | Orchestrateur SEUL |
| `HANDOFF.md` | Instructions pour les tâches nécessitant un humain | Orchestrateur |
| `.claude/plans/team-devops.md` | Tracker tâches équipe DevOps | Équipe DEVOPS |
| `.claude/plans/team-test-core.md` | Tracker tâches équipe Tests | Équipe TEST-CORE |
| `.claude/plans/team-security.md` | Tracker tâches équipe Sécurité | Équipe SÉCURITÉ |
| `.claude/plans/team-code-quality.md` | Tracker tâches équipe Code Quality | Équipe CODE QUALITY |
| `.claude/plans/team-architecture.md` | Tracker tâches équipe Architecture | Équipe ARCHITECTURE |
| `.claude/plans/team-ux.md` | Tracker tâches équipe UX | Équipe UX |
| `.claude/agents/audit-orchestrator.md` | Définition et protocole de l'orchestrateur | Personne (référence) |
| `.claude/agents/code-architect.md` | Guide architecture 500 lignes (référence) | Personne (référence) |
| `audit_fev/08_PLAN_CORRECTION.md` | Plan de correction détaillé original | Personne (référence) |
| `audit_fev/00_RAPPORT_EXECUTIF.md` | Rapport exécutif de l'audit | Personne (référence) |

### Waves d'exécution

```
Wave 1 - INFRASTRUCTURE (immédiat)
  DEV-001: Fixer 19 deps "latest" → versions pinned
  DEV-002: Créer .env.example
  DEV-003: Setup Husky + lint-staged
  DEV-004: Supprimer dépendances inutilisées
  DEV-005: CI security scan + Dependabot
  SEC-008: npm audit fix (38 vulnérabilités)
  TEST-005: Installer @vitest/coverage-v8

Wave 2 - TESTS & SÉCURITÉ (après Wave 1)
  TEST-001 à TEST-004: Tests modules critiques
  SEC-004 à SEC-010: Corrections sécurité (INDÉPENDANTES - lançables en parallèle)
  CODE-005, CODE-007, CODE-008: Nettoyage code (DÉJÀ FAITS - commit f5e00a8)
  CODE-001 à CODE-003: Corrections critiques

Wave 3 - ARCHITECTURE (après Wave 2)
  ARCH-001 à ARCH-004: Découpage fichiers monolithiques
  CODE-004, CODE-006, CODE-009, CODE-010: Qualité avancée

Wave 4 - UX & TESTS AVANCÉS (après Waves 2-3)
  UX-001 à UX-003: CSS, accessibilité WCAG
  TEST-006 à TEST-009: Coverage 60%

Wave 5 - FINALISATION (tâches partielles IA+humain)
  SEC-002, SEC-003, SEC-011, SEC-013, PERF-001
```

### Matrice de conflits fichiers critiques

| Fichier | Équipes | Ordre obligatoire |
|---------|---------|-------------------|
| `interventionsApi.ts` (4351L) | TEST → CODE → ARCH | TEST-001 → CODE-004 → ARCH-001 |
| `package.json` | DEVOPS exclusif | DEV-001 → DEV-003 → DEV-004 → SEC-008 |
| `app/layout.tsx` | CODE → UX | CODE-003 → UX-002 |
| `cache-sync.ts` (980L) | ARCH exclusif | ARCH-002 seul |
| `globals.css` (4738L) | UX exclusif | UX-001 seul |
| `next.config.mjs` | SÉCURITÉ exclusif | SEC-004 seul |

### Protocole pour chaque agent

1. **Lis ton fichier équipe** : `.claude/plans/team-<ton-equipe>.md`
2. **Lis ce CLAUDE.md** pour les conventions
3. **Vérifie les dépendances** de ta tâche avant de commencer
4. **Lis le code source** AVANT de le modifier
5. **Écris des tests** pour chaque modification (obligatoire)
6. **Vérifie** : `npm run test && npm run build`
7. **Commite** avec format conventionnel : `fix(security): SEC-004 ajouter headers HTTP`
8. **Mets à jour** ton fichier équipe : `STATUS:pending` → `STATUS:completed`
9. **Ne touche PAS** aux fichiers des autres équipes

### Marqueurs HTML dans les fichiers équipe

Les fichiers `.claude/plans/team-*.md` utilisent des marqueurs parseable :
```html
<!-- TASK:SEC-004 STATUS:pending OWNER:none PRIORITY:critical WAVE:2 DEPENDS:none -->
<!-- TASK:SEC-004 STATUS:in_progress OWNER:agent-sec-1:2026-02-10T14:00:00Z -->
<!-- TASK:SEC-004 STATUS:completed OWNER:agent-sec-1:2026-02-10T15:30:00Z -->
```

---

## Politique de tests

### Règle fondamentale

**Toute nouvelle feature ou modification de code existant DOIT inclure des tests.**

### Structure des tests

```
tests/
├── unit/                    # Tests unitaires
│   ├── hooks/              # Tests des hooks custom
│   ├── lib/                # Tests des utilitaires/API
│   └── components/         # Tests des composants avec logique
├── integration/            # Tests d'intégration
├── e2e/                    # Tests end-to-end (Playwright)
├── __mocks__/              # Mocks Supabase et dépendances
│   ├── supabase.ts
│   └── supabase/supabase-mock-builder.ts
└── __fixtures__/           # Données de test
    └── interventions.ts
```

### Couverture attendue

| Priorité | Type | Couverture |
|----------|------|------------|
| Critique | Workflow/transitions de statuts | 100% |
| Critique | Calculs métier (marge, coûts) | 100% |
| Haute | Hooks custom | 80%+ |
| Haute | Fonctions API | 80%+ |
| Moyenne | Composants avec logique | 60%+ |
| Basse | Composants UI simples | Optionnel |

### Template de test

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('NomDuModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('nomDeLaFonction', () => {
    it('should <comportement nominal>', () => {
      // Arrange
      const input = createMockData()
      // Act
      const result = fonctionATest(input)
      // Assert
      expect(result).toEqual(expectedOutput)
    })
  })
})
```

### Mocks existants

- Mocks Supabase : `tests/__mocks__/supabase.ts` et `tests/__mocks__/supabase/supabase-mock-builder.ts`
- Fixtures données : `tests/__fixtures__/interventions.ts`
- Utiliser `vi.mock()` pour les dépendances externes

---

## Conventions de code

### TypeScript

- Strict mode activé
- Pas de `any` sauf cas exceptionnels documentés
- Interfaces pour les props, types pour les unions

### Composants React

- Functional components uniquement
- Hooks custom pour la logique réutilisable
- Props destructurées avec types explicites

### API & Data

- TanStack Query pour le cache client
- Supabase pour le backend
- Query keys centralisées dans `src/lib/react-query/queryKeys.ts`
- API V2 dans `src/lib/api/v2/` (API V1 legacy à supprimer)

### Git

- **INTERDIT** de commiter sur `main` ou `preview` — uniquement sur les branches d'audit
- Commits conventionnels : `feat:`, `fix:`, `chore:`, `refactor:`, `test:`
- Messages en français ou anglais (cohérent par PR)
- Pas de fichiers sensibles (credentials, .env, données clients)
- Branche de référence = `preview` (pas main)

---

## Architecture du projet

```
app/                          # Next.js App Router (pages)
├── (auth)/                  # Routes authentification
├── api/                     # API Routes (Next.js)
├── dashboard/               # Dashboard principal
├── interventions/           # Gestion interventions
├── artisans/                # Gestion artisans
├── admin/                   # Panel admin
├── globals.css              # Styles globaux (4738L → à éclater UX-001)
└── layout.tsx               # Layout racine (12 providers)

src/
├── components/              # 211 composants React
│   ├── ui/                 # Composants UI de base (Radix wrappers)
│   ├── interventions/      # Composants métier interventions
│   ├── artisans/           # Composants métier artisans
│   └── layout/             # Layout, sidebar, navigation
├── hooks/                   # 68 hooks custom
├── lib/
│   ├── api/v2/             # API modulaire V2 (18 fichiers)
│   │   ├── interventionsApi.ts  # 4351 lignes (God file → ARCH-001)
│   │   ├── artisansApi.ts       # 2443 lignes
│   │   └── common/             # Types, cache, utils partagés
│   ├── realtime/            # Synchronisation temps réel
│   │   ├── cache-sync.ts   # 980 lignes (→ ARCH-002)
│   │   └── sync-queue.ts   # Queue offline (syncModification vide → CODE-002)
│   ├── workflow/            # Moteur de workflow interventions
│   └── react-query/         # Configuration TanStack Query
├── providers/               # Context providers React
└── stores/                  # Zustand stores

supabase/
├── functions/               # 13 Edge Functions (Deno)
└── migrations/              # Migrations SQL

tests/                       # Tests (Vitest + Playwright)
```

## Fichiers critiques à ne pas casser

Ces fichiers sont au coeur du système — toute modification nécessite des tests :

1. `src/lib/api/v2/interventionsApi.ts` — API principale (4351L)
2. `src/lib/realtime/cache-sync.ts` — Synchronisation cache (980L)
3. `src/hooks/useInterventionsQuery.ts` — Query principale
4. `src/lib/api/permissions.ts` — RBAC et permissions
5. `supabase/functions/` — 13 Edge Functions

---

## Commandes utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm run test         # Lancer les tests
npm run test:watch   # Tests en mode watch
npm run lint         # Linter
npm run typecheck    # Vérification TypeScript
```

---

## Scores de l'audit (10 février 2026)

| Domaine | Score | Objectif |
|---------|-------|----------|
| Score Global | 35/100 | 75/100 |
| Sécurité OWASP | 28/100 | 80/100 |
| Couverture tests | ~10% | 60%+ |
| Qualité code | 4.9/10 | 7/10 |
| Architecture | 5.5/10 | 7.5/10 |
| UX/Accessibilité | 72/100 | 85/100 |
| DevOps | 5/10 | 8/10 |
