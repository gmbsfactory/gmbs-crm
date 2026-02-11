# Correspondance Google Sheets ↔ Base Supabase ↔ Frontend

Ce document recense, pour les **artisans** et les **interventions**, la correspondance entre :

- la colonne du Google Sheet,
- le champ exploité par `scripts/import-google-sheets-complete.js`,
- la colonne en base Supabase (et sa présence éventuelle dans `supabase/seed.sql`),
- la propriété attendue côté frontend (principalement `InterventionCard`).

Il met aussi en évidence les écarts actuels (champs non alimentés, formats différents, etc.).

> ℹ️ Lorsque la colonne n’est pas exploitée par le script, la colonne "Script" est laissée vide et la remarque précise le statut. Lorsqu’un champ est bien présent dans la base (schema/seed) mais jamais alimenté par le script, la différence est signalée.

## Artisans

| Sheet (Feuille « Artisans ») | Script (`row.xxx`) | BDD (table.colonne) | Présent dans `seed.sql` | Front (interface `Artisan`) | Remarques |
| --- | --- | --- | --- | --- | --- |
| `nom_prenom` | `row.nom_prenom` → `payload.nom_prenom` | `artisans.nom_prenom` | ✅ | `nom`/`prenom` (non scindés) | Le frontend attend `nom`/`prenom`. Scission à prévoir si nécessaire. |
| `numero_associe` | `row.numero_associe` | `artisans.numero_associe` | ✅ | `numeroSST` (utilisé pour la correspondance) | Sert d’identifiant secondaire pour retrouver l’artisan depuis la feuille Interventions. |
| `raison_sociale` | — (non mappé) | `artisans.raison_sociale` | ✅ | `raisonSociale` | Le script **n’alimente pas** cette colonne ⇒ valeur nulle après import. |
| `siret` | — (non mappé) | `artisans.siret` | ✅ | `siret` | À compléter si utile côté front. |
| `statut_juridique` | — | `artisans.statut_juridique` | ✅ | `statutJuridique` | Non alimenté. |
| `statut_artisan` | — | `artisans.statut_artisan` | ✅ | `statutArtisan` | Non alimenté → badges de statut front vides. |
| `statut_dossier` | — | `artisans.statut_dossier` | ✅ | `statutDossier` | Non alimenté. |
| `adresse_siege_social` | — | `artisans.adresse_siege_social` | ✅ | `adresseSiegeSocial` | Non alimenté. |
| `ville_siege_social` | — | `artisans.ville_siege_social` | ✅ | `villeSiegeSocial` | Non alimenté. |
| `code_postal_siege_social` | — | `artisans.code_postal_siege_social` | ✅ | `codePostalSiegeSocial` | Non alimenté. |
| `email` | `row.email` | `artisans.email` | ✅ | `email` | Normalisé en minuscule (identifiant principal). |
| `telephone` | `row.telephone` | `artisans.telephone` | ✅ | `telephone` | Alimenté. |
| `telephone2` | — | `artisans.telephone2` | ✅ | `telephone2` | Jamais alimenté. |
| `date_ajout` | `row.date_ajout` (copie texte) | `artisans.date_ajout` | ✅ | `date` | Stocké tel quel (pas de conversion en date). |
| `gestionnaire_code` | `row.gestionnaire_code` → recherche `users.code_gestionnaire` | `artisans.gestionnaire_id` (FK) | ✅ | `attribueA` | Avertissement si le code n’existe pas (cas récurrents : `Badr`, `Andrea`, etc. en minuscules/variantes). |
| `metiers` | `row.metiers` (liste) | `artisan_metiers.artisan_id / metier_id` | ✅ | `metiers` | Split sur `, ; \n`. Les métiers manquants sont créés. |
| Autres colonnes (adresse intervention, lat/long, coût, etc.) | — | Champs présents dans le schéma (`intervention_latitude`, `gain_brut`…) | ✅ | Divers (`zoneIntervention`, `statutInactif`…) | **Non alimentés** par le script actuel. |

