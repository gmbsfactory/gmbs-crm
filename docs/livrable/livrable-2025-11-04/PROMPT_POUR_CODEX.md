# 🤖 Prompt pour Codex - Livrable Interventions & Artisans

**Date de création** : 6 novembre 2025  
**Objectif** : Prompt complet pour démarrer l'implémentation du livrable

---

## 📋 PROMPT COMPLET POUR CODEX

Copier-coller le texte ci-dessous dans Codex :

---

# Context: Livrable Interventions & Artisans - Sprint 1

Bonjour Codex,

Je travaille sur un projet CRM (GMBS CRM) basé sur **Next.js 14 (App Router)**, **TypeScript**, **Supabase (PostgreSQL)**, et **React**. 

J'ai une documentation complète pour implémenter un nouveau livrable client avec **21 tâches** réparties sur **5 sprints** (7-8 semaines).

## 📂 Documentation disponible

Toute la documentation se trouve dans le dossier : **`docs/livrable-2025-11-04/`**

Voici les fichiers clés à consulter :

### 1. 🚀 Démarrage rapide
- **`README.md`** - Point d'entrée principal avec tous les liens
- **`TLDR_LIVRABLE_2025-11-04.md`** - L'essentiel en 2 minutes
- **`SPRINT_TRACKER.md`** - Suivi détaillé des sprints et tâches (LE FICHIER À METTRE À JOUR)

### 2. 📖 Documentation technique
- **`BUSINESS_RULES_2025-11-04.md`** - 18 règles métier avec exemples de code TypeScript/SQL
- **`ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md`** - 21 tâches analysées en détail
- **`WORKFLOW_REGLES_METIER.md`** - 10 workflows visuels (diagrammes Mermaid)
- **`TABLEAU_RECAPITULATIF_LIVRABLE.md`** - Vue tabulaire complète

### 3. 📄 Source
- **`livrable-specs-interventions-artisans_2025-11-04.html`** - Fichier HTML source du client

## 🎯 Mission actuelle : Sprint 1

Je veux démarrer le **Sprint 1** qui contient **5 tâches prioritaires** (durée : 7 jours).

### Tâches du Sprint 1 (par ordre de priorité) :

1. **AGN-001** : Référence agence obligatoire (1-2j, 🟡 Moyenne)
2. **INT-001** : Champs obligatoires à la création (0.5j, 🟢 Faible)
3. **INT-003** : Droits d'édition du champ Contexte (0.5j, 🟢 Faible)
4. **DEVI-001** : ID devis pré-requis pour "Devis envoyé" (1-2j, 🟡 Moyenne)
5. **ARC-001** : Commentaire obligatoire à l'archivage (2j, 🟡 Moyenne)

## 📋 Ce que je veux que tu fasses

### Étape 1 : Appropriation du contexte (5 min)
1. Lis **`SPRINT_TRACKER.md`** pour comprendre où on en est
2. Lis **`BUSINESS_RULES_2025-11-04.md`** pour les règles métier du Sprint 1 :
   - BR-AGN-001
   - BR-INT-001
   - BR-INT-002
   - BR-DEVI-001
   - BR-ARC-001
3. Consulte **`WORKFLOW_REGLES_METIER.md`** pour les workflows visuels

### Étape 2 : Planification
Propose-moi un **plan d'action détaillé** pour la première tâche (AGN-001) :
- Fichiers à créer/modifier
- Migrations SQL nécessaires
- Code TypeScript/React à implémenter
- Tests à écrire
- Ordre d'exécution

### Étape 3 : Implémentation
Une fois le plan validé, **implémente la tâche AGN-001** :

**Modifications attendues** :
1. **Migration BDD** : `supabase/migrations/[date]_add_reference_agence.sql`
   - Ajouter `reference_agence TEXT` à la table `interventions`
   - Créer table `agency_config` avec colonnes `agency_id`, `requires_reference`
   - Peupler pour ImoDirect, AFEDIM, Locoro

2. **Types TypeScript** : `src/types/intervention.ts`
   - Ajouter `reference_agence?: string` à l'interface

3. **Validation backend** : `app/api/interventions/route.ts`
   - Schéma Zod avec validation conditionnelle
   - Si agence IN ('ImoDirect', 'AFEDIM', 'Locoro') → reference_agence obligatoire

4. **Validation frontend** : `src/components/modals/NewInterventionModalContent.tsx`
   - Champ `reference_agence` avec validation dynamique
   - Message d'erreur clair

5. **Tests unitaires** : Créer fichier de test approprié

### Étape 4 : Mise à jour du tracker
Après chaque tâche complétée, **mets à jour `SPRINT_TRACKER.md`** :
- Passe le statut de ⏸️ à 🟡 (en cours) puis ✅ (terminé)
- Coche les items de la checklist
- Ajoute des notes si besoin

## 📐 Architecture du projet

