# Quick Start: Système d'envoi d'email CRM

**Date**: 2025-01-19  
**Feature**: 004-mail

## Vue d'ensemble

Ce guide fournit les étapes rapides pour implémenter le système d'envoi d'email depuis le CRM vers les artisans.

## Prérequis

- Node.js 18+
- Next.js 15.5+
- Supabase configuré
- Compte Gmail avec mot de passe d'application (pour les tests)

## Installation des Dépendances

```bash
npm install nodemailer @types/nodemailer
```

## Configuration

### 1. Variables d'environnement

Ajouter dans `.env.local` :

```bash
# Chiffrement des mots de passe email
EMAIL_PASSWORD_ENCRYPTION_KEY=votre-cle-secrete-tres-longue-et-aleatoire-32-caracteres-minimum
EMAIL_PASSWORD_ENCRYPTION_IV=votre-iv-16-caracteres
```

**Génération des clés** :

```bash
# Générer les deux clés en une seule commande
node -e "const crypto = require('crypto'); console.log('EMAIL_PASSWORD_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex')); console.log('EMAIL_PASSWORD_ENCRYPTION_IV=' + crypto.randomBytes(16).toString('hex'));"

# Ou séparément :
# Générer la clé de chiffrement (32 caractères minimum)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Générer l'IV (16 caractères)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 2. Migration Supabase

Exécuter la migration :

```bash
# Appliquer la migration
supabase migration up

# Ou via Supabase Dashboard : SQL Editor > Run migration
```

**Fichier** : `supabase/migrations/YYYYMMDDHHMMSS_add_email_smtp_fields.sql`

## Structure des Fichiers

### Backend

1. **Service email** : `src/lib/services/email-service.ts`
2. **Templates** : `src/lib/email-templates/intervention-emails.ts`
3. **Chiffrement** : `src/lib/utils/encryption.ts`
4. **Route API** : `app/api/interventions/[id]/send-email/route.ts`

### Frontend

1. **Modal d'édition** : `src/components/interventions/EmailEditModal.tsx`
2. **Intégration formulaire** : `src/components/interventions/InterventionEditForm.tsx`
3. **Settings** : `src/features/settings/SettingsRoot.tsx`

## Implémentation Rapide

### Étape 1 : Créer le service de chiffrement

**Fichier** : `src/lib/utils/encryption.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.EMAIL_PASSWORD_ENCRYPTION_KEY!;
const ENCRYPTION_IV = process.env.EMAIL_PASSWORD_ENCRYPTION_IV!;

export function encryptPassword(password: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ENCRYPTION_IV, 'hex'));
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptPassword(encryptedPassword: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ENCRYPTION_IV, 'hex'));
  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Étape 2 : Créer les templates d'email

**Fichier** : `src/lib/email-templates/intervention-emails.ts`

```typescript
export interface EmailTemplateData {
  nomClient: string;
  telephoneClient: string;
  telephoneClient2?: string;
  adresseComplete: string;
  datePrevue?: string;
  consigneArtisan?: string;
  coutSST?: string;
  commentaire?: string;
  idIntervention?: string;
}

export function generateDevisEmailTemplate(data: EmailTemplateData): string {
  // Implémentation du template HTML pour devis
  // Voir spec.md section 5.2 pour le contenu complet
}

export function generateInterventionEmailTemplate(data: EmailTemplateData): string {
  // Implémentation du template HTML pour intervention
  // Voir spec.md section 5.3 pour le contenu complet
}
```

### Étape 3 : Créer le service d'envoi d'email

**Fichier** : `src/lib/services/email-service.ts`

```typescript
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendEmailParams {
  type: 'devis' | 'intervention';
  artisanEmail: string;
  subject: string;
  htmlContent: string;
  smtpEmail: string;
  smtpPassword: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; cid?: string; contentType?: string }>;
}

export async function sendEmailToArtisan(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  // Créer le transporteur nodemailer
  // Inclure le logo GMBS automatiquement (cid: logoGM)
  // Implémenter retry avec backoff exponentiel (3 tentatives)
  // Retourner success/error
}
```