## Interventions

| Sheet (Feuille « Interventions ») | Script (`row.xxx`) / Traitement | BDD (table.colonne) | Présent dans `seed.sql` | Front (`InterventionCard`) | Remarques |
| --- | --- | --- | --- | --- | --- |
| `ID` (col. D) | `row.id_inter` (obligatoire) | `interventions.id_inter` | ✅ | `id` (id_inter utilisé comme identifiant métier) | Lignes sans ID ignorées (beaucoup en fin de sheet). |
| `Date` | `toIsoDate(row.date)` | `interventions.date` | ✅ | `date` | `toIsoDate` extrait les 3 groupes numériques (gère `2024-07-à partir du 16`). |
| `Agence` | `row.agence` | `interventions.agence` | ✅ | `agence` (badge) | OK. |
| `Adresse d'intervention` | `row.adresse` | `interventions.adresse` | ✅ | `adresse` (affichée dans la carte) | OK. `code_postal`/`ville` ne sont pas fournis par le sheet ⇒ restent `NULL`. |
| `Statut` | `row.statut` | `interventions.statut` | ✅ | `statut` (gestion des badges) | Valeurs libres ; prévoir mapping vers les clés `INTERVENTION_STATUS_CONFIG` si besoin. |
| `Contexte d'intervention` | `row.contexte_intervention` | `interventions.contexte_intervention` | ✅ | `contexteIntervention` / `commentaire` | Front affiche `commentaire || contexte`. |
| `Métier` | `row.metier` | `interventions.type` | ✅ | `metier` | Utilisé pour l’étiquette métier dans la carte. |
| `Gest.` | `row.gestionnaire_code` → `users.code_gestionnaire` | `interventions.attribue_a` (FK user) | ✅ | `attribueA` | Beaucoup de codes ne correspondent pas aux usernames ou `code_gestionnaire` du seed ⇒ avertissements + affichage "Non assigné". |
| `SST` | `row.artisan_reference` | — | ❌ | ` artisan` (ids second artisan non gérés) | Champ utilisé uniquement pour matcher un artisan par email (si le champ contient `@`). Dans la majorité des lignes c’est une description textuelle ⇒ pas de correspondance. |
| `COUT SST` | `safeNumber(row.cout_sst)` | `interventions.cout_sst` | ✅ | `coutSST` | Affiché sous forme monétaire. |
| `COÛT MATERIEL` | `safeNumber(row.cout_materiel)` | `interventions.cout_materiel` | ✅ | `coutMateriel` | idem. |
| `COUT INTER` | `safeNumber(row.cout_intervention)` | `interventions.cout_intervention` | ✅ | `coutIntervention` | Sert aussi au calcul de marge. |
| `Numéro SST` | `row.numero_sst` | `interventions.numero_sst` | ✅ | `numeroSST` (Réf affichée) | Sert d’identifiant pour retrouver l’artisan (via `artisans.numero_associe`). Beaucoup de valeurs textuelles ⇒ avertissements. |
| `% SST` | `safeNumber(row.pourcentage_sst)` | `interventions.pourcentage_sst` | ✅ | — | Stocké mais pas affiché dans la carte actuelle. |
| `PROPRIO` | `row.proprietaire` | `interventions.proprietaire` | ✅ | `nomProprietaire`/`prenomProprietaire` non alimentés | Fusionné en un champ unique. |
| `Date d'intervention` | `toIsoDate(row.date_intervention)` | `interventions.date_intervention` | ✅ | `dateIntervention` | Utilisé pour la timeline. |
| `TEL LOC` | `row.telephone_client` | `interventions.telephone_client` | ✅ | `telephoneClient` | OK. |
| `Locataire` | `row.nom_prenom_client` | `interventions.nom_prenom_client` | ✅ | `locataire` / `prenomClient`/`nomClient` | Script ne sépare pas prénom/nom ⇒ front affiche `" "` + fallback "Client inconnu". |
| `Em@il Locataire` | `row.email_client` | `interventions.email_client` | ✅ | `emailClient` | OK. |
| `COMMENTAIRE` | `row.commentaire` | `interventions.commentaire_agent` | ✅ | `commentaireAgent` & fallback d’affichage | OK. |
| `Truspilot` | `row.trustpilot` | `interventions.truspilot` | ✅ | `truspilot` | Affiché uniquement si présent. |
| `Demande d'intervention ✅` | `toBoolean(row.demande_intervention)` | `interventions.demande_intervention` (bool) | ✅ | `demandeIntervention` (string attendue) | ⚠️ Front affiche la valeur brute ; aujourd’hui il affichera `true/false`. Harmoniser types (ex. badge booléen). |
| `Demande Devis ✅` | `toBoolean(row.demande_devis)` | `interventions.demande_devis` | ✅ | `demandeDevis` | Même remarque. |
| `Demande TrustPilot ✅` | `toBoolean(row.demande_trustpilot)` | `interventions.demande_trust_pilot` | ✅ | `demandeTrustPilot` | Même remarque. |
| Colonnes non présentes dans le sheet mais existant en BDD (`code_postal`, `ville`, `latitude_adresse`, `consigne_intervention`, etc.) | — | Champs de `interventions` définis dans le schéma/seed | ✅ | De nombreux champs du composant (`ville`, `codePostal`, pièces jointes, acomptes…) restent **nuls** après import. |
| Liaison multi-artisans | — | `intervention_artisans` | ✅ | `deuxiemeArtisan` etc. | Le script ne crée aucune entrée dans la table de liaison, alors que le front dispose des hooks pour gérer plusieurs artisans. |

