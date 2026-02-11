# Scripts d'Import Google Sheets V2

## 🚀 Nouveaux Scripts avec API Modulaire

### Scripts Principaux
- `google-sheets-import-clean-v2.js` - Script principal d'import V2
- `database-manager-v2.js` - Gestionnaire de base de données V2

### Scripts de Support
- `test-api-v2.js` - Tests de l'API modulaire V2
- `compare-api.js` - Comparaison Legacy vs V2
- `migrate-api.js` - Assistant de migration
- `deploy-api-v2.js` - Déploiement de l'API V2

## 🎯 Utilisation

### Import Complet
```bash
npx tsx scripts/imports/google-sheets-import-clean-v2.js
```

### Import avec Options
```bash
# Mode dry-run avec verbose
npx tsx scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

# Import sélectif
npx tsx scripts/imports/google-sheets-import-clean-v2.js --artisans-only
npx tsx scripts/imports/google-sheets-import-clean-v2.js --interventions-only
npx tsx scripts/imports/google-sheets-import-clean-v2.js --clients-only
npx tsx scripts/imports/google-sheets-import-clean-v2.js --documents-only
```

### Tests et Validation
```bash
# Test de connexion
npx tsx scripts/imports/google-sheets-import-clean-v2.js --test-connection

# Validation de configuration
npx tsx scripts/imports/google-sheets-import-clean-v2.js --validate-config
```

## 🧪 Tests

### Tests API V2
```bash
# Tests complets
npx tsx scripts/test-api-v2.js

# Test d'une API spécifique
npx tsx scripts/test-api-v2.js --api users
npx tsx scripts/test-api-v2.js --api interventions
```

### Comparaison Legacy vs V2
```bash
npx tsx scripts/compare-api.js
```

## 🔄 Migration

### Migration Automatique
```bash
# Migration complète du projet
npx tsx scripts/migrate-api.js

# Validation de la migration
npx tsx scripts/migrate-api.js --validate

# Migration d'un fichier spécifique
npx tsx scripts/migrate-api.js --file src/components/UserList.tsx

# Migration d'un répertoire
npx tsx scripts/migrate-api.js --dir scripts/imports
```

## 🚀 Déploiement

### Déploiement API V2
```bash
npx tsx scripts/deploy-api-v2.js
```

## 📊 Avantages de la Version V2

### 1. **API Modulaire**
- Utilise la nouvelle structure `src/lib/api/v2/`
- Import sélectif des fonctionnalités
- Meilleure organisation du code

### 2. **Performance Améliorée**
- Traitement par lots optimisé
- Gestion d'erreurs plus robuste
- Messages d'erreur plus détaillés

### 3. **Maintenabilité**
- Code plus organisé et modulaire
- Tests unitaires plus faciles
- Documentation mise à jour

### 4. **Compatibilité**
- Alias pour la rétrocompatibilité
- Migration progressive possible
- Support des deux versions en parallèle

## 🔧 Configuration

### Variables d'Environnement
```env
# Google Sheets
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id

# Base de données
DATABASE_URL=your-database-url
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Import
IMPORT_BATCH_SIZE=50
IMPORT_DRY_RUN=false
IMPORT_VERBOSE=false
```

## 🐛 Dépannage

### Problèmes Courants

#### 1. Erreur d'Import
```bash
Error: Cannot find module '../../../src/lib/api/v2'
```
**Solution** : Vérifier que la structure modulaire est bien créée

#### 2. Erreur de Connexion
```bash
Error: Connection to database failed
```
**Solution** : Vérifier les variables d'environnement

#### 3. Erreur de Permissions
```bash
Error: Insufficient permissions
```
**Solution** : Vérifier les credentials Google Sheets

## 📞 Support

Pour toute question ou problème :
1. Vérifier la documentation `docs/API_CRM_COMPLETE.md`
2. Consulter les logs d'erreur détaillés
3. Tester avec `--dry-run` pour diagnostiquer
4. Contacter l'équipe de développement

## 📝 Changelog

### Version 2.0.0
- ✅ Architecture modulaire complète
- ✅ Scripts d'import refactorisés
- ✅ Amélioration des performances
- ✅ Meilleure gestion d'erreurs
- ✅ Documentation mise à jour

### Version 1.0.0 (Legacy)
- ✅ Scripts d'import fonctionnels
- ✅ API monolithique
- ✅ Fonctionnalités de base
