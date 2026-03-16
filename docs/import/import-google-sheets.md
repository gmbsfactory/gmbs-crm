# Import des données depuis Google Sheets

Guide de référence pour importer les données artisans et interventions depuis Google Sheets vers la base de données de production.

---

## Vue d'ensemble

```
Google Sheets
     │
     ▼
google-sheets-import-clean-v2.js   ← script d'import principal
     │
     ├─ DataMapper          → mapping colonnes Sheets → champs DB
     ├─ DataValidator       → validation avant insertion
     ├─ DatabaseManager V2  → upsert via API V2 (service role)
     └─ ReportGenerator     → rapport des erreurs uniquement
```

Le processus complet est orchestré par `scripts/data/imports/deploy/deliver-prod.js`.

---

## Prérequis

### Variables d'environnement

Dans `.env.local` (développement local) ou `.env.production` (production) :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Sheets
GOOGLE_SHEETS_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GOOGLE_SHEETS_ARTISANS_RANGE=Artisans!A:Z
GOOGLE_SHEETS_INTERVENTIONS_RANGE=Interventions!A:Z

# Credentials Google (service account)
GOOGLE_SHEETS_CLIENT_EMAIL=mon-compte@projet.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Utilisateur d'import (pour les associations gestionnaire)
IMPORT_USER_EMAIL=admin@gmbs.fr
IMPORT_USER_PASSWORD=motdepasse
```

Le script sélectionne automatiquement le fichier env :
- `NODE_ENV=production` → `.env.production`
- Sinon → `.env.local`

L'URL Supabase cible est affichée au lancement (LOCAL ou PRODUCTION).

### Colonnes Google Sheets attendues

#### Feuille Artisans

| Colonne Sheets          | Champ DB              | Notes                          |
|-------------------------|-----------------------|--------------------------------|
| `Nom Prénom`            | `prenom` + `nom`      | Chiffres isolés supprimés auto |
| `Raison Social`         | `raison_sociale`      | Chiffres isolés supprimés auto |
| `Adresse Mail`          | `email`               | Clé d'upsert principale        |
| `Numéro Téléphone`      | `telephone`           |                                |
| `Siret`                 | `siret`               | Clé d'upsert si email absent   |
| `DATE D'AJOUT`          | `created_at`          | Détermine l'ordre de tri en UI |
| `STATUT`                | `statut_id`           | Normalisé vers les codes DB    |
| `Gestionnaire`          | `gestionnaire_id`     | Résolu par email/code          |
| `SUIVI DES RELANCES DOCS` | `suivi_relances_docs` |                              |
| `Métier(s)`             | `artisan_metiers`     |                                |

#### Feuille Interventions

| Colonne Sheets           | Champ DB           | Notes                      |
|--------------------------|--------------------|----------------------------|
| `ID`                     | `id_inter`         | Clé d'upsert               |
| `Date`                   | `date`             | Plusieurs formats acceptés |
| `Statut`                 | `statut_id`        | Normalisé                  |
| `Métier`                 | `metier_id`        |                            |
| `Adresse`                | `adresse` + `ville` + `code_postal` | Parsé automatiquement |
| `SST`                    | `artisanSST`       | Lié à un artisan           |
| `Coût SST`               | `intervention_costs` (sst) |                   |
| `Coût Matériel`          | `intervention_costs` (materiel) |              |
| `Coût Intervention`      | `intervention_costs` (intervention) |          |

---

## Utilisation

### Livraison complète (recommandé)

Lance le cleanup + l'import dans le bon ordre avec confirmation interactive :

```bash
node scripts/data/imports/deploy/deliver-prod.js
```

**Ce que fait l'orchestrateur :**
1. Vérifie les variables d'environnement et affiche la cible Supabase (LOCAL/PRODUCTION)
2. Valide la couverture des tables (détecte toute table non couverte par le cleanup ni préservée)
3. Affiche un rapport de ce qui sera supprimé (counts par table)
4. Demande confirmation : `oui` pour continuer
5. Supprime les données de test (interventions, artisans, clients, logs, conversations, etc.)
6. Importe les données depuis Google Sheets
7. Affiche le chemin des rapports générés

### Options CLI complètes

```bash
# Import seul (sans cleanup)
node scripts/data/imports/deploy/deliver-prod.js --skip-cleanup

# Artisans uniquement
node scripts/data/imports/deploy/deliver-prod.js --artisans-only

# Interventions uniquement
node scripts/data/imports/deploy/deliver-prod.js --interventions-only

# Simulation sans écriture (skip cleanup automatiquement)
node scripts/data/imports/deploy/deliver-prod.js --dry-run

# Filtrer par dates d'intervention (formats : DD/MM/YYYY ou YYYY-MM-DD)
node scripts/data/imports/deploy/deliver-prod.js --import-start-date=01/01/2025 --import-end-date=31/12/2025

# Affichage détaillé
node scripts/data/imports/deploy/deliver-prod.js --verbose
```

### Import direct (sans orchestrateur)

```bash
node scripts/data/imports/google-sheets-import-clean-v2.js [options]
```

