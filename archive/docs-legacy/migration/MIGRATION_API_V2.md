# Migration vers l'API Modulaire V2

## 🚀 Nouvelle Architecture

L'API CRM a été refactorisée en une architecture modulaire pour améliorer la maintenabilité, la performance et l'évolutivité.

### Structure Modulaire
```
src/lib/api/v2/
├── index.ts                 # Point d'entrée central
├── common/
│   ├── types.ts            # Types et interfaces communs
│   └── utils.ts            # Utilitaires partagés
├── usersApi.ts             # Gestion des utilisateurs
├── interventionsApi.ts     # Gestion des interventions
├── artisansApi.ts          # Gestion des artisans
├── clientsApi.ts           # Gestion des clients
├── documentsApi.ts         # Gestion des documents
├── commentsApi.ts          # Gestion des commentaires
├── rolesApi.ts             # Gestion des rôles et permissions
└── utilsApi.ts             # Utilitaires généraux
```

## 📦 Scripts d'Import Refactorisés

### Nouveaux Scripts V2
- `scripts/imports/google-sheets-import-clean-v2.js` - Script principal d'import V2
- `scripts/imports/database/database-manager-v2.js` - Gestionnaire de base de données V2

### Scripts Legacy (à migrer)
- `scripts/imports/google-sheets-import-clean.js` - Script principal d'import (legacy)
- `scripts/imports/database/database-manager-clean.js` - Gestionnaire de base de données (legacy)

## 🔄 Migration des Imports

### Avant (Legacy)
```javascript
const { artisansApiV2, interventionsApiV2, clientsApi, documentsApi } = require('../../../src/lib/supabase-api-v2');
```

### Après (V2 Modulaire)
```javascript
const { artisansApi, interventionsApi, clientsApi, documentsApi } = require('../../../src/lib/api/v2');
```

## 🎯 Avantages de la Migration

### 1. **Maintenabilité**
- Code organisé par domaine métier
- Responsabilités clairement séparées
- Plus facile à déboguer et modifier

### 2. **Performance**
- Import sélectif des fonctionnalités
- Réduction de la taille du bundle
- Chargement à la demande

### 3. **Évolutivité**
- Ajout de nouvelles APIs sans impact
- Tests unitaires plus faciles
- Déploiement indépendant des modules

### 4. **Compatibilité**
- Alias pour la rétrocompatibilité
- Migration progressive possible
- Support des deux versions en parallèle

## 🛠️ Utilisation des Scripts V2

### Import Complet
```bash
node scripts/imports/google-sheets-import-clean-v2.js
```

### Import avec Options
```bash
# Mode dry-run avec verbose
node scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

# Import sélectif
node scripts/imports/google-sheets-import-clean-v2.js --artisans-only
node scripts/imports/google-sheets-import-clean-v2.js --interventions-only
node scripts/imports/google-sheets-import-clean-v2.js --clients-only
node scripts/imports/google-sheets-import-clean-v2.js --documents-only
```

### Tests et Validation
```bash
# Test de connexion
node scripts/imports/google-sheets-import-clean-v2.js --test-connection

# Validation de configuration
node scripts/imports/google-sheets-import-clean-v2.js --validate-config
```

## 📋 Plan de Migration

### Phase 1 : Migration des Scripts ✅
- [x] Création de `database-manager-v2.js`
- [x] Création de `google-sheets-import-clean-v2.js`
- [x] Utilisation de l'API modulaire V2

### Phase 2 : Tests et Validation 🔄
- [ ] Tests des nouveaux scripts
- [ ] Validation des performances
- [ ] Comparaison avec les scripts legacy

### Phase 3 : Déploiement 🚀
- [ ] Migration progressive
- [ ] Documentation utilisateur
- [ ] Formation de l'équipe

### Phase 4 : Nettoyage 🧹
- [ ] Suppression des scripts legacy
- [ ] Nettoyage des dépendances
- [ ] Mise à jour de la documentation

## 🔧 Configuration

### Variables d'Environnement
Les scripts V2 utilisent les mêmes variables d'environnement que les scripts legacy :

```env
# Google Sheets
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id

# Base de données
DATABASE_URL=your-database-url
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
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
**Solution** : Vérifier les variables d'environnement et la configuration

#### 3. Erreur de Permissions
```bash
Error: Insufficient permissions
```
**Solution** : Vérifier les credentials Google Sheets et les permissions Supabase

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
