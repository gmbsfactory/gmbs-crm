# Guide de Configuration des Credentials Google Cloud

Ce guide vous accompagne étape par étape pour configurer l'authentification Google Cloud nécessaire à l'import des données depuis Google Sheets.

## 📋 Prérequis

- Un compte Google (Gmail, Google Workspace, etc.)
- Accès à [Google Cloud Console](https://console.cloud.google.com)
- Les Google Sheets que vous souhaitez importer doivent être accessibles

---

## 🚀 Étape 1 : Créer un projet Google Cloud

### 1.1 Accéder à Google Cloud Console
1. Allez sur [console.cloud.google.com](https://console.cloud.google.com)
2. Connectez-vous avec votre compte Google
3. Si c'est votre premier projet, acceptez les conditions d'utilisation

### 1.2 Créer un nouveau projet
1. Cliquez sur le sélecteur de projet en haut à gauche
2. Cliquez sur "Nouveau projet"
3. Donnez un nom à votre projet (ex: "GMBS-CRM-Import")
4. Optionnellement, sélectionnez une organisation
5. Cliquez sur "Créer"

### 1.3 Sélectionner le projet
1. Une fois le projet créé, sélectionnez-le dans le sélecteur de projet
2. Vérifiez que vous êtes bien dans le bon projet

---

## 🔧 Étape 2 : Activer l'API Google Sheets

### 2.1 Accéder aux APIs et services
1. Dans le menu de gauche, cliquez sur "APIs et services"
2. Cliquez sur "Bibliothèque"

### 2.2 Rechercher et activer l'API Google Sheets
1. Dans la barre de recherche, tapez "Google Sheets API"
2. Cliquez sur "Google Sheets API"
3. Cliquez sur "Activer"
4. Attendez quelques secondes que l'API soit activée

### 2.3 Vérifier l'activation
1. Retournez à "APIs et services" > "Tableau de bord"
2. Vous devriez voir "Google Sheets API" dans la liste des APIs activées

---

## 🔐 Étape 3 : Créer un compte de service

### 3.1 Accéder aux comptes de service
1. Dans le menu de gauche, cliquez sur "APIs et services"
2. Cliquez sur "Identifiants"

### 3.2 Créer un compte de service
1. Cliquez sur "Créer des identifiants"
2. Sélectionnez "Compte de service"
3. Remplissez les informations :
   - **Nom** : `gmbs-sheets-import` (ou un nom de votre choix)
   - **ID du compte de service** : sera généré automatiquement
   - **Description** : `Compte de service pour l'import des données Google Sheets vers GMBS CRM`
4. Cliquez sur "Créer et continuer"

### 3.3 Configurer les rôles (optionnel)
1. Dans l'écran suivant, vous pouvez attribuer des rôles (laissez vide pour l'instant)
2. Cliquez sur "Continuer"
3. Cliquez sur "Terminé"

---

## 🔑 Étape 4 : Générer une clé de compte de service

### 4.1 Accéder au compte de service créé
1. Dans la liste des comptes de service, cliquez sur le compte que vous venez de créer
2. Vous devriez voir les détails du compte

### 4.2 Créer une clé
1. Cliquez sur l'onglet "Clés"
2. Cliquez sur "Ajouter une clé"
3. Sélectionnez "Créer une nouvelle clé"
4. Choisissez le format "JSON"
5. Cliquez sur "Créer"

### 4.3 Télécharger le fichier JSON
1. Le fichier JSON sera automatiquement téléchargé
2. **IMPORTANT** : Gardez ce fichier en sécurité, il contient des informations sensibles
3. Renommez le fichier en `credentials.json` pour plus de simplicité

---

## 📁 Étape 5 : Placer le fichier de credentials

### 5.1 Créer le répertoire de destination
```bash
# Dans le répertoire de votre projet
mkdir -p supabase/functions/credentials
```

### 5.2 Copier le fichier de credentials
```bash
# Copier le fichier téléchargé vers le répertoire du projet
cp ~/Downloads/credentials.json ./supabase/functions/credentials.json
```

### 5.3 Vérifier la structure
Votre fichier `credentials.json` devrait ressembler à ceci :
```json
{
  "type": "service_account",
  "project_id": "votre-projet-id",
  "private_key_id": "clé-privée-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "gmbs-sheets-import@votre-projet.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/gmbs-sheets-import%40votre-projet.iam.gserviceaccount.com"
}
```

---

## 🔒 Étape 6 : Partager les Google Sheets

### 6.1 Ouvrir votre Google Sheet
1. Ouvrez le Google Sheet que vous souhaitez importer
2. Cliquez sur le bouton "Partager" en haut à droite

### 6.2 Ajouter le compte de service
1. Dans le champ "Ajouter des personnes et des groupes", entrez l'email du compte de service
   - L'email se trouve dans votre fichier `credentials.json` (champ `client_email`)
   - Exemple : `gmbs-sheets-import@votre-projet.iam.gserviceaccount.com`
2. Sélectionnez le niveau d'accès "Lecteur"
3. Cliquez sur "Envoyer"

### 6.3 Répéter pour tous les sheets
Répétez cette étape pour tous les Google Sheets que vous souhaitez importer :
- Sheet des artisans
- Sheet des interventions
- Tout autre sheet nécessaire

---

## ⚙️ Étape 7 : Configurer les variables d'environnement

### 7.1 Mettre à jour le fichier .env.local
Ajoutez ou modifiez ces variables dans votre fichier `.env.local` :

```env
# Google Sheets Configuration
GOOGLE_SHEETS_ARTISANS_ID=1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA
GOOGLE_SHEETS_INTERVENTIONS_ID=1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA
GOOGLE_SHEETS_ID=1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA
GOOGLE_SHEETS_ARTISANS_RANGE=BASE de DONNÉE SST ARTISANS!A2:Z
GOOGLE_SHEETS_INTERVENTIONS_RANGE=SUIVI INTER GMBS 2025!A2:Z

# Credentials Path
GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json
```

### 7.2 Récupérer les IDs des Google Sheets
1. Ouvrez votre Google Sheet dans le navigateur
2. L'ID se trouve dans l'URL : `https://docs.google.com/spreadsheets/d/[ID_ICI]/edit`
3. Remplacez les valeurs dans `.env.local`

---

## 🧪 Étape 8 : Tester la configuration

### 8.1 Test de base
```bash
# Tester la connexion (mode dry-run)
node scripts/import-google-sheets-complete.js --dry-run --verbose
```

### 8.2 Vérifier les logs
Le script devrait afficher :
- ✅ Client Google Sheets initialisé
- ✅ Connexion à Supabase établie
- Récupération des données depuis Google Sheets
- [DRY-RUN] messages pour les opérations qui seraient effectuées

### 8.3 En cas d'erreur
Vérifiez :
- Le fichier `credentials.json` est au bon endroit
- L'email du compte de service a accès aux sheets
- Les IDs des sheets sont corrects
- Les noms des feuilles (ranges) sont corrects

---

## 🔧 Dépannage

### Problème : "Fichier de credentials introuvable"
```bash
# Vérifier que le fichier existe
ls -la supabase/functions/credentials.json

# Vérifier le chemin dans .env.local
echo $GOOGLE_CREDENTIALS_PATH
```

### Problème : "Permission denied" ou "Access denied"
1. Vérifiez que l'email du compte de service a bien accès aux sheets
2. Vérifiez que l'API Google Sheets est activée
3. Vérifiez que le compte de service a les bonnes permissions

### Problème : "Invalid credentials"
1. Vérifiez que le fichier JSON est valide
2. Vérifiez que le fichier n'a pas été corrompu
3. Régénérez une nouvelle clé si nécessaire

### Problème : "Sheet not found"
1. Vérifiez l'ID du sheet dans l'URL
2. Vérifiez que le sheet est bien partagé avec le compte de service
3. Vérifiez le nom de la feuille (range) dans la configuration

---

## 🔒 Sécurité

### Bonnes pratiques
1. **Ne jamais commiter le fichier `credentials.json`** dans Git
2. Ajoutez `supabase/functions/credentials.json` à votre `.gitignore`
3. Gardez le fichier dans un endroit sécurisé
4. Régénérez les clés régulièrement
5. Supprimez les clés inutilisées

### Ajouter au .gitignore
```gitignore
# Google Cloud credentials
supabase/functions/credentials.json
*.json
!package.json
!package-lock.json
!tsconfig.json
```

---

## 📚 Ressources utiles

### Documentation officielle
- [Google Cloud Console](https://console.cloud.google.com)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)

### Commandes utiles
```bash
# Tester la connexion Google Sheets
node -e "
const { google } = require('googleapis');
const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('./supabase/functions/credentials.json'));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
console.log('✅ Credentials valides');
"

# Vérifier les permissions d'un sheet
node -e "
const { google } = require('googleapis');
const fs = require('fs');
const credentials = JSON.parse(fs.readFileSync('./supabase/functions/credentials.json'));
const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });
sheets.spreadsheets.get({ spreadsheetId: 'VOTRE_SHEET_ID' })
  .then(res => console.log('✅ Accès au sheet OK:', res.data.properties.title))
  .catch(err => console.error('❌ Erreur:', err.message));
"
```

---

## ✅ Checklist finale

- [ ] Projet Google Cloud créé
- [ ] API Google Sheets activée
- [ ] Compte de service créé
- [ ] Clé JSON générée et téléchargée
- [ ] Fichier `credentials.json` placé dans `supabase/functions/`
- [ ] Google Sheets partagés avec le compte de service
- [ ] Variables d'environnement configurées dans `.env.local`
- [ ] Test en mode dry-run réussi
- [ ] Fichier `credentials.json` ajouté au `.gitignore`

---

*Guide créé le $(date) - Version 1.0*