### Étape 4 : Créer la route API

**Fichier** : `app/api/interventions/[id]/send-email/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { bearerFrom, createServerSupabase } from '@/lib/supabase/server';
import { decryptPassword } from '@/lib/utils/encryption';
import { sendEmailToArtisan } from '@/lib/services/email-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 1. Authentification (vérifier token)
  // 2. Récupérer intervention et artisan
  // 3. Récupérer credentials email utilisateur
  // 4. Déchiffrer mot de passe
  // 5. Valider champs obligatoires
  // 6. Envoyer email via service
  // 7. Créer log dans email_logs
  // 8. Retourner réponse
}
```

### Étape 5 : Créer le composant modal

**Fichier** : `src/components/interventions/EmailEditModal.tsx`

```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export interface EmailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailType: 'devis' | 'intervention';
  artisanId: string;
  artisanEmail: string;
  interventionId: string;
  templateData: EmailTemplateData;
}

export function EmailEditModal({ ... }: EmailEditModalProps) {
  // 1. Générer template automatiquement à l'ouverture
  // 2. État pour sujet et contenu HTML éditable
  // 3. Gestion des pièces jointes (upload, liste, suppression)
  // 4. Fonction d'envoi avec toast de feedback
  // 5. Timeout frontend 70s
}
```

### Étape 6 : Intégrer dans InterventionEditForm

**Fichier** : `src/components/interventions/InterventionEditForm.tsx`

```typescript
// Ajouter :
// 1. Sélecteur d'artisan (dropdown) avec artisans ayant email valide
// 2. Deux boutons "Mail demande de devis" et "Mail demande d'intervention"
// 3. États pour gérer les modals
// 4. Fonctions handleOpenDevisEmailModal et handleOpenInterventionEmailModal
// 5. Composant EmailEditModal intégré
```

### Étape 7 : Ajouter configuration dans Settings

**Fichier** : `src/features/settings/SettingsRoot.tsx`

```typescript
// Ajouter section dans Profile :
// 1. Champ email_smtp (input)
// 2. Champ email_password (input type="password")
// 3. Lien vers documentation Google App Password
// 4. Sauvegarde via PATCH /api/auth/profile
// 5. Chiffrement du mot de passe avant envoi
```

## Tests

### Test unitaire du service email

```typescript
import { sendEmailToArtisan } from '@/lib/services/email-service';

// Mock nodemailer
jest.mock('nodemailer');

test('envoie email avec succès', async () => {
  // Test avec mock SMTP
});
```

### Test d'intégration

```typescript
// Test complet :
// 1. Créer intervention de test
// 2. Configurer credentials email utilisateur
// 3. Envoyer email via API
// 4. Vérifier log dans email_logs
// 5. Vérifier email reçu (mock SMTP)
```

## Checklist d'Implémentation

- [ ] Migration Supabase créée et appliquée
- [ ] Variables d'environnement configurées
- [ ] Service de chiffrement créé
- [ ] Templates d'email créés
- [ ] Service d'envoi email créé (avec retry)
- [ ] Route API créée
- [ ] Modal d'édition créé
- [ ] Intégration dans InterventionEditForm
- [ ] Configuration dans Settings
- [ ] Logo GMBS ajouté dans public/
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests manuels

## Dépannage

### Erreur "Credentials email non configurés"

**Solution** : Configurer email_smtp et email_password dans Settings > Profile

### Erreur "SMTP Authentication failed"

**Solution** : Vérifier que le mot de passe d'application Gmail est correct (pas le mot de passe principal)

### Erreur "Timeout"

**Solution** : Vérifier la connexion réseau, les credentials SMTP, et les limites Gmail

### Logo ne s'affiche pas dans l'email

**Solution** : Vérifier que le logo est dans `public/logoGM.png` et que le CID est `logoGM`

## Ressources

- [Documentation nodemailer](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Spec complète](./spec.md)
