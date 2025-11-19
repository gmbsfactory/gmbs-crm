# 📧 SPÉCIFICATION COMPLÈTE - SYSTÈME D'ENVOI D'EMAIL CRM

**Branche:** `004-mail`  
**Date:** 2025-01-19  
**Version:** 1.0  
**Statut:** À implémenter

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Base de données](#base-de-données)
4. [Backend API](#backend-api)
5. [Templates d'email](#templates-demail)
6. [Frontend - Composants](#frontend---composants)
7. [Service d'envoi d'email](#service-denvoi-demail)
8. [Gestion des pièces jointes](#gestion-des-pièces-jointes)
9. [Sécurité](#sécurité)
10. [Flux de données](#flux-de-données)
11. [Tests](#tests)
12. [Checklist d'implémentation](#checklist-dimplémentation)

---

## 1. Vue d'ensemble

### 1.1 Objectif

Permettre aux gestionnaires d'envoyer deux types d'emails aux artisans depuis le formulaire d'intervention :
- **Email de demande de devis** (visite technique)
- **Email de demande d'intervention**

### 1.2 Fonctionnalités principales

- ✅ Sélecteur d'artisan (dropdown) dans `InterventionEditForm` pour choisir le destinataire
- ✅ Deux boutons séparés dans `InterventionEditForm` :
  - "Mail demande de devis" (visite technique)
  - "Mail demande d'intervention"
- ✅ **Les boutons ouvrent un modal d'édition d'email** (ne pas envoyer automatiquement)
- ✅ Génération automatique des templates selon le type dans le modal
- ✅ Édition du contenu de l'email dans le modal
- ✅ Ajout de pièces jointes dans le modal
- ✅ Envoi de l'email depuis le modal après édition
- ✅ Envoi via Gmail avec credentials utilisateur stockés de manière sécurisée
- ✅ Logs des envois dans la base de données
- ✅ Gestion du logo GMBS en pièce jointe inline

### 1.3 Contexte

Cette fonctionnalité remplace le système legacy qui utilisait un modal d'édition d'email. La nouvelle version conserve le modal d'édition mais simplifie l'accès avec deux boutons directs qui génèrent automatiquement les templates d'email pré-remplis dans le modal.

---

## Clarifications

### Session 2025-01-19

- Q: Comment gérer les erreurs réseau et rate limiting Gmail lors de l'envoi SMTP ? → A: Retry avec backoff exponentiel (3 tentatives max), log en 'failed' après échec définitif
- Q: Comment gérer le statut 'pending' dans email_logs ? → A: Statut 'pending' réservé pour future file d'attente asynchrone (non utilisé dans v1)
- Q: Quel feedback utilisateur pendant l'envoi et gestion du timeout côté frontend ? → A: Indicateur de chargement sur le bouton + toast "Envoi en cours..." + timeout frontend de 70s avec message d'erreur
- Q: Comment gérer les données manquantes dans les templates d'email ? → A: Valeurs par défaut explicites pour tous les champs optionnels + validation avant envoi avec message d'erreur si champs obligatoires manquants
- Q: Comportement si plusieurs artisans sont sélectionnés ? → A: Afficher un sélecteur pour choisir l'artisan destinataire avant l'envoi
- Q: Les boutons doivent-ils envoyer les emails automatiquement ? → A: Non, les boutons ouvrent un modal d'édition où l'utilisateur peut modifier le contenu, ajouter des pièces jointes, puis envoyer depuis le modal
- Q: Quelle source utiliser pour les données client (tenant vs owner) ? → A: Toujours utiliser `intervention.tenants` uniquement, même si vide (ne pas utiliser owner comme fallback)
- Q: Comment construire `adresseComplete` ? → A: Concaténation simple `${adresse}, ${code_postal} ${ville}` (ex: "123 rue Example, 75001 Paris")
- Q: Comment construire `nomClient` ? → A: Format "Prénom Nom" : `${firstname || ''} ${lastname || ''}`.trim() (ex: "Jean Dupont" ou "Dupont" si pas de prénom)
- Q: Quelle consigne utiliser pour `consigneArtisan` ? → A: Selon l'artisan sélectionné : si artisan principal (`is_primary=true`) → `consigne_intervention`, sinon → `consigne_second_artisan`
- Q: Comment calculer et formater `coutSST` ? → A: Uniquement SST (sans matériel) : utiliser seulement `sstCost` depuis `intervention_costs` où `cost_type='sst'`, format monétaire à définir

---

## 2. Architecture

### 2.1 Schéma général

```
┌─────────────────┐
│  Frontend       │
│  (React/Next.js)│
│                 │
│  Intervention   │──┐
│  EditForm       │  │
│  (2 boutons)    │  │
└─────────────────┘  │
                     │ HTTP POST
                     │ JSON
                     │
┌─────────────────┐  │
│  Backend API    │◄─┘
│  (Next.js API)  │
│                 │
│  /api/interventions│
│  /:id/send-email│
└─────────────────┘
         │
         │ Récupère credentials
         │ depuis Supabase
         ▼
┌─────────────────┐
│  Supabase DB    │
│  users table    │
│  (email_smtp,   │
│   email_password)│
└─────────────────┘
         │
         │ Déchiffre password
         │
         ▼
┌─────────────────┐
│  Email Service  │
│  (nodemailer)   │
│                 │
│  Gmail SMTP     │
│  + Logo inline  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Artisan Email  │
└─────────────────┘
```

### 2.2 Stack technique

- **Frontend:** React, Next.js, shadcn/ui, Sonner (toasts)
- **Backend:** Next.js API Routes
- **Base de données:** Supabase (PostgreSQL)
- **Email:** nodemailer + Gmail SMTP
- **Chiffrement:** AES-256-CBC (crypto Node.js)

---

## 3. Base de données

### 3.1 Migration Supabase

**Fichier:** `supabase/migrations/YYYYMMDDHHMMSS_add_email_smtp_fields.sql`

```sql
-- ========================================
-- Migration: Ajout des champs email SMTP pour l'envoi d'emails
-- Date: 2025-01-XX
-- ========================================

-- Activer l'extension pgcrypto pour le chiffrement
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ajouter les colonnes pour l'email SMTP
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_smtp text,
ADD COLUMN IF NOT EXISTS email_password_encrypted text;

-- Commentaires pour documentation
COMMENT ON COLUMN public.users.email_smtp IS 'Adresse email Gmail utilisée pour l''envoi d''emails (ex: gestionnaire@gmail.com)';
COMMENT ON COLUMN public.users.email_password_encrypted IS 'Mot de passe d''application Gmail chiffré avec AES-256';

-- Index pour les recherches par email SMTP
CREATE INDEX IF NOT EXISTS idx_users_email_smtp ON public.users(email_smtp) WHERE email_smtp IS NOT NULL;

-- RLS: L'utilisateur ne peut voir/modifier que ses propres credentials email
DROP POLICY IF EXISTS users_email_smtp_select ON public.users;
CREATE POLICY users_email_smtp_select ON public.users
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS users_email_smtp_update ON public.users;
CREATE POLICY users_email_smtp_update ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Table pour les logs d'envoi d'emails
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  artisan_id uuid REFERENCES public.artisans(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message_html text,
  email_type text CHECK (email_type IN ('devis', 'intervention')),
  attachments_count int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_email_logs_intervention ON public.email_logs(intervention_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_artisan ON public.email_logs(artisan_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON public.email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);

-- RLS pour email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres logs d'envoi
CREATE POLICY email_logs_select_own ON public.email_logs
  FOR SELECT
  USING (auth.uid() = sent_by);

-- Politique: Les admins peuvent voir tous les logs
CREATE POLICY email_logs_select_admin ON public.email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

COMMENT ON TABLE public.email_logs IS 'Logs des emails envoyés depuis le CRM';
COMMENT ON COLUMN public.email_logs.email_type IS 'Type d''email: devis (visite technique) ou intervention';
COMMENT ON COLUMN public.email_logs.status IS 'Statut: sent (envoyé), failed (échec), pending (en attente - réservé pour future évolution asynchrone)';
```

### 3.2 Structure des données

**Table `users`:**
- `email_smtp` (text): Email Gmail du gestionnaire
- `email_password_encrypted` (text): Mot de passe d'application chiffré

**Table `email_logs`:**
- `id` (uuid): Identifiant unique
- `intervention_id` (uuid): Référence à l'intervention
- `artisan_id` (uuid): Référence à l'artisan destinataire
- `sent_by` (uuid): Utilisateur qui a envoyé l'email
- `recipient_email` (text): Email du destinataire
- `subject` (text): Sujet de l'email
- `message_html` (text): Corps HTML de l'email
- `email_type` (text): Type d'email ('devis' ou 'intervention')
- `attachments_count` (int): Nombre de pièces jointes
- `status` (text): Statut ('sent', 'failed', 'pending')
  - **Note:** Dans la v1, seuls 'sent' et 'failed' sont utilisés. Le statut 'pending' est réservé pour une future évolution avec file d'attente asynchrone.
- `error_message` (text): Message d'erreur si échec
- `sent_at` (timestamptz): Date d'envoi

---

## 4. Backend API

### 4.1 Route API - Envoi d'email

**Fichier:** `app/api/interventions/[id]/send-email/route.ts`

**Fonctionnalités:**
- Validation du type d'email ('devis' ou 'intervention')
- Validation des données obligatoires (nomClient, telephoneClient, adresseComplete) si template régénéré côté serveur
- Récupération des credentials email de l'utilisateur
- Acceptation du contenu HTML édité depuis le modal (peut différer du template généré)
- Gestion des pièces jointes :
  - Logo GMBS automatiquement inclus en pièce jointe inline (obligatoire)
  - Pièces jointes supplémentaires envoyées depuis le modal (optionnel)
- Déchiffrement du mot de passe
- Envoi via nodemailer avec logo inline + pièces jointes avec retry automatique (backoff exponentiel, 3 tentatives max)
- Enregistrement du log avec statut approprié ('sent', 'failed', 'pending')

**Paramètres de requête:**
- `type`: 'devis' | 'intervention'
- `artisanId`: UUID de l'artisan destinataire
- `subject`: Sujet de l'email (édité dans le modal)
- `htmlContent`: Corps HTML de l'email (édité dans le modal)
- `attachments`: Array de fichiers supplémentaires (optionnel, en plus du logo GMBS automatique)

**Réponses:**
- `200`: Email envoyé avec succès
- `400`: Erreur de validation (type invalide, artisan manquant, credentials non configurés, champs obligatoires manquants: nomClient, telephoneClient, adresseComplete)
- `401`: Non autorisé
- `404`: Intervention ou utilisateur non trouvé
- `500`: Erreur serveur

### 4.2 Route API - Mise à jour du profil

**Fichier:** `app/api/auth/profile/route.ts` (mise à jour)

Ajouter la gestion des champs email dans la route PATCH existante :
- `email_smtp`: Email Gmail de l'utilisateur
- `email_password`: Mot de passe d'application (sera chiffré avant stockage)

---

## 5. Templates d'email

### 5.1 Fichier des templates

**Fichier:** `src/lib/email-templates/intervention-emails.ts`

**Interface `EmailTemplateData`:**
```typescript
interface EmailTemplateData {
  nomClient: string
  telephoneClient: string
  telephoneClient2?: string
  adresseComplete: string
  datePrevue?: string
  consigneArtisan?: string
  coutSST?: string
  commentaire?: string
  idIntervention?: string
}
```

**Fonctions:**
- `generateDevisEmailTemplate(data: EmailTemplateData): string`
- `generateInterventionEmailTemplate(data: EmailTemplateData): string`

**Gestion des données manquantes:**
- **Champs obligatoires:** `nomClient`, `telephoneClient`, `adresseComplete` - validation avant envoi, retour d'erreur si manquants
- **Champs optionnels:** Valeurs par défaut explicites appliquées si manquants:
  - `telephoneClient2`: "" (chaîne vide)
  - `datePrevue`: "À définir" (pour template devis et intervention)
  - `consigneArtisan`: "Aucune description fournie" (pour template devis et intervention)
  - `coutSST`: "Non spécifié" (calculé uniquement depuis `intervention_costs` où `cost_type='sst'`, sans ajouter le matériel)
  - `commentaire`: "" (chaîne vide, section non affichée si vide)
  - `idIntervention`: "" (chaîne vide)

### 5.2 Template "Demande de devis"

**Contenu:**
- Logo GMBS (https://ci3.googleusercontent.com/mail-sig/AIorK4wUNSrhY_zm4YeIl5qEtKA9aP3bNMkFqDZYvC4SCZtI9ACxrx9oqjUs-aqxDGhHokDzWG5275M )
- Informations client (nom, téléphone, adresse)
- Date prévue
- Consigne pour l'artisan
- Commentaires
- Instructions post-visite
- Coordonnées GMBS
- Signature David Lenotre

### 5.3 Template "Demande d'intervention"

**Contenu:**
- Logo GMBS (https://ci3.googleusercontent.com/mail-sig/AIorK4wUNSrhY_zm4YeIl5qEtKA9aP3bNMkFqDZYvC4SCZtI9ACxrx9oqjUs-aqxDGhHokDzWG5275M )
- Informations client (nom, téléphone, adresse)
- Date prévue
- Consigne pour l'artisan
- Cout SST
- Commentaires
- Instructions post-intervention
- Coordonnées de facturation GMBS
- Signature David Lenotre

---

## 6. Frontend - Composants

### 6.1 Intégration dans InterventionEditForm

**Fichier:** `src/components/interventions/InterventionEditForm.tsx`

**Modifications:**
1. Ajouter les imports nécessaires (`Mail` icon, `toast`, composant Select pour sélection d'artisan, composant Dialog/Modal)
2. Ajouter les états pour gérer les modals (`isDevisEmailModalOpen`, `isInterventionEmailModalOpen`, `selectedArtisanForEmail`)
3. Créer les fonctions `handleOpenDevisEmailModal` et `handleOpenInterventionEmailModal` (ouvrent les modals)
4. Ajouter un sélecteur d'artisan et les deux boutons dans la section des artisans
5. Créer le composant modal d'édition d'email (voir section 6.3)

**Emplacement des boutons:**
Dans la section "Artisans à proximité", après le titre et avant la liste des artisans, afficher :
- Un sélecteur d'artisan (dropdown) listant tous les artisans sélectionnés ayant un email valide
- Les deux boutons "Mail demande de devis" et "Mail demande d'intervention"

**Comportement des boutons:**
- Le sélecteur affiche uniquement les artisans ayant un email valide (`artisan.email` non vide)
- Les boutons sont désactivés si aucun artisan n'est sélectionné dans le sélecteur
- **Clic sur un bouton → Ouvre le modal d'édition d'email** (ne pas envoyer automatiquement)
- Le modal est pré-rempli avec le template généré automatiquement selon le type (devis/intervention)
- L'utilisateur peut éditer le contenu et ajouter des pièces jointes dans le modal
- L'envoi se fait depuis le modal via un bouton "Envoyer" dans le modal

### 6.2 Composant Modal d'édition d'email

**Fichier:** `src/components/interventions/EmailEditModal.tsx` (nouveau composant)

**Fonctionnalités:**
- Modal d'édition d'email avec éditeur de texte riche (ou textarea simple)
- Pré-remplissage automatique avec le template généré selon le type (devis/intervention)
- Édition du sujet de l'email
- Édition du corps de l'email (HTML)
- Gestion des pièces jointes :
  - Upload de fichiers (bouton "Ajouter une pièce jointe")
  - Liste des pièces jointes ajoutées avec possibilité de suppression
  - Logo GMBS automatiquement inclus en pièce jointe inline (non modifiable)
- Boutons d'action :
  - "Annuler" : Ferme le modal sans envoi
  - "Envoyer" : Envoie l'email avec le contenu édité et les pièces jointes

**Props:**
```typescript
interface EmailEditModalProps {
  isOpen: boolean
  onClose: () => void
  emailType: 'devis' | 'intervention'
  artisanId: string
  artisanEmail: string
  interventionId: string
  templateData: EmailTemplateData
}
```

**États internes:**
- `subject`: Sujet de l'email (pré-rempli depuis le template)
- `htmlContent`: Corps HTML de l'email (pré-rempli depuis le template)
- `attachments`: Liste des pièces jointes ajoutées par l'utilisateur
- `isSending`: État de chargement pendant l'envoi

**Comportement:**
- À l'ouverture : Génère le template automatiquement et pré-remplit les champs
  - **Mapping des données client :** Utiliser uniquement `intervention.tenants` pour préremplir `nomClient`, `telephoneClient`, `telephoneClient2`, et `adresseComplete` (ne pas utiliser `intervention.owner` comme fallback)
  - **Construction de `nomClient` :** Format "Prénom Nom" : `${tenants.firstname || ''} ${tenants.lastname || ''}`.trim() (ex: "Jean Dupont" ou "Dupont" si pas de prénom)
  - **Construction de `adresseComplete` :** Format `${intervention.adresse}, ${intervention.code_postal} ${intervention.ville}` (ex: "123 rue Example, 75001 Paris")
  - **Sélection de `consigneArtisan` :** Selon l'artisan sélectionné dans le sélecteur : si artisan principal (`is_primary=true`) → utiliser `intervention.consigne_intervention`, sinon → utiliser `intervention.consigne_second_artisan`
  - **Calcul de `coutSST` :** Utiliser uniquement le coût SST depuis `intervention.intervention_costs` où `cost_type='sst'` (ne pas ajouter le coût matériel)
  - Si `intervention.tenants` est absent ou vide, les champs seront vides et les valeurs par défaut s'appliqueront selon les règles de gestion des données manquantes
- Pendant l'édition : L'utilisateur peut modifier le sujet et le contenu
- Ajout de pièces jointes : Upload de fichiers, stockage temporaire dans l'état
- Envoi : Appelle l'API `/api/interventions/:id/send-email` avec le contenu édité et les pièces jointes
- Après envoi : Affiche un toast de succès/erreur et ferme le modal

### 6.3 Section Settings - Configuration email

**Fichier:** `src/features/settings/SettingsRoot.tsx`

Ajouter une nouvelle Card dans la section Profile pour configurer :
- Email Gmail (`email_smtp`)
- Mot de passe d'application (`email_password`)
- Lien vers la documentation Google pour créer un mot de passe d'application

---

## 7. Service d'envoi d'email

### 7.1 Service Email

**Fichier:** `src/lib/services/email-service.ts`

**Fonction principale:**
```typescript
sendEmailToArtisan(params: SendEmailParams): Promise<SendEmailResult>
```

**Fonctionnalités:**
- Création du transporteur nodemailer avec Gmail
- Gestion des pièces jointes (logo inline avec CID)
- Envoi de l'email HTML avec stratégie de retry (backoff exponentiel, 3 tentatives maximum)
- Gestion des erreurs réseau et SMTP avec retry automatique

**Dépendances:**
- `nodemailer`
- `@types/nodemailer`

---

## 8. Gestion des pièces jointes

### 8.1 Logo GMBS inline (automatique)

**Emplacement:** `public/logoGM.png`

**Caractéristiques:**
- Format: PNG recommandé
- Taille: Optimisée pour l'email (< 200 KB)
- CID: `logoGM` pour référence dans le HTML
- Utilisation: Référencé dans les templates via `cid:logoGM`
- **Comportement:** Automatiquement inclus dans tous les emails envoyés, non modifiable par l'utilisateur

### 8.2 Pièces jointes supplémentaires (utilisateur)

**Fonctionnalité:**
- L'utilisateur peut ajouter des pièces jointes supplémentaires dans le modal d'édition
- Upload de fichiers via le bouton "Ajouter une pièce jointe" dans le modal
- Liste des pièces jointes affichée avec possibilité de suppression avant envoi
- Les pièces jointes sont envoyées en plus du logo GMBS automatique

**Format des pièces jointes:**

Les pièces jointes sont gérées via l'interface `Attachment` :
```typescript
interface Attachment {
  filename: string
  path?: string
  content?: Buffer
  cid?: string
  contentType?: string
}
```

**Limites:**
- Taille maximale par fichier: À définir (recommandé: 10 MB max)
- Nombre maximum de pièces jointes: À définir (recommandé: 5 fichiers max)
- Formats acceptés: Tous formats (validation côté frontend recommandée)

---

## 9. Sécurité

### 9.1 Chiffrement des mots de passe

**Algorithme:** AES-256-CBC  
**Clé:** Stockée dans `EMAIL_PASSWORD_ENCRYPTION_KEY`  
**IV:** Stocké dans `EMAIL_PASSWORD_ENCRYPTION_IV`

**Fonctions:**
- Chiffrement côté serveur avant stockage
- Déchiffrement côté serveur uniquement lors de l'envoi
- Les mots de passe ne sont jamais exposés côté client

### 9.2 Variables d'environnement

```bash
# .env.local
EMAIL_PASSWORD_ENCRYPTION_KEY=votre-cle-secrete-tres-longue-et-aleatoire-32-caracteres-minimum
EMAIL_PASSWORD_ENCRYPTION_IV=votre-iv-16-caracteres
```

### 9.3 Row Level Security (RLS)

**Table `users`:**
- Les utilisateurs ne peuvent voir/modifier que leurs propres credentials email

**Table `email_logs`:**
- Les utilisateurs peuvent voir leurs propres logs
- Les admins peuvent voir tous les logs

### 9.4 Validation

- Validation du type d'email ('devis' ou 'intervention')
- Vérification de l'existence de l'artisan et de son email
- Vérification des credentials email de l'utilisateur
- Validation de l'email Gmail (format)

---

## 10. Flux de données

### 10.1 Flux d'envoi d'email (devis)

```
1. Utilisateur sélectionne un artisan dans le sélecteur (dropdown)
   ↓
2. Utilisateur clique sur "Mail demande de devis"
   ↓
3. Frontend ouvre le modal d'édition d'email (EmailEditModal)
   ↓
4. Frontend génère automatiquement le template "devis" et pré-remplit le modal
   ↓
5. Utilisateur peut éditer le sujet et le contenu de l'email dans le modal
   ↓
6. Utilisateur peut ajouter des pièces jointes supplémentaires (optionnel)
   ↓
7. Utilisateur clique sur "Envoyer" dans le modal
   ↓
8. Frontend valide que l'artisan sélectionné a un email valide
   ↓
9. Frontend prépare les données (contenu édité + pièces jointes)
   ↓
10. Frontend envoie POST /api/interventions/:id/send-email
    (type: "devis", artisanId: artisan sélectionné, data: contenu édité, attachments: pièces jointes)
   ↓
11. Backend récupère les credentials email de l'utilisateur
   ↓
12. Backend déchiffre le mot de passe
   ↓
13. Backend charge le logo GMBS (pièce jointe inline automatique)
   ↓
14. Backend envoie l'email via nodemailer avec logo inline + pièces jointes utilisateur
   ↓
15. Backend enregistre le log dans email_logs
   ↓
16. Backend retourne success/error
   ↓
17. Frontend affiche notification toast et ferme le modal
```

### 10.2 Flux d'envoi d'email (intervention)

Même flux que devis, mais avec :
- Sélection de l'artisan dans le sélecteur (peut être différent de celui utilisé pour le devis)
- Clic sur "Mail demande d'intervention" ouvre le modal avec template "intervention"
- `type: "intervention"` dans l'appel API
- Template `generateInterventionEmailTemplate` pour pré-remplissage
- Sujet différent dans le template

### 10.3 Flux de configuration email

```
1. Utilisateur va dans Settings > Profile
   ↓
2. Utilisateur remplit email_smtp et email_password
   ↓
3. Frontend envoie PATCH /api/auth/profile
   ↓
4. Backend chiffre le mot de passe
   ↓
5. Backend sauvegarde dans users table
   ↓
6. Frontend affiche confirmation
```

---

## 11. Tests

### 11.1 Tests unitaires

**Templates:**
- Test de génération du template "devis"
- Test de génération du template "intervention"
- Test avec données manquantes (application des valeurs par défaut pour champs optionnels)
- Test de validation des champs obligatoires (erreur si nomClient, telephoneClient, ou adresseComplete manquants)

**Modal d'édition:**
- Test d'ouverture du modal au clic sur les boutons
- Test de pré-remplissage avec le template généré
- Test d'édition du sujet et du contenu
- Test d'ajout de pièces jointes
- Test de suppression de pièces jointes
- Test d'envoi depuis le modal
- Test de fermeture du modal (annulation)

**Service email:**
- Test d'envoi avec mock nodemailer
- Test de gestion des erreurs
- Test avec logo inline automatique
- Test avec pièces jointes supplémentaires

**Chiffrement:**
- Test du chiffrement/déchiffrement
- Test avec clé invalide

### 11.2 Tests d'intégration

**Envoi d'email:**
- Envoi email devis complet (mock SMTP)
- Envoi email intervention complet (mock SMTP)
- Gestion des erreurs (credentials manquants, artisan sans email, champs obligatoires manquants)
- Vérification du log dans la base de données
- Vérification de l'application des valeurs par défaut pour champs optionnels

### 11.3 Tests manuels

**Checklist:**
- ✅ Sélection d'artisan via le sélecteur (dropdown)
- ✅ Ouverture du modal d'édition au clic sur les boutons
- ✅ Pré-remplissage automatique du template dans le modal
- ✅ Édition du sujet et du contenu de l'email dans le modal
- ✅ Ajout de pièces jointes supplémentaires dans le modal
- ✅ Envoi email "demande de devis" depuis le modal avec artisan sélectionné
- ✅ Envoi email "demande d'intervention" depuis le modal avec artisan sélectionné
- ✅ Vérification du logo inline dans l'email reçu
- ✅ Vérification des pièces jointes supplémentaires dans l'email reçu
- ✅ Gestion des erreurs (credentials manquants)
- ✅ Gestion des erreurs (artisan sans email)
- ✅ Validation des champs dans Settings
- ✅ Chiffrement/déchiffrement du mot de passe
- ✅ Logs dans email_logs

---

## 12. Checklist d'implémentation

### Phase 1: Base de données
- [ ] Créer la migration Supabase (`add_email_smtp_fields.sql`)
- [ ] Ajouter les colonnes `email_smtp` et `email_password_encrypted` à `users`
- [ ] Créer la table `email_logs` avec tous les champs
- [ ] Configurer les politiques RLS
- [ ] Créer les index nécessaires

### Phase 2: Backend
- [ ] Créer le fichier `src/lib/email-templates/intervention-emails.ts`
- [ ] Implémenter `generateDevisEmailTemplate`
- [ ] Implémenter `generateInterventionEmailTemplate`
- [ ] Créer le service `src/lib/services/email-service.ts`
- [ ] Créer la route API `app/api/interventions/[id]/send-email/route.ts`
- [ ] Mettre à jour `app/api/auth/profile/route.ts` pour gérer les champs email
- [ ] Ajouter les fonctions de chiffrement/déchiffrement

### Phase 3: Frontend
- [ ] Créer le composant `EmailEditModal.tsx` avec éditeur d'email
- [ ] Ajouter la gestion des pièces jointes dans le modal (upload, liste, suppression)
- [ ] Ajouter le sélecteur d'artisan dans `InterventionEditForm.tsx`
- [ ] Ajouter les boutons dans `InterventionEditForm.tsx` (ouvrent le modal)
- [ ] Implémenter `handleOpenDevisEmailModal` (ouvre le modal avec template devis)
- [ ] Implémenter `handleOpenInterventionEmailModal` (ouvre le modal avec template intervention)
- [ ] Implémenter la fonction d'envoi depuis le modal
- [ ] Ajouter la section email dans Settings > Profile
- [ ] Ajouter les validations côté client (artisan sélectionné, contenu non vide)

### Phase 4: Assets et configuration
- [ ] Ajouter le logo GMBS dans `public/logoGM.png`
- [ ] Configurer les variables d'environnement
- [ ] Documenter la création d'un mot de passe d'application Gmail

### Phase 5: Tests
- [ ] Tests unitaires des templates
- [ ] Tests unitaires du service email
- [ ] Tests d'intégration complets
- [ ] Tests manuels

### Phase 6: Documentation
- [ ] Documentation utilisateur (comment configurer Gmail)
- [ ] Documentation technique (architecture, flux)
- [ ] Mise à jour du README si nécessaire

---

## 13. Notes techniques

### 13.1 Gmail App Password

Les utilisateurs doivent créer un "mot de passe d'application" Gmail :
1. Activer la validation en 2 étapes sur leur compte Google
2. Aller dans Paramètres Google > Sécurité
3. Générer un mot de passe d'application
4. Utiliser ce mot de passe (pas le mot de passe principal)

### 13.2 Gestion des erreurs

**Erreurs possibles:**
- Credentials email non configurés → Message clair avec lien vers Settings
- Artisan sans email → Message d'erreur spécifique
- Échec d'envoi SMTP → Retry automatique avec backoff exponentiel (3 tentatives max), log en 'failed' après échec définitif, message utilisateur
- Template invalide → Log de l'erreur, fallback sur template par défaut

**Stratégie de retry pour erreurs SMTP:**
- Tentative 1: Immédiate
- Tentative 2: Après 2 secondes (backoff exponentiel: 2^1)
- Tentative 3: Après 4 secondes (backoff exponentiel: 2^2)
- Après 3 échecs: Log en statut 'failed' avec message d'erreur détaillé

### 13.3 Performance

- Les emails sont envoyés de manière synchrone (peut prendre quelques secondes)
- Le timeout backend est fixé à 60 secondes
- Le timeout frontend est fixé à 70 secondes (supérieur au backend pour éviter les erreurs prématurées)
- Les logs sont enregistrés de manière asynchrone (ne bloque pas la réponse)

### 13.4 Feedback utilisateur

**Pendant l'envoi:**
- Indicateur de chargement visible sur le bouton (spinner ou état "loading")
- Toast informatif "Envoi en cours..." affiché au début de l'envoi
- Bouton désactivé pendant toute la durée de l'envoi

**En cas de timeout:**
- Message d'erreur clair indiquant que l'envoi a pris trop de temps
- Suggestion de vérifier la connexion ou de réessayer

---

## 14. Références

- [Documentation nodemailer](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [AES-256-CBC Encryption](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv)

---

**Fin de la spécification**