### Structure actuelle (approximative)
```
/
├── app/
│   ├── api/
│   │   └── interventions/
│   │       ├── route.ts              ← POST/GET interventions
│   │       └── [id]/route.ts         ← PUT/DELETE intervention
│   └── interventions/
│       └── [id]/page.tsx
├── src/
│   ├── components/
│   │   └── modals/
│   │       ├── NewInterventionModalContent.tsx
│   │       └── InterventionModalContent.tsx
│   ├── types/
│   │   └── intervention.ts
│   ├── lib/
│   │   └── supabase-api-v2.ts
│   └── hooks/
│       └── useInterventions.ts
└── supabase/
    └── migrations/
        └── [date]_[description].sql
```

### Base de données (Supabase/PostgreSQL)

**Tables principales** :
- `interventions` : Interventions/jobs
- `artisans` : Artisans/contractors
- `agencies` : Agences clientes
- `intervention_statuses` : Statuts des interventions
- `users` : Utilisateurs du CRM

**Schéma actuel de `interventions`** (partiel) :
```sql
CREATE TABLE interventions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_inter text UNIQUE,
  agence_id uuid REFERENCES agencies(id),
  statut_id uuid REFERENCES intervention_statuses(id),
  metier_id uuid REFERENCES metiers(id),
  adresse text,
  contexte_intervention text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 🔧 Stack technique

- **Frontend** : Next.js 14 (App Router), React 18, TypeScript
- **UI** : Shadcn/ui, Tailwind CSS, Lucide Icons
- **Validation** : Zod (backend), React Hook Form (frontend)
- **Base de données** : Supabase (PostgreSQL)
- **API** : Next.js API Routes (App Router)

## ⚠️ Points d'attention

### Règles métier critiques

1. **BR-AGN-001** : Référence agence obligatoire pour 3 agences
   ```typescript
   const agenciesRequiringRef = ['ImoDirect', 'AFEDIM', 'Locoro'];
   if (agenciesRequiringRef.includes(agence.name) && !reference_agence) {
     throw new Error('Référence agence obligatoire');
   }
   ```

2. **BR-INT-001** : 5 champs obligatoires
   - Adresse, Contexte, Métier, Statut, Agence

3. **BR-INT-002** : Contexte en lecture seule après création (sauf admin)

4. **BR-DEVI-001** : Pas d'ID devis → Pas de statut "Devis envoyé"

5. **BR-ARC-001** : Commentaire obligatoire à l'archivage

### Conventions

- **Migrations** : Format `YYYYMMDD_description.sql` (ex: `20251106_add_reference_agence.sql`)
- **Nommage BDD** : snake_case (ex: `reference_agence`)
- **Nommage TS** : camelCase (ex: `referenceAgence`)
- **Commits** : Format conventionnel (ex: `feat(interventions): add reference_agence field`)

## 🎯 Objectif final du Sprint 1

À la fin du Sprint 1, je veux avoir :
- ✅ 5 migrations BDD appliquées et testées
- ✅ Validations frontend/backend fonctionnelles
- ✅ Règles métier implémentées correctement
- ✅ `SPRINT_TRACKER.md` à jour avec toutes les tâches complétées
- ✅ Zéro régression sur les fonctionnalités existantes

## 📝 Format de réponse attendu

Pour chaque tâche, j'attends :

1. **📋 Plan d'action** (avant implémentation)
   - Liste des fichiers à créer/modifier
   - Ordre d'exécution
   - Dépendances

2. **💻 Code complet** (implémentation)
   - Migration SQL
   - Types TypeScript
   - Code frontend/backend
   - Tests

3. **✅ Checklist de validation**
   - Comment tester manuellement
   - Scénarios de test
   - Points de vérification

4. **📊 Mise à jour du tracker**
   - Statut mis à jour
   - Checklist cochée
   - Notes ajoutées

## 🚀 Question de démarrage

Peux-tu :
1. Confirmer que tu as bien accès au dossier `docs/livrable-2025-11-04/` et que tu as lu les fichiers clés ?
2. Me proposer un plan d'action détaillé pour la tâche **AGN-001** ?
3. Identifier les fichiers existants que je dois te montrer pour commencer ?

---

**Merci de ton aide ! Commençons par AGN-001 et avançons tâche par tâche.** 🚀

---

## 📎 Fichiers annexes

Si besoin de plus de contexte, voici d'autres fichiers disponibles :
- `RESUME_EXECUTIF_LIVRABLE_2025-11-04.md` - Vue d'ensemble complète
- `INDEX_LIVRABLE_2025-11-04.md` - Index de navigation
- `FICHIERS_CREES_2025-11-04.md` - Inventaire des fichiers

---

**Note importante** : Après chaque tâche, je veux que tu mettes à jour `SPRINT_TRACKER.md` avec le statut, les notes, et les checkboxes cochées et un commentaire si necessaire des taches effectuer et des lien utiles dans le projet. C'est notre source de vérité pour le suivi !

