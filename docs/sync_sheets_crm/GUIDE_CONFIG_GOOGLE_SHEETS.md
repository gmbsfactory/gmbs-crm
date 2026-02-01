# 🔧 Configuration Google Sheets - Guide Rapide

**Problème** : `Configuration Google Sheets incomplète`

---

## 🎯 Solutions (3 méthodes au choix)

### ✅ Méthode 1 : Fichier credentials.json (Recommandé)

**Avantages** : Plus sécurisé, plus simple à gérer

1. **Créer un Service Account Google** :
   - Aller sur https://console.cloud.google.com/
   - Créer un projet (si pas déjà fait)
   - Activer l'API Google Sheets
   - Créer un compte de service (Service Account)
   - Télécharger le fichier JSON des credentials

2. **Placer le fichier** :
   ```bash
   # Copier le fichier téléchargé
   cp ~/Downloads/votre-projet-xxxxx.json ./supabase/functions/credentials.json
   ```

3. **Ajouter dans `.env.local`** :
   ```bash
   # Google Sheets Configuration - Méthode 1
   GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json
   GOOGLE_SHEETS_ID=votre_spreadsheet_id_ici
   ```

4. **Partager le Google Sheet** :
   - Ouvrir votre Google Sheet
   - Partager avec l'email du service account (dans le JSON : `client_email`)
   - Donner les droits en **Lecture seule**

---

### ✅ Méthode 2 : Variables d'environnement

**Avantages** : Pas de fichier à gérer

1. **Récupérer les infos** depuis le JSON du service account

2. **Ajouter dans `.env.local`** :
   ```bash
   # Google Sheets Configuration - Méthode 2
   GOOGLE_SHEETS_CLIENT_EMAIL=your-service@project.iam.gserviceaccount.com
   GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_PRIVEE_ICI\n-----END PRIVATE KEY-----"
   GOOGLE_SHEETS_SPREADSHEET_ID=votre_spreadsheet_id_ici
   ```

**⚠️ Important** : 
- La clé privée doit contenir `\n` pour les retours à la ligne
- Mettre des guillemets doubles autour de la clé privée

---

### ✅ Méthode 3 : Fichier à la racine

1. **Placer le fichier** :
   ```bash
   cp ~/Downloads/votre-projet-xxxxx.json ./credentials.json
   ```

2. **Le script le détectera automatiquement**

---

## 📋 Vérifier la configuration

```bash
# Test rapide
node -e "require('./scripts/imports/config/google-sheets-config').googleSheetsConfig.displayConfig()"
```

**Résultat attendu** :
```
🔧 Configuration Google Sheets:
  Client Email: your-service@project.iam.gserviceaccount.com
  Private Key: ✅ Définie
  Spreadsheet ID: 1abc...xyz
  Configuration valide: ✅ Oui
```

---

## 🔍 Trouver votre Spreadsheet ID

Dans l'URL de votre Google Sheet :
```
https://docs.google.com/spreadsheets/d/1abc...xyz/edit
                                        ↑
                                   Votre ID
```

---

## ⚡ Tester l'import

```bash
# Test sans écriture en base
npm run import:all -- --dry-run

# Import complet
npm run import:all
```

---

## 🆘 Si ça ne marche toujours pas

1. **Vérifier que le fichier `.env.local` existe** :
   ```bash
   ls -la .env.local
   ```

2. **Créer `.env.local` s'il n'existe pas** :
   ```bash
   cp env.example .env.local
   ```

3. **Vérifier les variables** :
   ```bash
   cat .env.local | grep GOOGLE
   ```

4. **Vérifier les permissions du Google Sheet** :
   - Le service account doit avoir accès au sheet
   - Vérifier l'email dans "Partager"

---

## 🎯 Configuration minimale requise

```bash
# Dans .env.local - MINIMUM
GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json
GOOGLE_SHEETS_ID=votre_spreadsheet_id

# OU

GOOGLE_SHEETS_CLIENT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_SHEETS_SPREADSHEET_ID=votre_spreadsheet_id
```

---

**Besoin d'aide ?** Consultez `docs/guide/google-credentials-setup.md`

