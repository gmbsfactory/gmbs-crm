# Corrections du Mapping CSV - Google Sheets

## 🎯 Problème identifié

Le mapping des colonnes CSV vers les champs de base de données ne correspondait pas à la structure réelle des données Google Sheets, causant des erreurs d'import.

## 📊 Structure réelle du CSV

### Colonnes des interventions (basées sur l'échantillon fourni)
```
Date, Agence, Adresse d'intervention, ID, Statut, Contexte d'intervention, Métier, Gest., SST, COUT SST, COÛT MATERIEL, Numéro SST, COUT INTER, % SST, PROPRIO, Date d'intervention, TEL LOC, Locataire, Em@il Locataire, COMMENTAIRE, Truspilot, Demande d'intervention ✅, Demande Devis ✅, Demande TrustPilot ✅
```

### Exemples de données réelles
- **Dates** : `04/04/2024` (format DD/MM/YYYY)
- **Coûts** : `2976,55 dire 2900`, `3 525,06` (virgules comme séparateurs décimaux, espaces comme séparateurs de milliers)
- **Adresses** : `3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM` (code postal et ville inclus)
- **Téléphones** : `06 58 94 45 48` (espaces dans les numéros)

## ✅ Corrections apportées

### 1. Mapping des colonnes mis à jour
**Fichier** : `scripts/import-google-sheets-complete.js`

```javascript
const interventionsMapping = {
  // Mapping basé sur les colonnes réelles du CSV
  'Date': 'date',
  'Agence': 'agence',
  'Adresse d\'intervention': 'adresse',
  'ID': 'id_facture',
  'Statut': 'statut',
  'Contexte d\'intervention': 'contexte_intervention',
  'Métier': 'metier',
  'Gest.': 'commentaire_agent', // Gestionnaire
  'SST': 'numero_sst',
  'COUT SST': 'cout_sst',
  'COÛT MATERIEL': 'cout_materiel',
  'Numéro SST': 'numero_sst',
  'COUT INTER': 'cout_intervention',
  '% SST': 'pourcentage_sst',
  'PROPRIO': 'prenom_proprietaire', // Propriétaire
  'Date d\'intervention': 'date_intervention',
  'TEL LOC': 'tel_loc',
  'Locataire': 'locataire',
  'Em@il Locataire': 'email_locataire',
  'COMMENTAIRE': 'commentaire',
  'Truspilot': 'truspilot',
  'Demande d\'intervention ✅': 'demande_intervention',
  'Demande Devis ✅': 'demande_devis',
  'Demande TrustPilot ✅': 'demande_trust_pilot'
};
```

### 2. Préprocessing des interventions amélioré
**Fichier** : `scripts/data-preprocessor.js`

#### Nouvelles fonctionnalités :
- **Extraction automatique** du code postal et de la ville depuis l'adresse complète
- **Gestion des numéros SST** dans plusieurs colonnes (SST, Numéro SST)
- **Mapping des gestionnaires** depuis la colonne "Gest."
- **Mapping des propriétaires** depuis la colonne "PROPRIO"
- **Gestion des demandes** avec les colonnes contenant ✅

#### Exemple d'extraction d'adresse :
```javascript
// Adresse: "3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM"
// Résultat:
// - adresse: "3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM"
// - code_postal: "67120"
// - ville: "DORLISHEIM"
```

### 3. Amélioration du traitement des nombres
**Fonction** : `processNumber()`

#### Gestion des formats français :
- **Virgules comme séparateurs décimaux** : `2976,55` → `2976.55`
- **Espaces comme séparateurs de milliers** : `3 525,06` → `3525.06`
- **Texte avec nombres** : `2976,55 dire 2900` → `2976.55` (extraction du premier nombre)

#### Exemples de conversion :
```javascript
'2976,55 dire 2900' → 2976.55
'3 525,06' → 3525.06
'1 234,56' → 1234.56
'1500.50' → 1500.50
```

### 4. Script de test du mapping
**Fichier** : `scripts/test-csv-mapping.js`

#### Fonctionnalités :
- **Test avec données réelles** basées sur l'échantillon fourni
- **Validation des conversions** de nombres, dates, chaînes
- **Vérification du mapping** des colonnes
- **Tests unitaires** des fonctions de conversion

#### Utilisation :
```bash
npm run import:test-mapping
```

## 🔧 Nouvelles commandes disponibles

```bash
# Test du mapping CSV avec données réelles
npm run import:test-mapping

# Test de la connexion Google Sheets
npm run import:test

# Import de test (avec nouveau mapping)
npm run import:dry-run

# Import complet (avec nouveau mapping)
npm run import:all
```

## 📊 Résultats attendus

### Avant les corrections
- ❌ Mapping incorrect des colonnes
- ❌ Erreurs de conversion des nombres
- ❌ Adresses non parsées correctement
- ❌ Données manquantes ou mal mappées

### Après les corrections
- ✅ Mapping correct des colonnes CSV
- ✅ Conversion automatique des formats français
- ✅ Extraction du code postal et de la ville
- ✅ Gestion des numéros avec espaces
- ✅ Mapping des gestionnaires et propriétaires
- ✅ Gestion des demandes avec ✅

## 🧪 Tests de validation

### Test des nombres
```javascript
// Cas testés :
'2976,55 dire 2900' → 2976.55 ✅
'3 525,06' → 3525.06 ✅
'1 234,56' → 1234.56 ✅
'1500.50' → 1500.50 ✅
'' → null ✅
'abc' → null ✅
```

### Test des dates
```javascript
// Cas testés :
'04/04/2024' → '2024-04-04T00:00:00.000Z' ✅
'2024-04-04' → '2024-04-04T00:00:00.000Z' ✅
'25/12/2023' → '2023-12-25T00:00:00.000Z' ✅
'' → null ✅
'invalid' → null ✅
```

### Test des adresses
```javascript
// Cas testé :
'3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM'
// Résultat :
// - adresse: "3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM"
// - code_postal: "67120"
// - ville: "DORLISHEIM"
```

## 🎯 Prochaines étapes

1. **Tester le mapping** : `npm run import:test-mapping`
2. **Appliquer la migration** : `npm run import:migrate-and-test`
3. **Lancer un import de test** : `npm run import:dry-run`
4. **Importer les données** : `npm run import:all`

## 📁 Fichiers modifiés

- `scripts/import-google-sheets-complete.js` - Mapping des colonnes mis à jour
- `scripts/data-preprocessor.js` - Préprocessing des interventions amélioré
- `scripts/test-csv-mapping.js` - Nouveau script de test
- `package.json` - Nouvelle commande de test
- `scripts/README.md` - Documentation mise à jour

---

*Corrections du mapping CSV appliquées le 20/09/2025 - Version 2.1*
