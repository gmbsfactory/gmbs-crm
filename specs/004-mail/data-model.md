# Data Model: Système d'envoi d'email CRM

**Date**: 2025-01-19  
**Feature**: 004-mail

## Vue d'ensemble

Ce document décrit le modèle de données pour le système d'envoi d'email CRM, incluant les modifications de schéma de base de données et les structures de données utilisées dans l'application.

## Modifications du Schéma de Base de Données

### Table `users` (modification)

**Colonnes ajoutées**:

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `email_smtp` | `text` | ✅ Oui | Adresse email Gmail utilisée pour l'envoi d'emails (ex: gestionnaire@gmail.com) |
| `email_password_encrypted` | `text` | ✅ Oui | Mot de passe d'application Gmail chiffré avec AES-256-CBC |

**Index**:
- `idx_users_email_smtp` : Index sur `email_smtp` (WHERE email_smtp IS NOT NULL)

**RLS (Row Level Security)**:
- `users_email_smtp_select` : Les utilisateurs peuvent voir uniquement leurs propres credentials email
- `users_email_smtp_update` : Les utilisateurs peuvent modifier uniquement leurs propres credentials email

**Contraintes**:
- Aucune contrainte supplémentaire (valeurs optionnelles)

---

### Table `email_logs` (nouvelle table)

**Colonnes**:

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | `uuid` | ❌ Non | Identifiant unique (PRIMARY KEY, DEFAULT gen_random_uuid()) |
| `intervention_id` | `uuid` | ✅ Oui | Référence à l'intervention (FK → interventions.id, ON DELETE SET NULL) |
| `artisan_id` | `uuid` | ✅ Oui | Référence à l'artisan destinataire (FK → artisans.id, ON DELETE SET NULL) |
| `sent_by` | `uuid` | ✅ Oui | Utilisateur qui a envoyé l'email (FK → users.id, ON DELETE SET NULL) |
| `recipient_email` | `text` | ❌ Non | Email du destinataire (artisan) |
| `subject` | `text` | ❌ Non | Sujet de l'email |
| `message_html` | `text` | ✅ Oui | Corps HTML de l'email |
| `email_type` | `text` | ✅ Oui | Type d'email : 'devis' ou 'intervention' (CHECK: IN ('devis', 'intervention')) |
| `attachments_count` | `int` | ✅ Oui | Nombre de pièces jointes (DEFAULT 0) |
| `status` | `text` | ❌ Non | Statut : 'sent', 'failed', ou 'pending' (CHECK: IN ('sent', 'failed', 'pending')) |
| `error_message` | `text` | ✅ Oui | Message d'erreur si échec (NULL si succès) |
| `sent_at` | `timestamptz` | ✅ Oui | Date d'envoi (DEFAULT now()) |
| `created_at` | `timestamptz` | ✅ Oui | Date de création (DEFAULT now()) |

**Index**:
- `idx_email_logs_intervention` : Index sur `intervention_id`
- `idx_email_logs_artisan` : Index sur `artisan_id`
- `idx_email_logs_sent_by` : Index sur `sent_by`
- `idx_email_logs_sent_at` : Index sur `sent_at` (pour tri chronologique)
- `idx_email_logs_type` : Index sur `email_type`

**RLS (Row Level Security)**:
- `email_logs_select_own` : Les utilisateurs peuvent voir leurs propres logs d'envoi
- `email_logs_select_admin` : Les admins peuvent voir tous les logs

**Contraintes**:
- CHECK sur `email_type` : doit être 'devis' ou 'intervention'
- CHECK sur `status` : doit être 'sent', 'failed', ou 'pending'
- Foreign keys avec ON DELETE SET NULL (pour préserver les logs même si intervention/artisan/user supprimé)

**Note sur le statut 'pending'**:
- Dans la v1, seuls les statuts 'sent' et 'failed' sont utilisés
- Le statut 'pending' est réservé pour une future évolution avec file d'attente asynchrone
- Migration future facilitée (pas besoin de modifier le schéma)

---

## Structures de Données TypeScript

### Interface `EmailTemplateData`

```typescript
interface EmailTemplateData {
  nomClient: string                    // Obligatoire : Prénom Nom ou Nom uniquement
  telephoneClient: string              // Obligatoire : Téléphone principal
  telephoneClient2?: string             // Optionnel : Téléphone secondaire (défaut: "")
  adresseComplete: string              // Obligatoire : "adresse, code_postal ville"
  datePrevue?: string                  // Optionnel : Date prévue (défaut: "À définir")
  consigneArtisan?: string             // Optionnel : Consigne pour l'artisan (défaut: "Aucune description fournie")
  coutSST?: string                     // Optionnel : Coût SST formaté (défaut: "Non spécifié")
  commentaire?: string                 // Optionnel : Commentaire (défaut: "", section non affichée si vide)
  idIntervention?: string              // Optionnel : ID intervention (défaut: "")
}
```

**Règles de construction**:
- `nomClient` : `${tenants.firstname || ''} ${tenants.lastname || ''}`.trim()
- `adresseComplete` : `${intervention.adresse}, ${intervention.code_postal} ${intervention.ville}`
- `consigneArtisan` : Si artisan principal (`is_primary=true`) → `consigne_intervention`, sinon → `consigne_second_artisan`
- `coutSST` : Uniquement depuis `intervention_costs` où `cost_type='sst'` (sans matériel)

