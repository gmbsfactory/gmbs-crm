# Implementation Plan: Système d'envoi d'email CRM

**Branch**: `004-mail` | **Date**: 2025-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-mail/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Permettre aux gestionnaires d'envoyer deux types d'emails aux artisans depuis le formulaire d'intervention :
- **Email de demande de devis** (visite technique)
- **Email de demande d'intervention**

Les boutons ouvrent un modal d'édition où l'utilisateur peut modifier le contenu, ajouter des pièces jointes, puis envoyer depuis le modal. L'envoi se fait via Gmail SMTP avec credentials utilisateur stockés de manière sécurisée (chiffrement AES-256-CBC). Les logs des envois sont enregistrés dans la base de données.

**Approche technique** : Intégration de nodemailer pour l'envoi SMTP, création d'un service email modulaire, ajout d'une route API Next.js pour l'envoi, création d'un composant modal React pour l'édition, et extension de la table `users` pour stocker les credentials email chiffrés.

## Technical Context

**Language/Version**: TypeScript 5+ (mode strict), Node.js 18+  
**Primary Dependencies**: 
- `nodemailer` (nouveau) + `@types/nodemailer` pour l'envoi SMTP
- `crypto` (Node.js built-in) pour le chiffrement AES-256-CBC
- Next.js 15.5+ App Router pour les routes API
- React 18.3+ avec shadcn/ui pour les composants UI
- Supabase (PostgreSQL) pour le stockage des credentials et logs

**Storage**: 
- Supabase PostgreSQL pour :
  - Table `users` : colonnes `email_smtp` (text) et `email_password_encrypted` (text)
  - Table `email_logs` : logs des envois avec statut, erreurs, métadonnées
- Fichier système : `public/logoGM.png` pour le logo inline automatique

**Testing**: 
- Vitest pour les tests unitaires (templates, service email, chiffrement)
- Tests d'intégration avec mock SMTP
- Tests manuels pour validation UX

**Target Platform**: 
- Backend : Next.js API Routes (Node.js runtime)
- Frontend : React/Next.js (navigateurs modernes)

**Project Type**: Web application (frontend + backend dans le même projet Next.js)

**Performance Goals**: 
- Envoi d'email synchrone : timeout backend 60s, timeout frontend 70s
- Retry automatique avec backoff exponentiel (3 tentatives max)
- Logs enregistrés de manière asynchrone (ne bloque pas la réponse)

**Constraints**: 
- Chiffrement obligatoire des mots de passe (AES-256-CBC)
- RLS (Row Level Security) activé sur toutes les tables
- Validation stricte des champs obligatoires avant envoi
- Gestion des erreurs réseau et rate limiting Gmail
- Logo GMBS automatiquement inclus dans tous les emails (non modifiable)

