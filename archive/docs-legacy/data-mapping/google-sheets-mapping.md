# Table de correspondance Google Sheets ↔ Base Supabase

Les tableaux ci-dessous détaillent le mapping actuel entre les colonnes des Google Sheets "Artisans" et "Interventions" et les champs utilisés dans le script `scripts/import-google-sheets-complete.js` pour alimenter la base.

## Artisans (`artisans` + liaisons)

| BDD (`table.colonne`) | Type | Source Google Sheets | Notes |
| --- | --- | --- | --- |
| `artisans.nom_prenom` | text | `nom_prenom` | Valeur brute (souvent "Nom Prénom"). |
| `artisans.prenom` | text | _non rempli_ | Non alimenté par le sheet actuel. |
| `artisans.nom` | text | _non rempli_ | Non alimenté. |
| `artisans.numero_associe` | text | `numero_associe` | Sert d'identifiant secondaire pour retrouver un artisan. |
| `artisans.raison_sociale` | text | `raison_sociale` | Copié tel quel. |
| `artisans.siret` | text | `siret` | — |
| `artisans.statut_juridique` | text | `statut_juridique` | — |
| `artisans.statut_artisan` | text | `statut_artisan` | — |
| `artisans.statut_dossier` | text | `statut_dossier` | — |
| `artisans.adresse_siege_social` | text | `adresse_siege_social` | — |
| `artisans.ville_siege_social` | text | `ville_siege_social` | — |
| `artisans.code_postal_siege_social` | text | `code_postal_siege_social` | — |
| `artisans.email` | text | `email` | Normalisé en minuscule ; utilisé comme identifiant principal. |
| `artisans.telephone` | text | `telephone` | — |
| `artisans.date_ajout` | text | `date_ajout` | Stocké tel quel (pas converti en date). |
| `artisans.gestionnaire_id` | uuid FK -> `users.id` | `gestionnaire_code` | Recherche par `users.code_gestionnaire`. Avertissement si non trouvé. |
| `artisan_metiers.metier_id` | uuid FK -> `metiers.id` | `metiers` | Liste séparée par virgule/saut de ligne. Création auto des métiers manquants avant import. |
| `artisan_metiers.artisan_id` | uuid FK -> `artisans.id` | — | Liens créés après insertion/mise à jour. |

_Champs BDD non alimentés avec le sheet actuel :_ `artisans.telephone2`, `adresse_intervention`, `ville_intervention`, `code_postal_intervention`, `intervention_latitude`, `intervention_longitude`, `statut_inactif`, `nombre_interventions`, `cout_sst` (agrégé), etc.

## Interventions (`interventions` + liaisons)

| BDD (`table.colonne`) | Type | Source Google Sheets | Notes |
| --- | --- | --- | --- |
| `interventions.id_inter` | text UK | `ID` (colonne D) | Identifiant métier obligatoire. Ignoré si vide. |
| `interventions.date` | date | `Date` (A) | Conversion via `toIsoDate` (extrait `JJ/MM/AAAA`, `AAAA-MM-JJ`, ou valeurs mêlées). |
| `interventions.agence` | text | `Agence` | — |
| `interventions.adresse` | text | `Adresse d'intervention` | — |
| `interventions.statut` | text | `Statut` | Valeur libre. |
| `interventions.contexte_intervention` | text | `Contexte d'intervention` | — |
| `interventions.type` | text | `Métier` | Utilisé comme "type" intervention. |
| `interventions.proprietaire` | text | `PROPRIO` | — |
| `interventions.nom_prenom_client` | text | `Locataire` (Nom/Prénom) | — |
| `interventions.telephone_client` | text | `TEL LOC` | — |
| `interventions.email_client` | text | `Em@il Locataire` | — |
| `interventions.cout_sst` | numeric | `COUT SST` | Conversion locale, virgule → point. |
| `interventions.cout_materiel` | numeric | `COÛT MATERIEL` | — |
| `interventions.cout_intervention` | numeric | `COUT INTER` | — |
| `interventions.pourcentage_sst` | numeric | `% SST` | — |
| `interventions.numero_sst` | text | `Numéro SST` | Sert de clé de recherche d’artisan (via `numero_associe`). |
| `interventions.demande_intervention` | bool | `Demande d'intervention ✅` | `toBoolean` gère "oui/non", `1/0`, emojis (`✅`/`❌`). |
| `interventions.demande_devis` | bool | `Demande Devis ✅` | Idem. |
| `interventions.demande_trust_pilot` | bool | `Demande TrustPilot ✅` | Idem. |
| `interventions.truspilot` | text | `Truspilot` | Copié tel quel. |
| `interventions.date_intervention` | date | `Date d'intervention` | Passage par `toIsoDate`. |
| `interventions.commentaire_agent` | text | `COMMENTAIRE` | — |
| `interventions.attribue_a` | uuid FK -> `users.id` | `Gest.` | Recherche `users.code_gestionnaire`. |
| `interventions.artisan_id` | uuid FK -> `artisans.id` | `Numéro SST` puis `SST` | 1. essai via `artisans.numero_associe`; 2. si `SST` contient un email, recherche par email ; sinon avertissement. |
| `intervention_artisans` | — | — | Aucune création automatique pour l’instant (table laissée vide). |

_Les colonnes suivantes ne sont **pas** alimentées :_ `code_postal`, `ville`, `latitude`, `longitude`, `contexte_deuxieme_artisan`, coûts second artisan, `attribue_a` second artisan, pièces jointes, etc. Si elles sont nécessaires, prévoir une extension du sheet ou un prétraitement.

## Points d’attention

- **Gestionnaire / artisan introuvable** : les avertissements proviennent des codes de gestionnaire (`Gest.`) ou références artisans (`SST` / `Numéro SST`) absentes de la base. Ajouter ces identifiants côté sheet ou enrichir le mapping.
- **Lignes sans ID/date** : les lignes vides ou les totaux en fin de sheet déclenchent « id_inter ou date manquant ». Nettoyer le Google Sheet pour éviter ces entrées.
- **Évolutions possibles** :
  - fournir une colonne d’identifiant unique pour les artisans dans la feuille `Interventions` (ex. `artisan_email`),
  - exposer les colonnes manquantes (ville, code postal…) si l’application en a besoin,
  - gérer un second artisan via `INTERVENTION_ARTISANS` si un autre onglet fournit l’information.

Ces mappings reflètent l’état du script au 17 septembre 2025. Mettre à jour ce document en cas d’évolution des structures.
