# Export SQL vers Excel/Google Sheets

Ce module permet d'exporter les données du CRM (Artisans et Interventions) vers un fichier Excel en cas de panne du système.

## 📋 Fonctionnalités

- ✅ Export de tous les artisans dans une feuille unique
- ✅ Export des interventions par année (une feuille par année)
- ✅ Export de toutes les relations (gestionnaires, statuts, métiers, zones, etc.)
- ✅ Export des listes agrégées (artisans, coûts, paiements)
- ✅ Format Excel (.xlsx) compatible avec Google Sheets

## 🚀 Utilisation

### Commande de base

```bash
npm run export:to-excel
```

### Options disponibles

```bash
# Spécifier le fichier de sortie
node scripts/exports/export-to-sheets.js --output ./backup.xlsx

# Exporter seulement certaines années
node scripts/exports/export-to-sheets.js --years 2024,2023

# Mode verbeux (plus de détails)
node scripts/exports/export-to-sheets.js --verbose

# Combinaison d'options
node scripts/exports/export-to-sheets.js --output ./exports/backup.xlsx --years 2024 --verbose
```

### Arguments

- `--output, -o <path>` : Chemin du fichier de sortie (défaut: `exports/Export_GMBS_CRM_YYYY-MM-DD.xlsx`)
- `--years, -y <years>` : Années à exporter, séparées par virgule (ex: `2024,2023`)
- `--verbose, -v` : Mode verbeux avec plus de détails
- `--help, -h` : Affiche l'aide

## 📊 Structure du fichier Excel

Le fichier Excel généré contient :

1. **Feuille "Artisans"** : Tous les artisans avec :
   - Informations de base (nom, prénom, email, téléphone, etc.)
   - Gestionnaire (username, firstname, lastname)
   - Statut (code, label)
   - Liste des métiers (séparés par virgule)
   - Liste des zones (séparées par `|`)

2. **Feuilles "Interventions_YYYY"** : Une feuille par année avec :
   - Informations de base de l'intervention
   - Agence, Locataire, Propriétaire
   - Utilisateur assigné
   - Statut et métier
   - Liste des artisans (séparés par virgule)
   - Liste des coûts (format JSON)
   - Liste des paiements (format JSON)

## 🔧 Configuration

Le script utilise les variables d'environnement suivantes (depuis `.env.local`) :

- `NEXT_PUBLIC_SUPABASE_URL` : URL de votre instance Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service role (pour les permissions complètes)

## 📝 Exemple de sortie

```
🚀 Démarrage de l'export SQL vers Excel...

👷 Export des artisans...
   ✅ 150 artisans trouvés
   ✅ Feuille "Artisans" créée

🔧 Export des interventions...
   📅 Années disponibles: 2024, 2023, 2022
   📅 Années à exporter: 2024, 2023
   📄 Export des interventions de 2024...
      ✅ 45 interventions exportées
   📄 Export des interventions de 2023...
      ✅ 38 interventions exportées
   ✅ 83 interventions exportées au total

💾 Sauvegarde du fichier: exports/Export_GMBS_CRM_2025-01-15.xlsx

✅ Export terminé avec succès!
   📊 Artisans: 150
   📊 Interventions: 83
   📁 Fichier: exports/Export_GMBS_CRM_2025-01-15.xlsx
```

## ⚠️ Notes importantes

- Les **commentaires** des interventions ne sont **pas** exportés (comme demandé)
- Les listes de coûts et paiements sont au format JSON pour préserver la structure
- Le script peut prendre du temps pour de grandes quantités de données
- Le fichier Excel est compatible avec Google Sheets (import direct possible)

## 🐛 Dépannage

### Erreur de connexion à Supabase

Vérifiez que les variables d'environnement sont correctement définies dans `.env.local`.

### Erreur "Permission denied"

Assurez-vous d'utiliser `SUPABASE_SERVICE_ROLE_KEY` et non la clé anonyme.

### Fichier trop volumineux

Pour de très grandes quantités de données, utilisez l'option `--years` pour exporter par tranches.

## 📚 Structure du code

```
scripts/exports/
├── export-to-sheets.js          # Script principal
├── formatters/
│   └── excel-formatter.js       # Formatage Excel
├── queries/
│   ├── artisans-query.js        # Requêtes SQL (référence)
│   └── interventions-query.js   # Requêtes SQL (référence)
└── README.md                     # Cette documentation
```

## 🔄 Évolutions futures

- [ ] Upload direct vers Google Drive
- [ ] Export au format CSV
- [ ] Export sélectif (filtres par statut, métier, etc.)
- [ ] Compression automatique pour les gros fichiers


