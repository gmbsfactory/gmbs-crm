# Mapping Artisans Google Sheets → Supabase

Documentation basée sur `scripts/import-google-sheets-complete.js` (état au 17 septembre 2025). Le script lit la feuille Google Sheets "Artisans" avec les colonnes déclarées dans `ARTISAN_COLUMNS` et synchronise uniquement un sous-ensemble de champs vers Supabase. Le tableau ci-dessous couvre toutes les colonnes connues côté Google Sheets et toutes les colonnes de la table `artisans` afin de faciliter l'analyse des écarts.

| Google Sheets | Script Processing | Database Column | Frontend Display | Notes |
|---------------|-------------------|-----------------|------------------|-------|
| Nom | - | artisans.nom | Yes | Valeur lue mais non écrite. L’UI (`app/artisans/page.tsx`) attend `nom` pour composer le nom complet. Prévoir concaténation côté import. |
| Prénom | - | artisans.prenom | Yes | Idem `Nom`. Jamais alimenté par le script actuel. |
| Raison Social | normalizeString() (non utilisé) | artisans.raison_sociale | Yes | Champ ignoré dans `prepareArtisanRow`. L’UI attend une raison sociale, actuellement à saisir manuellement. |
| MÉTIER | parseMetiersCell() → ensureMetiersExist() → syncArtisanMetiers() | artisans.metier_id | Yes | La colonne est éclatée (",", ";", retour ligne). Les métiers manquants sont créés puis reliés via `artisan_metiers`. Le champ `artisans.metier_id` reste nul en 2025-09. |
| DPT | - | artisans.departement | Yes | Non importé. L’UI utilise `zoneIntervention`; penser à alimenter via cette colonne. |
| STATUT | - | artisans.statut_artisan | Yes | Jamais mis à jour. Sert aux statuts (Disponible/Inactif…) dans l’interface. |
| Adresse Postale | - | artisans.adresse_siege_social | Yes | Non importé. L’UI affiche l’adresse du siège à partir de ce champ. |
| Adresse Mail | normalizeString() → toLowerCase() | artisans.email | Yes | Clé principale côté import. Obligatoire si `numero_associe` absent. Valeur normalisée, utilisée pour la déduplication. |
| Numéro Téléphone | normalizeString() | artisans.telephone | Yes | Champ optionnel, aucune validation de format. |
| STATUT JURIDIQUE | - | artisans.statut_juridique | Yes | Ignoré. L’UI propose un sélecteur de statut juridique. |
| Siret | normalizeString() | artisans.siret | Yes | Importé et stocké tel quel dans `payload`. |
| DOSSIER ARTISAN | - | artisans.statut_dossier | Yes | Non alimenté. L’API chat exploite `statut_dossier` pour filtrer. |
| Document Drive | - | artisans.document_drive | No | Colonne ignorée. D’autres fonctions Supabase gèrent un JSON Drive, pas ce script. |
| Commentaire | - | artisans.commentaire | Yes | Non mis à jour, utilisé dans l’UI comme notes. |
| Gestionnaire | normalizeString().toLowerCase() → lookup usersIndex.byCode | artisans.gestionnaire_id | No | Facultatif. Résout `users.code_gestionnaire`. Avertissement si inconnu. |
| DATE D'AJOUT | normalizeString() (non utilisé) | artisans.date_ajout | No | Colonne lue mais non persistée. |
| SUIVI DES RELANCES DOCS | - | artisans.suivi_relances_docs | No | Ignoré pour l’instant. |
| NOMBRE D'INTERVENTION(S) | - | artisans.nombre_interventions | No | Non alimenté. |
| COUT SST | - | artisans.cout_sst | No | Non alimenté (valeur agrégée attendue). |
| COUT INTER | - | artisans.cout_inter | No | Ignoré. |
| "COUT MATÉRIEL (cleaner colonne)" | - | artisans.cout_materiel | No | Ignoré. |
| GAIN BRUT € | - | artisans.gain_brut | No | Ignoré. |
| % SST | - | artisans.pourcentage_sst | No | Ignoré. |
| (colonne cachée) Nom + Prénom concaténé (`nom_prenom`) | normalizeString() | artisans.nom_prenom | Yes | L’import s’appuie sur une colonne `nom_prenom`. Si la feuille ne la fournit plus, le script doit être adapté (concat Nom/Prénom). |
| Numéro associé | normalizeString() | artisans.numero_associe | No | Utilisé comme identifiant secondaire. Obligatoire si email vide. |
| - | - | artisans.id | Yes | UUID généré par Supabase. Clé primaire utilisée partout (listes, API). |
| - | - | artisans.date | No | Jamais importé. Peut accueillir la date d’entrée CRM. |
| - | - | artisans.telephone2 | No | Non importé. |
| - | - | artisans.statut_inactif | Yes | Valeur par défaut `false`. L’UI filtre sur ce champ. |
| - | - | artisans.statut_avant_archiver | No | Non importé. |
| - | - | artisans.statut_artisan_avant_inactif | No | Non importé. |
| - | - | artisans.ville_siege_social | Yes | Attendu par l’UI (adresse affichée). À extraire depuis `Adresse Postale` ou fournir colonne dédiée. |
| - | - | artisans.code_postal_siege_social | Yes | Idem ci-dessus. |
| - | - | artisans.adresse_intervention | Yes | Non importé. Champ distinct pour adresse d’intervention. |
| - | - | artisans.ville_intervention | Yes | Non importé. |
| - | - | artisans.code_postal_intervention | Yes | Non importé. |
| - | - | artisans.intervention_latitude | No | Jamais importé. |
| - | - | artisans.intervention_longitude | No | Jamais importé. |
| - | - | artisans.created_at | No | Géré par Supabase (timestamp). |
| - | - | artisans.updated_at | No | Géré par Supabase (timestamp). |
| - | - | artisans.metier_id | No | Toujours nul (liaison via `artisan_metiers`). |

## Transformations et validations

- `mapSheetRow` applique `normalizeString()` (trim) sur chaque cellule importée, garantissant des chaînes propres avant toute logique métier.
- `normalizeString(value)` : conversion en chaîne et trim, utilisée partout avant comparaison.
- `parseMetiersCell(value)` : éclate les listes par virgule, point-virgule ou saut de ligne, supprime les doublons et alimente `ensureMetiersExist()`.
- `ensureMetiersExist()` + `generateUniqueMetierCode()` : crée les métiers manquants dans Supabase (slug upper-case), uniquement si `metiers` contient une valeur.
- `prepareArtisanRow()` :
  - force `email` en minuscule,
  - exige au moins `email` ou `numero_associe`, sinon la ligne est ignorée avec avertissement,
  - résout le gestionnaire (`Gestionnaire` → `users.code_gestionnaire`).
- `syncArtisanMetiers()` : construit les liaisons `artisan_metiers` en évitant les doublons existants.

## Points d’attention

- **Champs ignorés** : la majorité des colonnes métiers (statuts, adresses détaillées, coûts…) ne sont pas alimentées. Prévoir une évolution du script si ces données deviennent indispensables dans l’UI.
- **Nom/Prénom séparés** : le script consomme `nom_prenom`. Avec les nouvelles colonnes `Nom` / `Prénom`, il faut soit réintroduire la colonne concaténée, soit adapter `prepareArtisanRow()`.
- **Gestionnaires** : si le code est inconnu, la ligne est conservée mais `gestionnaire_id` reste `null`. Des avertissements sont ajoutés au rapport.
- **Identifiants** : l’email sert de clé unique. En cas d’absence, `numero_associe` doit être présent pour éviter la suppression de la ligne.