**Scale/Scope**: 
- 2 types d'emails (devis, intervention)
- 1 modal d'édition réutilisable
- 1 route API pour l'envoi
- 1 service email modulaire
- 2 templates HTML
- Configuration email dans Settings > Profile
- Logs consultables par utilisateur (admin voit tous les logs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Architecture Modulaire et API-First
- **Conforme** : La route API sera créée dans `app/api/interventions/[id]/send-email/route.ts` suivant le pattern Next.js App Router existant
- **Conforme** : Le service email sera dans `src/lib/services/email-service.ts` (nouveau module modulaire)
- **Conforme** : Les templates seront dans `src/lib/email-templates/intervention-emails.ts` (nouveau module)
- **Conforme** : Utilisation de l'alias `@/` pour tous les imports

### ✅ II. TypeScript Strict et Typage Fort
- **Conforme** : Tous les types seront explicitement définis (interfaces pour EmailTemplateData, SendEmailParams, etc.)
- **Conforme** : Utilisation des types Supabase générés depuis `src/lib/database.types.ts`
- **Conforme** : Pas de `any`, typage strict activé

### ✅ III. Validation Centralisée
- **Conforme** : Validation des champs obligatoires avant envoi (nomClient, telephoneClient, adresseComplete)
- **Conforme** : Validation du format email Gmail côté serveur
- **Note** : Pas de validation centralisée existante pour les emails, mais validation inline dans la route API (acceptable pour cette fonctionnalité isolée)

### ✅ IV. React Query pour la Gestion d'État Serveur
- **Conforme** : Les données d'intervention sont déjà gérées via React Query dans `InterventionEditForm`
- **Conforme** : Pas besoin de nouveaux hooks React Query pour cette fonctionnalité (envoi synchrone via mutation directe)
- **Note** : L'envoi d'email est une action ponctuelle, pas une query réutilisable

### ✅ V. Design System et UI Components
- **Conforme** : Utilisation de shadcn/ui (Dialog pour le modal, Button, Input, etc.)
- **Conforme** : Utilisation de lucide-react pour les icônes (Mail)
- **Conforme** : Utilisation de Sonner pour les toasts (déjà présent dans le projet)
- **Conforme** : Dark mode first avec fond `bg-[#0A0A0A]`

### ✅ VI. Performance et Optimisation
- **Conforme** : Envoi synchrone acceptable pour cette fonctionnalité (action utilisateur ponctuelle)
- **Conforme** : Logs enregistrés de manière asynchrone pour ne pas bloquer la réponse
- **Conforme** : Retry avec backoff exponentiel pour optimiser les chances de succès

### ✅ VII. Sécurité et RLS (Row Level Security)
- **Conforme** : RLS activé sur `users` (utilisateurs voient/modifient uniquement leurs propres credentials)
- **Conforme** : RLS activé sur `email_logs` (utilisateurs voient leurs propres logs, admins voient tous)
- **Conforme** : Chiffrement AES-256-CBC pour les mots de passe (clés dans variables d'environnement)
- **Conforme** : Validation d'authentification sur toutes les routes API

**Résultat** : ✅ **TOUS LES GATES PASSENT** - Aucune violation de la constitution détectée.

## Project Structure

### Documentation (this feature)

```text
specs/004-mail/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── send-email.openapi.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Structure existante (Next.js App Router)
app/
├── api/
│   ├── interventions/
│   │   └── [id]/
│   │       └── send-email/
│   │           └── route.ts          # NOUVEAU : Route API pour l'envoi d'email
│   └── auth/
│       └── profile/
│           └── route.ts              # MODIFIÉ : Ajout gestion champs email

src/
├── components/
│   ├── interventions/
│   │   ├── InterventionEditForm.tsx  # MODIFIÉ : Ajout sélecteur artisan + 2 boutons + modal
│   │   └── EmailEditModal.tsx        # NOUVEAU : Composant modal d'édition d'email
│   └── ui/                           # Composants shadcn/ui existants (Dialog, Button, etc.)

├── lib/
│   ├── services/
│   │   └── email-service.ts          # NOUVEAU : Service d'envoi d'email avec nodemailer
│   ├── email-templates/
│   │   └── intervention-emails.ts   # NOUVEAU : Templates HTML pour devis et intervention
│   └── utils/
│       └── encryption.ts             # NOUVEAU : Fonctions de chiffrement/déchiffrement AES-256-CBC

├── features/
│   └── settings/
│       └── SettingsRoot.tsx          # MODIFIÉ : Ajout section configuration email

supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_add_email_smtp_fields.sql  # NOUVEAU : Migration pour users et email_logs

public/
└── logoGM.png                       # NOUVEAU : Logo GMBS pour pièce jointe inline
```

**Structure Decision**: 
Le projet suit déjà une architecture Next.js App Router avec séparation claire frontend/backend. La nouvelle fonctionnalité s'intègre naturellement dans cette structure :
- Routes API dans `app/api/` suivant le pattern existant
- Composants React dans `src/components/` suivant la structure modulaire
- Services métier dans `src/lib/services/` (nouveau dossier pour cette fonctionnalité)
- Templates dans `src/lib/email-templates/` (nouveau dossier)
- Migrations Supabase dans `supabase/migrations/` suivant le pattern existant

## Complexity Tracking

> **Aucune violation de la constitution détectée - cette section reste vide**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

---

## Phase 0: Research - ✅ COMPLETE

**Status**: ✅ Tous les besoins de clarification ont été résolus

**Artefacts générés**:
- ✅ `research.md` : Décisions techniques documentées (nodemailer, chiffrement AES-256-CBC, retry, timeouts, etc.)

**Décisions clés**:
- Utilisation de `nodemailer` pour SMTP Gmail
- Chiffrement AES-256-CBC avec Node.js crypto
- Retry avec backoff exponentiel (3 tentatives)
- Timeouts : Backend 60s, Frontend 70s
- Templates HTML inline avec styles inline
- Validation serveur stricte des champs obligatoires

---

## Phase 1: Design & Contracts - ✅ COMPLETE

**Status**: ✅ Modèle de données, contrats API et quickstart générés

**Artefacts générés**:
- ✅ `data-model.md` : Modèle de données complet (tables `users`, `email_logs`, interfaces TypeScript)
- ✅ `contracts/send-email.openapi.yaml` : Contrat OpenAPI pour la route `/api/interventions/[id]/send-email`
- ✅ `quickstart.md` : Guide de démarrage rapide avec structure des fichiers et étapes d'implémentation

**Décisions de design**:
- Structure modulaire : Service email séparé, templates séparés, route API dédiée
- Sécurité : Chiffrement côté application, RLS sur toutes les tables
- UX : Modal d'édition avec pré-remplissage automatique, feedback utilisateur pendant l'envoi

---

## Phase 2: Tasks - ✅ COMPLETE

**Status**: ✅ Liste de tâches détaillée générée

**Artefacts générés**:
- ✅ `tasks.md` : 84 tâches organisées en 7 phases (Setup, Database, Backend Core, API Routes, Frontend, Testing, Documentation)

**Organisation des tâches**:
- Phase 1: Setup & Configuration (4 tâches)
- Phase 2: Database Schema (6 tâches) - BLOCKS backend
- Phase 3: Backend Core Services (15 tâches) - BLOCKS API routes
- Phase 4: Backend API Routes (8 tâches) - BLOCKS frontend
- Phase 5: Frontend Components (20 tâches) - Feature functional
- Phase 6: Testing (21 tâches) - Validation
- Phase 7: Documentation & Polish (10 tâches) - Finalization

**Prochaines étapes**:
1. Commencer l'implémentation selon les tâches dans `tasks.md`
2. Suivre l'ordre des phases (Setup → Database → Backend → Frontend → Testing → Documentation)
3. Valider à chaque checkpoint

---

## Rapport Final

**Branch**: `004-mail`  
**Plan Path**: `specs/004-mail/plan.md`  
**Spec Path**: `specs/004-mail/spec.md`

**Artefacts générés**:
- ✅ `plan.md` (ce fichier)
- ✅ `research.md`
- ✅ `data-model.md`
- ✅ `contracts/send-email.openapi.yaml`
- ✅ `quickstart.md`
- ✅ `tasks.md`

**Prochaines actions**:
1. ✅ Liste de tâches créée - Prêt pour l'implémentation
2. Commencer l'implémentation selon les tâches dans `tasks.md`
3. Suivre l'ordre des phases et valider à chaque checkpoint
4. Consulter `quickstart.md` pour les détails techniques