---

### Interface `SendEmailParams`

```typescript
interface SendEmailParams {
  type: 'devis' | 'intervention'
  artisanId: string
  artisanEmail: string
  subject: string
  htmlContent: string
  attachments?: Attachment[]           // Optionnel : Pièces jointes supplémentaires (en plus du logo GMBS automatique)
}
```

---

### Interface `Attachment`

```typescript
interface Attachment {
  filename: string
  path?: string                        // Chemin fichier système
  content?: Buffer                     // Contenu en mémoire
  cid?: string                        // Content-ID pour images inline
  contentType?: string                 // MIME type (ex: 'image/png', 'application/pdf')
}
```

**Note**: Le logo GMBS utilise toujours `cid: 'logoGM'` et est automatiquement inclus.

---

### Interface `SendEmailResult`

```typescript
interface SendEmailResult {
  success: boolean
  emailLogId?: string                  // ID du log créé dans email_logs
  error?: string                       // Message d'erreur si échec
}
```

---

### Interface `EmailLog` (correspond à la table `email_logs`)

```typescript
interface EmailLog {
  id: string
  intervention_id: string | null
  artisan_id: string | null
  sent_by: string | null
  recipient_email: string
  subject: string
  message_html: string | null
  email_type: 'devis' | 'intervention' | null
  attachments_count: number
  status: 'sent' | 'failed' | 'pending'
  error_message: string | null
  sent_at: string                      // ISO 8601 timestamp
  created_at: string                   // ISO 8601 timestamp
}
```

---

## Relations

### Relations avec tables existantes

```
users (1) ──< (N) email_logs.sent_by
interventions (1) ──< (N) email_logs.intervention_id
artisans (1) ──< (N) email_logs.artisan_id
```

**Cardinalités**:
- Un utilisateur peut avoir plusieurs logs d'envoi (1:N)
- Une intervention peut avoir plusieurs logs d'envoi (1:N)
- Un artisan peut recevoir plusieurs emails (1:N)

**Comportement ON DELETE**:
- Toutes les foreign keys utilisent `ON DELETE SET NULL` pour préserver les logs même si l'entité référencée est supprimée

---

## Validation des Données

### Champs obligatoires (validation serveur)

Avant l'envoi d'un email, les champs suivants doivent être présents et non vides :
- `nomClient` : Chaîne non vide après trim
- `telephoneClient` : Chaîne non vide après trim
- `adresseComplete` : Chaîne non vide après trim

**Erreur retournée** : `400 Bad Request` avec message détaillé si champs obligatoires manquants

### Champs optionnels (valeurs par défaut)

Si les champs suivants sont absents ou vides, des valeurs par défaut sont appliquées :
- `telephoneClient2` : `""` (chaîne vide)
- `datePrevue` : `"À définir"`
- `consigneArtisan` : `"Aucune description fournie"`
- `coutSST` : `"Non spécifié"`
- `commentaire` : `""` (chaîne vide, section non affichée dans le template si vide)
- `idIntervention` : `""` (chaîne vide)

---

## Migration SQL

**Fichier**: `supabase/migrations/YYYYMMDDHHMMSS_add_email_smtp_fields.sql`

**Contenu**:
- Extension `pgcrypto` (pour fonctions de chiffrement si nécessaire côté DB)
- Colonnes `email_smtp` et `email_password_encrypted` dans `users`
- Table `email_logs` complète avec tous les champs, index, RLS
- Commentaires pour documentation

**Réversibilité**: 
- Migration réversible (DROP TABLE email_logs, ALTER TABLE users DROP COLUMN ...)
- Pas de perte de données si rollback (colonnes optionnelles)

---

## Exemples de Données

### Exemple d'entrée dans `users`

```sql
INSERT INTO users (id, email_smtp, email_password_encrypted)
VALUES (
  'user-uuid-123',
  'gestionnaire@gmail.com',
  'encrypted-password-base64-string-here'
);
```

### Exemple d'entrée dans `email_logs`

```sql
INSERT INTO email_logs (
  intervention_id,
  artisan_id,
  sent_by,
  recipient_email,
  subject,
  message_html,
  email_type,
  attachments_count,
  status,
  sent_at
)
VALUES (
  'intervention-uuid-456',
  'artisan-uuid-789',
  'user-uuid-123',
  'artisan@example.com',
  'Demande de devis - Intervention #12345',
  '<html>...</html>',
  'devis',
  1,  -- Logo GMBS automatique
  'sent',
  NOW()
);
```

---

## Notes Techniques

1. **Chiffrement** : Le mot de passe est chiffré côté application (Node.js) avant insertion dans la base de données. La base de données stocke uniquement le texte chiffré.

2. **RLS** : Les politiques RLS garantissent que les utilisateurs ne peuvent accéder qu'à leurs propres données (sauf admins).

3. **Logs préservés** : Les foreign keys avec `ON DELETE SET NULL` garantissent que les logs sont préservés même si l'intervention, l'artisan ou l'utilisateur est supprimé.

4. **Index** : Les index sont optimisés pour les requêtes fréquentes (par intervention, artisan, utilisateur, date, type).

5. **Statut 'pending'** : Réservé pour future évolution, non utilisé dans v1.

