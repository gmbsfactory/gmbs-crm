# PLAN.md - Dashboard Orchestrateur Audit GMBS-CRM

> **LECTURE SEULE** pour les equipes. Modifie UNIQUEMENT par l'orchestrateur.
> Derniere mise a jour : 2026-02-10

---

## Score Global

| Metrique | Avant | Objectif | Actuel |
|----------|-------|----------|--------|
| Score Global | 35/100 | 75/100 | 35/100 |
| Problemes | 294 | <50 | 294 |
| Securite | 28/100 | 80/100 | 28/100 |
| Test Coverage | ~10% | 60%+ | ~10% |
| Code Quality | 4.9/10 | 7/10 | 4.9/10 |
| Architecture | 5.5/10 | 7.5/10 | 5.5/10 |
| UX Accessibilite | 72/100 | 85/100 | 72/100 |
| DevOps | 5/10 | 8/10 | 5/10 |

---

## Dashboard des Waves

### Wave 1 - INFRASTRUCTURE (Immediat, parallele)
<!-- WAVE:1 STATUS:pending PROGRESS:0/7 -->

| Equipe | Taches | Agents | Statut | Progression |
|--------|--------|--------|--------|-------------|
| DEVOPS | DEV-001, DEV-002, DEV-003, DEV-004, DEV-005, SEC-008 | 1 | pending | 0/6 |
| TEST-CORE | TEST-005 | 1 | pending | 0/1 |

**Critere de completion Wave 1 :** `npm install && npm run build` reussi apres pin des deps.

---

### Wave 2 - TESTS & SECURITE (Apres Wave 1, parallele)
<!-- WAVE:2 STATUS:blocked BLOCKED_BY:wave-1 PROGRESS:0/14 -->

| Equipe | Taches | Agents | Statut | Progression |
|--------|--------|--------|--------|-------------|
| TEST-CORE | TEST-001, TEST-002, TEST-003, TEST-004 | 3 | blocked | 0/4 |
| SECURITY | SEC-004, SEC-005, SEC-006, SEC-007, SEC-009, SEC-010 | 2 | blocked | 0/6 |
| CODE-QUALITY | CODE-005, CODE-007, CODE-008, CODE-001, CODE-002, CODE-003 | 2 | blocked | 0/6 |

**Critere de completion Wave 2 :** Tests passent, 0 vuln npm critique, headers securite actifs.

---

### Wave 3 - ARCHITECTURE & CODE AVANCE (Apres CODE-004)
<!-- WAVE:3 STATUS:blocked BLOCKED_BY:wave-2 PROGRESS:0/8 -->

| Equipe | Taches | Agents | Statut | Progression |
|--------|--------|--------|--------|-------------|
| ARCHITECTURE | ARCH-001, ARCH-002, ARCH-003, ARCH-004 | 2 | blocked | 0/4 |
| CODE-QUALITY | CODE-004, CODE-006, CODE-009, CODE-010 | 2 | blocked | 0/4 |

**Critere de completion Wave 3 :** interventionsApi.ts eclate, 0 `any` dans top 3 fichiers, cache consolide.

---

### Wave 4 - UX & TESTS AVANCES (Apres Waves 2-3)
<!-- WAVE:4 STATUS:blocked BLOCKED_BY:wave-2,wave-3 PROGRESS:0/6 -->

| Equipe | Taches | Agents | Statut | Progression |
|--------|--------|--------|--------|-------------|
| UX | UX-001, UX-002, UX-003 | 2 | blocked | 0/3 |
| TEST-CORE | TEST-006, TEST-007, TEST-008, TEST-009 | 2 | blocked | 0/4 |

**Critere de completion Wave 4 :** WCAG 80+, globals.css eclate, 60% coverage.

---

### Wave 5 - FINALISATION (Apres tout)
<!-- WAVE:5 STATUS:blocked BLOCKED_BY:wave-4 PROGRESS:0/5 -->

| Equipe | Taches | Type | Statut |
|--------|--------|------|--------|
| SECURITY | SEC-002 | Partiel (IA+humain) | blocked |
| SECURITY | SEC-003 | Partiel (IA+humain) | blocked |
| SECURITY | SEC-011 | Partiel (IA+humain) | blocked |
| DEVOPS | SEC-013 | Partiel (IA+humain) | blocked |
| ARCHITECTURE | PERF-001 | Partiel (IA+humain) | blocked |

