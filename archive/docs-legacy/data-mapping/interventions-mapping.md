# Mapping Interventions Google Sheets → Supabase

Basé sur `scripts/import-google-sheets-complete.js` (17 septembre 2025). Le script lit la feuille "Interventions" via `INTERVENTION_COLUMNS`, valide chaque ligne, puis applique insertions/mises à jour dans Supabase. Le tableau suivant répertorie toutes les colonnes Google Sheets et les champs `interventions` associés.

| Google Sheets | Script Processing | Database Column | Frontend Display | Notes |
|---------------|-------------------|-----------------|------------------|-------|
| Date | toIsoDate() | interventions.date | Yes | Champ obligatoire. `isValidIntervention` rejette la ligne si la date est absente ou invalide. Formats pris en charge : `JJ/MM/AAAA`, `AAAA-MM-JJ`, combinaisons avec texte. |
| Agence | normalizeString() | interventions.agence | Yes | Affiché dans les cartes et filtres. |
| Adresse d'intervention | normalizeString() | interventions.adresse | Yes | Adresse principale affichée. |
| ID | normalizeString() | interventions.id_inter | Yes | Obligatoire. Sert de clé métier pour détection des doublons. |
| Statut | normalizeString() | interventions.statut | Yes | Pilote les filtres et colonnes Kanban. |
| Contexte d'intervention | normalizeString() | interventions.contexte_intervention | Yes | Recherché plein texte dans l’UI. |
| Métier | normalizeString() | interventions.type | Yes | Type d’intervention utilisé dans les listes. |
| Gest. | normalizeString().toLowerCase() → lookup usersIndex.byCode | interventions.attribue_a | Yes | Assigne un utilisateur via `code_gestionnaire`. Avertissement si non trouvé. |
| SST | normalizeString() (lookup uniquement) | interventions.artisan_reference | No | Utilisé pour retrouver l’artisan par email. Valeur non persistée : colonne reste vide. |
| COUT SST | safeNumber() | interventions.cout_sst | No | Conversion `,` → `.` puis float. Champ optionnel. |
| COÛT MATERIEL | safeNumber() | interventions.cout_materiel | No | Idem. |
| Numéro SST | normalizeString() | interventions.numero_sst | Yes | Stocké et utilisé pour `artisan_id`. |
| COUT INTER | safeNumber() | interventions.cout_intervention | No | Optionnel. |
| % SST | safeNumber() | interventions.pourcentage_sst | No | Optionnel. |
| PROPRIO | normalizeString() | interventions.proprietaire | No | Pas encore exploité côté UI. |
| Date d'intervention | toIsoDate() | interventions.date_intervention | Yes | Utilisée pour le tri et les filtres d’échéance. |
| TEL LOC | normalizeString() | interventions.telephone_client | Yes | Téléphone locataire affiché. |
| Locataire | normalizeString() | interventions.nom_prenom_client | Yes | Nom/prénom locataire affiché. |
| Em@il Locataire | normalizeString() | interventions.email_client | Yes | Email locataire affiché. |
| COMMENTAIRE | normalizeString() | interventions.commentaire_agent | Yes | Commentaire agent affiché. |
| Truspilot | normalizeString() | interventions.truspilot | No | Stocké mais non affiché (2025-09). |
| Demande d'intervention ✅ | toBoolean() | interventions.demande_intervention | No | Convertit `✅/oui/1` en booléen (`null` si ambigu). Attention : schéma historique JSONB → vérifier la colonne en base. |
| Demande Devis ✅ | toBoolean() | interventions.demande_devis | No | Même logique que ci-dessus. |
| Demande TrustPilot ✅ | toBoolean() | interventions.demande_trust_pilot | No | Même logique que ci-dessus. |
| - | - | interventions.id | Yes | UUID Supabase généré à l’insertion. |
| - | - | interventions.gestionnaire_code | No | Champ prévu mais jamais alimenté (remplacé par `attribue_a`). |
| - | - | interventions.artisan_id | Yes | Déduit via `numero_sst` ou `SST` (email). Si aucun artisan, reste `null` avec avertissement. |
| - | - | interventions.created_at | No | Timestamp généré par Supabase. |
| - | - | interventions.updated_at | No | Timestamp généré par Supabase. |

## Transformations et validations

- `mapSheetRow` + `normalizeString()` nettoient l’ensemble des cellules avant traitement.
- `isValidIntervention(row)` : la ligne est ignorée si `id_inter` est vide ou si `toIsoDate(row.date)` échoue.
- `toIsoDate(value)` : accepte dates FR ou ISO, vérifie que l’année est entre 1900 et 2100.
- `safeNumber(value)` : supprime espaces, remplace virgule par point puis cast en `float`; renvoie `null` si NaN.
- `toBoolean(value)` : gère `✅`, `☑️`, `✔`, `oui/non`, `1/0`, `true/false`. `null` si valeur incohérente.
- `prepareInterventionRow()` :
  - construit `attribue_a` via `users.code_gestionnaire`,
  - tente de lier un artisan (`numero_sst` → `artisans.numero_associe`, sinon `SST` si email),
  - prépare la charge utile avec conversions numériques et booléennes.
- `syncInterventionArtisans()` : ajoute les liaisons manquantes `intervention_artisans` (rôle par défaut `principal`) en évitant les doublons.

## Points d’attention

- **Colonnes non stockées** : la valeur brute `SST` n’est pas conservée (`artisan_reference` reste vide). Envisager de la persister pour audit.
- **Schéma Supabase** : les migrations historiques définissent `demande_*` en JSONB. Adapter la colonne à `boolean` si besoin pour éviter les conversions implicites.
- **Match artisan** : sans `Numéro SST` ni `SST` email, l’intervention est importée sans lien (`artisan_id = null`). Le rapport d’import contient l’avertissement correspondant.
- **UX filtre date** : les tris reposent sur `date` et `date_intervention`; s’assurer que les formats source sont cohérents pour éviter des cartes "sans date".
