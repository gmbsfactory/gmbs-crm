# Variables d'environnement pour l'import Google Drive

Ce fichier documente les variables d'environnement requises pour les scripts d'import Google Drive.

## Configuration Google Drive

Les scripts utilisent `scripts/imports/config/google-drive-config.js` pour charger la configuration.

### Variables requises

#### Credentials Google Drive (une des options suivantes)

**Option 1 : Fichier de credentials**
- `GOOGLE_CREDENTIALS_PATH` : Chemin vers le fichier JSON de credentials Google Service Account

**Option 2 : Variables d'environnement directes**
- `GOOGLE_SHEETS_CLIENT_EMAIL` ou `GOOGLE_DRIVE_CLIENT_EMAIL` : Email du compte de service
- `GOOGLE_SHEETS_PRIVATE_KEY` ou `GOOGLE_DRIVE_PRIVATE_KEY` : Clé privée du compte de service (avec `\n` décodés)

#### Configuration spécifique Drive

- `GOOGLE_DRIVE_ROOT_FOLDER_ID` : ID du dossier racine dans Google Drive (optionnel si `GOOGLE_DRIVE_ROOT_FOLDER_PATH` est utilisé)
- `GOOGLE_DRIVE_ROOT_FOLDER_PATH` : Chemin du dossier racine (défaut: `'artisans'`)

### Configuration Supabase

- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL` : URL de l'instance Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service Supabase (requise pour les insertions directes)

## Exemple de configuration dans .env.local

```bash
# Google Drive Credentials
GOOGLE_CREDENTIALS_PATH=/path/to/credentials.json
# OU
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Drive Configuration
GOOGLE_DRIVE_ROOT_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
GOOGLE_DRIVE_ROOT_FOLDER_PATH=artisans

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

## Référence

Voir `scripts/imports/config/google-drive-config.js` (lignes 41-118) pour le contrat d'environnement complet.

