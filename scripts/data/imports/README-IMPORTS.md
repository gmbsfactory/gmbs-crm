# 🚀 GMBS CRM - Import Google Sheets

## 📖 Description

Script unique et modulaire pour l'import des données depuis Google Sheets vers la base de données Supabase du CRM GMBS.

## 🔧 Configuration

### **Méthodes de Configuration (par ordre de priorité)**

1. **Variables d'environnement** (recommandé pour la production)
2. **Fichier .env.local** (recommandé pour le développement)
3. **Fichier credentials.json** (fallback)

### **Variables Requises**

```bash
# Email du service account Google
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Clé privée du service account (remplacez \\n par de vrais retours à la ligne)
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"

# ID du Google Spreadsheet (optionnel, peut être passé en paramètre)
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
```

### **Configuration Rapide**

```bash
# 1. Générer l'exemple de configuration
node scripts/imports/generate-env-example.js --generate

# 2. Copier et configurer
cp .env.local.example .env.local
# Éditez .env.local avec vos credentials

# 3. Tester la configuration
node scripts/imports/generate-env-example.js --show
```

## 🚀 Utilisation

### **Installation des Dépendances**

```bash
npm install google-spreadsheet csv-parser
```

### **Commandes Principales**

```bash
# Test complet (avec .env.local configuré)
node scripts/imports/google-sheets-import.js --test --verbose

# Import uniquement des artisans
node scripts/imports/google-sheets-import.js --artisans-only

# Import uniquement des interventions
node scripts/imports/google-sheets-import.js --interventions-only

# Import complet en production
node scripts/imports/google-sheets-import.js --verbose

# Avec ID explicite (si pas dans .env.local)
node scripts/imports/google-sheets-import.js --spreadsheet-id=YOUR_ID --test --verbose
```

## ⚙️ Options Disponibles

| Option | Description |
|--------|-------------|
| `--test` | Mode test (génère rapport dans `data/imports/processed`) |
| `--artisans-only` | Importer uniquement les artisans |
| `--interventions-only` | Importer uniquement les interventions |
| `--dry-run` | Mode test sans écriture en base |
| `--verbose` | Affichage détaillé |
| `--batch-size=N` | Taille des lots (défaut: 50) |
| `--credentials=PATH` | Chemin vers credentials.json (fallback) |
| `--spreadsheet-id=ID` | ID du Google Spreadsheet (si pas dans .env.local) |
| `--help` | Afficher l'aide |

## 🏗️ Architecture

```
scripts/
├── 📁 imports/                    # Scripts d'import
│   ├── google-sheets-import.js    # 🎯 Script principal unique
│   ├── generate-env-example.js    # Générateur de configuration
│   ├── 📁 config/                 # Configuration
│   │   └── google-sheets-config.js # Gestionnaire de config
│   ├── 📁 database/               # Gestionnaires de base de données
│   │   ├── database-manager.js    # Gestionnaire principal
│   │   └── data-integrity-checker.js # Vérifications d'intégrité
│   ├── 📁 tests/                  # Tests unitaires
│   │   └── mapping.test.js
│   ├── 📁 examples/               # Exemples d'utilisation
│   │   └── validation-examples.js
│   └── 📁 docs/                   # Documentation
│       └── avoid-redundancy-guide.md
├── 📁 data-processing/             # Modules de traitement
│   ├── data-mapper.js            # Mapping CSV → DB
│   ├── data-validator.js         # Validation centralisée
│   └── validation/               # Validateurs spécialisés
│       ├── artisan-validator.js
│       ├── intervention-validator.js
│       ├── client-validator.js
│       └── common-rules.js
└── 📁 backup/                    # Sauvegarde
    └── sql-to-sheets-backup.js
```

## 📊 Fonctionnalités

### ✅ **Configuration Flexible**
- **Variables d'environnement** pour la production
- **Fichier .env.local** pour le développement
- **Fallback credentials.json** pour compatibilité
- **Générateur automatique** d'exemples de configuration

### ✅ **Import Intelligent**
- **Mapping automatique** des colonnes Google Sheets vers le schéma DB
- **Validation robuste** avec codes d'erreur structurés
- **Gestion des erreurs** avec rapports détaillés
- **Traitement par lots** pour optimiser les performances