## Écart script ↔ seed

- `seed.sql` insère des colonnes que le script n’alimente jamais (`code_postal`, `ville`, `telephone2_client`, `acompte_*`, pièces jointes…). Après un import réel, ces champs repasseront à `NULL`.
- `seed.sql` enrichit certains champs via des structures JSON (`demande_intervention` stockée en JSON). Le script, lui, remplace ces valeurs par un booléen. Harmoniser la structure souhaitée avant d’activer l’import en production.
- Les utilisateurs créés dans le seed utilisent des `code_gestionnaire` courts (`O`, `B`, `A`…). Les valeurs des feuilles (`Badr`, `Andrea`, etc.) ne correspondent pas toujours à ces codes ⇒ `gestionnaire_id` reste vide.

## Frontend – `InterventionCard`

Champs sollicités dans `src/features/interventions/components/InterventionCard.tsx` :

- `statut`, `sousStatutText`, `sousStatutTextColor`
- `date`, `dateIntervention`, `dateTermine`
- `agence`, `metier`/`type`, `attribueA`
- `adresse`, `ville`, `codePostal`
- `contexteIntervention`, `commentaire`, `commentaireAgent`
- `numeroSST`, `locataire` (`prenomClient`/`nomClient`), `telephoneClient`, `emailClient`
- `coutSST`, `coutMateriel`, `coutIntervention`, `marge`
- `demandeIntervention`, `demandeDevis`, `demandeTrustPilot`
- `truspilot`, `pieceJointe*` (non alimenté), `consigne*`

Pour que la carte affiche des informations cohérentes après import :
1. **Fournir des identifiants consistants** (`Numéro SST`, code gestionnaire) dans les feuilles.
2. **Décider du format cible** des colonnes booléennes (`demande_*`) : booléen ou texte pour le front.
3. **Compléter/mapper les champs supplémentaires** (Ville, Code postal, pièces jointes) si le front doit les afficher.
4. **Eventuellement aligner le typage Supabase ↔ Front** via une fonction de transformation (`camelCase` / `snake_case`).

---

Dernière mise à jour : 17 septembre 2025.
