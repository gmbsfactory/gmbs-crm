# Résumé - Scripts d'Import Google Sheets

## 🎯 Ce qui a été créé

J'ai créé un système complet d'import de données depuis Google Sheets vers votre base de données Supabase pour le CRM GMBS.

## 📁 Fichiers créés

### Scripts principaux
- `scripts/import-google-sheets-complete.js` - Script principal d'import
- `scripts/test-google-sheets-connection.js` - Script de test de la configuration
- `scripts/setup-google-import.js` - Script de configuration interactive

### Documentation
- `docs/guide/google-credentials-setup.md` - Guide détaillé pour configurer les credentials Google
- `scripts/README.md` - Documentation des scripts d'import
- `IMPORT_GOOGLE_SHEETS_SUMMARY.md` - Ce fichier de résumé

### Mises à jour
- `package.json` - Ajout des nouveaux scripts npm
- `docs/guide/guide_installation.md` - Mise à jour avec les nouvelles étapes

## 🚀 Utilisation rapide

### 1. Configuration initiale
```bash
# Configuration interactive (recommandé)
npm run import:setup

# Ou test de la configuration
npm run import:test
```

### 2. Import des données
```bash
# Mode test (sans écriture en base)
npm run import:dry-run

# Import complet
npm run import:all

# Import sélectif
npm run import:artisans
npm run import:interventions
```

## ⚙️ Configuration requise

### Variables d'environnement (.env.local)
```env
# Google Sheets Configuration
GOOGLE_SHEETS_ARTISANS_ID=1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA
GOOGLE_SHEETS_INTERVENTIONS_ID=1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA
GOOGLE_SHEETS_ARTISANS_RANGE=BASE de DONNÉE SST ARTISANS!A2:Z
GOOGLE_SHEETS_INTERVENTIONS_RANGE=SUIVI INTER GMBS 2025!A2:Z
GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Fichier de credentials Google
- Placez votre fichier `credentials.json` dans `supabase/functions/`
- Suivez le guide : `docs/guide/google-credentials-setup.md`

## 🔧 Fonctionnalités

### Script principal (`import-google-sheets-complete.js`)
- ✅ Import des artisans et interventions
- ✅ Mapping automatique des colonnes
- ✅ Traitement par lots configurable
- ✅ Mode dry-run pour les tests
- ✅ Gestion d'erreurs robuste
- ✅ Logging détaillé
- ✅ Support des métiers avec création automatique
- ✅ Conversion des types de données
- ✅ Gestion des dates et nombres

### Script de test (`test-google-sheets-connection.js`)
- ✅ Vérification des variables d'environnement
- ✅ Validation du fichier de credentials
- ✅ Test de connexion Google Sheets
- ✅ Vérification de l'accès aux sheets
- ✅ Test de la structure des données
- ✅ Validation du mapping des colonnes

### Script de configuration (`setup-google-import.js`)
- ✅ Configuration interactive des variables
- ✅ Vérification de la configuration actuelle
- ✅ Test de connexion intégré
- ✅ Lancement d'imports de test
- ✅ Aide contextuelle

## 📊 Mapping des données

### Artisans
Le script mappe automatiquement 25+ colonnes Google Sheets vers les champs de la base de données, incluant :
- Informations personnelles (nom, prénom, téléphone, email)
- Informations d'entreprise (raison sociale, SIRET, statut juridique)
- Adresses (siège social et intervention)
- Coordonnées GPS
- Coûts et gains
- Métiers (avec création automatique)

### Interventions
Le script mappe 40+ colonnes pour les interventions, incluant :
- Informations de base (date, agence, contexte)
- Adresses et coordonnées
- Informations clients et propriétaires
- Coûts et marges
- Statuts et suivi
- Pièces jointes (JSON)

## 🛠️ Options avancées

### Options du script principal
```bash
--dry-run              # Mode test sans écriture
--batch-size=N         # Taille des lots (défaut: 50)
--verbose              # Affichage détaillé
--artisans-only        # Import uniquement des artisans
--interventions-only   # Import uniquement des interventions
--help                 # Aide
```

### Scripts npm disponibles
```bash
npm run import:setup        # Configuration interactive
npm run import:test         # Test de connexion
npm run import:test:verbose # Test avec logs détaillés
npm run import:dry-run      # Import de test
npm run import:artisans     # Import artisans uniquement
npm run import:interventions # Import interventions uniquement
npm run import:all          # Import complet
```

## 🔒 Sécurité

- ✅ Fichier `credentials.json` automatiquement ignoré par Git
- ✅ Variables d'environnement pour les données sensibles
- ✅ Mode dry-run pour tester sans risque
- ✅ Gestion d'erreurs pour éviter les corruptions
- ✅ Validation des données avant insertion

## 📚 Documentation

- **Guide d'installation** : `docs/guide/guide_installation.md`
- **Configuration Google** : `docs/guide/google-credentials-setup.md`
- **Documentation scripts** : `scripts/README.md`

## 🎯 Prochaines étapes

1. **Configurez les credentials Google** en suivant le guide détaillé
2. **Lancez la configuration interactive** : `npm run import:setup`
3. **Testez la connexion** : `npm run import:test`
4. **Lancez un import de test** : `npm run import:dry-run`
5. **Importez les données** : `npm run import:all`

## 🆘 Support

En cas de problème :
1. Consultez les guides de documentation
2. Utilisez le script de test pour diagnostiquer
3. Vérifiez les logs avec l'option `--verbose`
4. Contactez l'équipe de développement

---

*Système d'import Google Sheets créé le 09/20/2025 - Version 1.0*