Options disponibles : `--artisans-only`, `--interventions-only`, `--dry-run`, `--verbose`, `--limit=N`, `--batch-size=N`

---

## Cleanup seul (sans import)

### Via le script Node (recommandé)

```bash
node scripts/data/imports/deploy/cleanup-data.js
node scripts/data/imports/deploy/cleanup-data.js --verbose
```

Ce script effectue la suppression dans l'ordre FK correct avec confirmation interactive.

### Via SQL (alternative)

**Étape 1 — Vérifier ce qui sera supprimé** (lecture seule) :
```
Supabase Dashboard > SQL Editor > coller scripts/db/validate-before-cleanup.sql
```

**Étape 2 — Faire un backup** :
```
Supabase Dashboard > Database > Backups > Download
```

**Étape 3 — Supprimer** :
```
Supabase Dashboard > SQL Editor > coller scripts/db/cleanup-prod-data.sql
```

### Ce qui est préservé par le cleanup

La liste complète des tables préservées est définie dans `PRESERVED_TABLES` du fichier `cleanup-data.js`. En résumé :

- **Référentiel métier** : metiers, zones, artisan_statuses, intervention_statuses, task_statuses
- **Auth & utilisateurs** : users, roles, permissions, user_roles, user_permissions, etc.
- **Config & agences** : agencies, agency_config, lateness_email_config
- **Système** : app_updates, billing_state, subscriptions, etc.

Une validation automatique détecte toute table en base qui ne serait ni supprimée ni préservée.

---

## Rapports

Après chaque import, deux fichiers sont générés dans `data/imports/processed/` :

| Fichier | Contenu |
|---|---|
| `import-report-[timestamp].txt` | Résumé + liste de toutes les erreurs par ligne |
| `import-report-[timestamp].json` | Même contenu en JSON structuré (erreurs uniquement) |
| `address-parsing-issues-[timestamp].json` | Adresses non parsées (si présentes) |

Les rapports ne contiennent **que les échecs** — les insertions réussies ne sont pas loguées.

### Format d'une erreur artisan

```json
{
  "type": "insertion",
  "index": 42,
  "error": "duplicate key value violates unique constraint (email)",
  "data": {
    "prenom": "Jean",
    "nom": "DUPONT",
    "email": "jean.dupont@example.com"
  }
}
```

---

## Transformations automatiques appliquées à l'import

| Champ | Transformation |
|---|---|
| `nom`, `prenom`, `raison_sociale` | Suppression des chiffres isolés (`"Jean 2 DUPONT"` → `"Jean DUPONT"`) |
| `DATE D'AJOUT` | Utilisée comme `created_at` pour le tri chronologique dans l'UI |
| `email` | Nettoyage (trim, lowercase) |
| `telephone` | Normalisation format français |
| `siret` | Suppression espaces et tirets |
| Statuts artisan | Normalisation vers les codes canoniques DB |
| Coûts ≥ 100 000€ (SST/intervention) | Remis à 0 automatiquement |

---

## Résolution de problèmes courants

### `SUPABASE_SERVICE_ROLE_KEY non définie`

Le script ne peut pas contourner les RLS. Vérifiez que la clé est bien dans `.env.local` (ou `.env.production`).

### `Artisan rejeté : nom manquant`

La colonne `Nom Prénom` est vide ou contient uniquement des chiffres. Corriger dans le Google Sheets et relancer.

### `duplicate key value violates unique constraint (email)`

Un artisan avec cet email existe déjà en base. Utilisez `--upsert` si vous souhaitez mettre à jour les existants :

```bash
node scripts/data/imports/google-sheets-import-clean-v2.js --upsert
```

### `Échec du test de connexion Google Sheets`

Vérifiez `GOOGLE_SHEETS_CLIENT_EMAIL` et `GOOGLE_SHEETS_PRIVATE_KEY`. Le service account doit avoir accès en lecture au spreadsheet.

### `Tables non couvertes détectées`

La validation de couverture a trouvé des tables en base qui ne sont ni dans `CLEANUP_STEPS` ni dans `PRESERVED_TABLES`. Ajoutez-les dans le fichier `cleanup-data.js` dans la liste appropriée.

### L'import s'arrête à mi-chemin

Consultez le rapport JSON pour identifier la ligne en erreur. L'import est conçu pour continuer malgré les erreurs individuelles — une erreur fatale indique un problème de connexion ou d'authentification.

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `scripts/data/imports/deploy/deliver-prod.js` | Orchestrateur complet (cleanup + import) |
| `scripts/data/imports/deploy/cleanup-data.js` | Suppression des données de test (Node.js) |
| `scripts/data/imports/google-sheets-import-clean-v2.js` | Script d'import principal |
| `scripts/data-processing/data-mapper.js` | Mapping et nettoyage des données |
| `scripts/data/imports/database/database-manager-v2.js` | Insertion en base via API V2 |
| `scripts/data/imports/reporting/report-generator.js` | Génération des rapports d'erreurs |
| `scripts/db/validate-before-cleanup.sql` | Rapport pré-suppression SQL (lecture seule) |
| `scripts/db/cleanup-prod-data.sql` | Suppression atomique SQL (alternative) |
