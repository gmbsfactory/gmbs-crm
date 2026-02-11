# Import de Documents depuis Google Drive

Ce module permet d'importer automatiquement les documents des artisans depuis Google Drive vers Supabase.

## Structure attendue

Les documents doivent être organisés dans Google Drive selon la structure suivante:

```text
artisans/
  ├── nom_artisan_1/
  │   ├── kbis.pdf
  │   ├── carte-identite.pdf
  │   ├── assurance.pdf
  │   └── iban.pdf
  ├── nom_artisan_2/
  │   └── ...
```

Les noms des dossiers doivent correspondre au champ `plain_nom` des artisans dans la base de données.

## Types de documents supportés

Les documents sont automatiquement classifiés selon leur nom de fichier:

- **KBIS** → `kbis`

  - Patterns: kbis, extrait-kbis, siret, registre-commerce, etc.

- **Carte d'identité** → `cni_recto_verso`
  - Patterns: cni, carte-identite, piece-identite, recto-verso, etc.

- **Décharge paternelle** → `decharge_partenariat`
  - Patterns: decharge, decharge-paternelle, autorisation-parentale, etc.

- **Attestation assurance** → `assurance`
  - Patterns: assurance, attestation-assurance, rc-pro, responsabilite-civile, etc.

- **IBAN** → `iban`
  - Patterns: iban, rib, releve-identite-bancaire, compte-bancaire, etc.

- **Autre** → `autre`

  - Tous les autres documents (non importés automatiquement)

## Configuration

### 1. Variables d'environnement

Ajoutez dans votre `.env.local`:

```bash
# Réutiliser les mêmes credentials que Google Sheets
GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json

# Ou utiliser des variables spécifiques
GOOGLE_DRIVE_CLIENT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"

# Optionnel: ID du dossier racine (sinon recherche automatique)
GOOGLE_DRIVE_ROOT_FOLDER_ID=your_folder_id_here
```

### 2. Permissions Google Drive

Assurez-vous que le Service Account Google a accès en lecture au dossier `artisans` dans Google Drive:

1. Ouvrez Google Drive
2. Partagez le dossier `artisans` avec l'email du Service Account (trouvé dans `credentials.json` → `client_email`)
3. Donnez les droits en **Lecture seule**

## Utilisation

### 1. Analyse préliminaire

Avant d'importer, analysez la structure pour voir combien de dossiers matchent:

```bash
node scripts/imports/analyze-drive-structure.js
```

Cela génère un rapport `drive-analysis-report.json` avec:

- Nombre de dossiers trouvés
- Nombre de matchs avec la base de données
- Liste des dossiers non matchés
- Types de documents trouvés

### 2. Test de classification

Testez la classification des documents:

```bash
node scripts/imports/test-classification.js
```

### 3. Import (mode dry-run)

Testez l'import sans modifier la base de données:

```bash
node scripts/imports/google-drive-import.js --dry-run
```

### 4. Import réel

Importez les documents:

```bash
node scripts/imports/google-drive-import.js
```

### Options disponibles

- `--dry-run`: Mode test, aucun document n'est importé
- `--skip-existing`: Ignore les documents déjà existants
- `--limit N`: Limite le traitement aux N premiers artisans

Exemples:

```bash
# Import avec limite de 10 artisans
node scripts/imports/google-drive-import.js --limit 10

# Import en ignorant les doublons
node scripts/imports/google-drive-import.js --skip-existing

# Test complet avec limite
node scripts/imports/google-drive-import.js --dry-run --limit 5
```

## Rapports

Après chaque import, un rapport est généré dans `drive-import-report.json` avec:

- Statistiques d'import
- Liste des dossiers matchés/non matchés
- Détails des erreurs éventuelles

## Gestion des erreurs

- **Artisan non trouvé**: Le dossier est listé dans le rapport mais les documents ne sont pas importés
- **Document non classifiable**: Les documents de type "autre" ne sont pas importés automatiquement
- **Erreur de téléchargement**: L'erreur est loggée et le script continue avec les autres documents
- **Erreur d'upload**: L'erreur est loggée et le script continue

## Normalisation des noms

Les noms de dossiers sont normalisés pour la comparaison avec `plain_nom`:

- Conversion en minuscules
- Suppression des accents
- Normalisation des espaces

Exemple: `"Jean DUPONT"` matche avec `"jean dupont"` ou `"Jean-Dupont"`.

## Fichiers créés

- `scripts/imports/lib/document-classifier.js` - Module de classification
- `scripts/imports/config/google-drive-config.js` - Configuration Google Drive
- `scripts/imports/analyze-drive-structure.js` - Script d'analyse
- `scripts/imports/google-drive-import.js` - Script principal d'import
- `scripts/imports/test-classification.js` - Tests de classification

## Dépannage

### Erreur: "Dossier artisans non trouvé"

- Vérifiez que le dossier `artisans` existe dans Google Drive
- Vérifiez que le Service Account a accès au dossier
- Spécifiez `GOOGLE_DRIVE_ROOT_FOLDER_ID` si le dossier a un nom différent

### Erreur: "Configuration Google Drive invalide"

- Vérifiez que `GOOGLE_CREDENTIALS_PATH` pointe vers un fichier valide
- Ou configurez `GOOGLE_DRIVE_CLIENT_EMAIL` et `GOOGLE_DRIVE_PRIVATE_KEY`

### Aucun dossier matché

- Vérifiez que les noms des dossiers correspondent aux `plain_nom` en base
- Utilisez le script d'analyse pour voir les différences
- Normalisez les noms si nécessaire

## Notes importantes

- Les documents de type "autre" ne sont **pas** importés automatiquement
- Les documents sont téléchargés depuis Google Drive puis uploadés vers Supabase Storage
- Le script respecte les limites de l'API Google Drive (délais entre requêtes)
- Les doublons peuvent être évités avec l'option `--skip-existing`