### ✅ **Gestion des Documents Drive**
- **Colonne "Document Drive"** automatiquement traitée
- **Conversion nom → URL** Google Drive
- **Stockage en base** pour référence future

### ✅ **Rapports Détaillés**
- **Mode test** : Génère des rapports dans `data/imports/processed/`
- **Statistiques complètes** : Traités, valides, insérés, erreurs
- **Détails des erreurs** avec numéros de ligne
- **Taux de succès** par type de données

### ✅ **Architecture Modulaire**
- **Zéro redondance** : Code écrit une fois, utilisé partout
- **Validation centralisée** : Mêmes règles dans tous les composants
- **API Supabase intégrée** : Utilise `supabase-api-v2.ts`
- **Extensible** : Facile d'ajouter de nouveaux types de données

## 🔧 Configuration du Package.json

Ajoutez ces scripts à votre `package.json` :

```json
{
  "scripts": {
    "import:config": "node scripts/imports/generate-env-example.js --generate",
    "import:test": "node scripts/imports/google-sheets-import.js --test --verbose",
    "import:artisans": "node scripts/imports/google-sheets-import.js --artisans-only",
    "import:interventions": "node scripts/imports/google-sheets-import.js --interventions-only",
    "import:all": "node scripts/imports/google-sheets-import.js --verbose"
  }
}
```

## 📋 Structure des Données

### **Artisans**
- **Source** : Feuille `GMBS-BASEdeDONNÉE_SST_ARTISANS`
- **Mapping** : Nom Prénom → `prenom` + `nom`
- **Drive** : Colonne "Document Drive" → `document_drive_url`
- **Validation** : Email, téléphone, SIRET, code postal

### **Interventions**
- **Source** : Feuille `GMBS-SUIVI_INTER_GMBS_2025`
- **Mapping** : ID, Date, Agence, Adresse, Statut, etc.
- **Relations** : Coûts, clients automatiquement mappés
- **Validation** : Dates, pourcentages, références

## 🧪 Tests

```bash
# Test des imports
node scripts/imports/tests/mapping.test.js

# Exemples de validation
node scripts/imports/examples/validation-examples.js

# Vérifier la configuration
node scripts/imports/generate-env-example.js --show
```

## 🔍 Dépannage

### **Erreur "Cannot find module"**
- Vérifiez que `google-spreadsheet` est installé
- Vérifiez le chemin vers `credentials.json`

### **Erreur "Aucune configuration Google Sheets trouvée"**
- Générez l'exemple : `node scripts/imports/generate-env-example.js --generate`
- Configurez `.env.local` avec vos credentials
- Vérifiez la configuration : `node scripts/imports/generate-env-example.js --show`

### **Erreur "Spreadsheet not found"**
- Vérifiez l'ID du spreadsheet
- Vérifiez les permissions du service account

### **Erreur "Invalid credentials"**
- Vérifiez le format de la clé privée (\\n → vrais retours à la ligne)
- Vérifiez que le service account a accès au spreadsheet

## 💡 Bonnes Pratiques

1. **Utilisez .env.local** pour le développement
2. **Variables d'environnement** pour la production
3. **Toujours tester** avec `--test` avant l'import en production
4. **Vérifiez les rapports** dans `data/imports/processed/`
5. **Utilisez `--verbose`** pour le debugging
6. **Importer par étapes** : artisans puis interventions
7. **Sauvegardez** avant les imports importants

## 🎯 Avantages

- **Configuration flexible** : Variables d'environnement ou fichiers
- **Script unique** : Plus de confusion entre plusieurs fichiers
- **Architecture claire** : Séparation des responsabilités
- **Modulaire** : Facile à maintenir et étendre
- **Robuste** : Gestion d'erreurs complète
- **Scalable** : Prêt pour de nombreux utilisateurs
- **Documenté** : Code auto-documenté et exemples

## 🚀 Prochaines Étapes

1. **Générez** la configuration : `node scripts/imports/generate-env-example.js --generate`
2. **Configurez** votre `.env.local` avec vos credentials
3. **Testez** avec `--test --verbose`
4. **Adaptez** le `package.json` avec vos scripts
5. **Lancez** l'import en production
6. **Surveillez** les rapports générés

Cette architecture est prête pour la production et facilement extensible ! 🎯