**Critere de completion Wave 5 :** Edge Functions securisees, RLS restrictives, monitoring actif.

---

## Matrice de Conflits Fichiers

| Fichier Critique | Equipes | Strategie | Ordre |
|-----------------|---------|-----------|-------|
| `interventionsApi.ts` | TEST, CODE, ARCH | Sequentiel | TEST-001 -> CODE-004 -> ARCH-001 |
| `cache-sync.ts` | ARCH | Exclusif | ARCH-002 seul |
| `package.json` | DEVOPS | Exclusif Wave 1 | DEV-001 -> DEV-003 -> DEV-004 -> SEC-008 |
| `next.config.mjs` | SECURITY | Exclusif | SEC-004 seul |
| `globals.css` | UX | Exclusif | UX-001 seul |
| `vitest.config.ts` | TEST | Exclusif Wave 1 | TEST-005 seul |
| `.github/workflows/ci.yml` | DEVOPS | Exclusif | DEV-005 seul |
| `app/layout.tsx` | CODE, UX | Sequentiel | CODE-003 -> UX-002 |

---

## Graphe de Dependances

```
SEC-001 (humain)
  └─> SEC-002 (partiel)
       └─> TEST-007
            └─> SEC-011 (partiel)

DEV-001 ─┬─> TEST-005 ─┬─> TEST-001 ─┬─> CODE-001
          │             │             ├─> CODE-004 ─> ARCH-001
          │             │             └─> TEST-006 ─> ARCH-003 ─> PERF-001
          │             └─> TEST-008
          ├─> DEV-003
          ├─> DEV-004
          └─> SEC-008

CODE-002 (independant)
CODE-003 (independant)
CODE-005 (independant)
CODE-007 (independant)
CODE-008 (independant)

SEC-004 (independant)
SEC-005 (independant)
SEC-006 (independant)
SEC-007 (independant)
SEC-009 (independant)
SEC-010 ─> SEC-012 (humain)

ARCH-002 ─> ARCH-004
UX-001 (independant)
UX-002 (independant, apres Wave 2)
UX-003 (independant)

CODE-006 (apres ARCH-001)
CODE-009 (independant)
CODE-010 (independant)
TEST-009 (apres TEST-006, TEST-007, TEST-008)
SEC-013 (partiel, apres Wave 3)
```

---

## Branches Git

> **REGLE ABSOLUE** : JAMAIS de commit/push sur `main` ni `preview`.
> **Branche de reference** : `preview` (main a du retard).

| Equipe | Branche | Base |
|--------|---------|------|
| DEVOPS | `fix/audit-devops` | `preview` |
| TEST-CORE | `test/audit-coverage` | `preview` |
| SECURITY | `fix/audit-security` | `preview` |
| CODE-QUALITY | `fix/audit-code-quality` | `preview` |
| ARCHITECTURE | `refactor/audit-architecture` | `preview` |
| UX | `fix/audit-ux` | `preview` |

---

## Protocole de Merge

> **AUCUN merge vers main ou preview pendant l'audit.**

1. Chaque equipe travaille EXCLUSIVEMENT sur sa branche
2. Quand TOUT l'audit est termine (46 taches) :
   a. Revue complete de toutes les branches
   b. PR de chaque branche vers `preview` (PAS main)
   c. CI complete doit passer sur chaque PR
   d. Approbation humaine obligatoire avant merge
3. Plus tard : `preview` sera merge dans `main` separement

---

## Taches Humaines (voir HANDOFF.md)

| ID | Tache | Urgence | Statut |
|----|-------|---------|--------|
| SEC-001 | Rotation cles API exposees | CRITIQUE | pending |
| SEC-012 | MFA TOTP Supabase | Basse | pending |

---

## Journal des Evenements

| Date | Heure | Evenement | Agent |
|------|-------|-----------|-------|
| 2026-02-10 | -- | Initialisation du plan de correction | orchestrator |

---

## Fichiers de Reference

| Fichier | Contenu |
|---------|---------|
| `audit_fev/00_RAPPORT_EXECUTIF.md` | Rapport executif audit |
| `audit_fev/08_PLAN_CORRECTION.md` | Plan de correction detaille |
| `.claude/agents/code-architect.md` | Guide architecture 500L |
| `.claude/agents/audit-orchestrator.md` | Definition agent orchestrateur |
| `.claude/plans/team-*.md` | Trackers par equipe |
| `HANDOFF.md` | Instructions taches humaines |
