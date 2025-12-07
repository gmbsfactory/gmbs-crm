# Mapping Excel - Base de données

## Colonnes principales

| Colonne Excel | Source BDD | Transformation | Notes |
|--------------|------------|----------------|-------|
| id | interventions.id | UUID → texte | |
| id_inter | interventions.id_inter | Texte direct | Identifiant métier |
| agence_code | agencies.code | JOIN via interventions.agence_id | Résolution référence |
| agence_label | agencies.label | JOIN via interventions.agence_id | Résolution référence |
| tenant_external_ref | tenants.external_ref | JOIN via interventions.tenant_id | Résolution référence |
| tenant_firstname | tenants.firstname | JOIN via interventions.tenant_id | Résolution référence |
| tenant_lastname | tenants.lastname | JOIN via interventions.tenant_id | Résolution référence |
| owner_external_ref | owner.external_ref | JOIN via interventions.owner_id | Résolution référence |
| owner_firstname | owner.owner_firstname | JOIN via interventions.owner_id | Résolution référence |
| owner_lastname | owner.owner_lastname | JOIN via interventions.owner_id | Résolution référence |
| assigned_user_username | users.username | JOIN via interventions.assigned_user_id | Résolution référence |
| assigned_user_firstname | users.firstname | JOIN via interventions.assigned_user_id | Résolution référence |
| assigned_user_lastname | users.lastname | JOIN via interventions.assigned_user_id | Résolution référence |
| statut_code | intervention_statuses.code | JOIN via interventions.statut_id | Résolution référence |
| statut_label | intervention_statuses.label | JOIN via interventions.statut_id | Résolution référence |
| metier_code | metiers.code | JOIN via interventions.metier_id | Résolution référence |
| metier_label | metiers.label | JOIN via interventions.metier_id | Résolution référence |
| date | interventions.date | Timestamp → texte ISO | |
| date_termine | interventions.date_termine | Timestamp → texte ISO (ou vide) | |
| date_prevue | interventions.date_prevue | Timestamp → texte ISO (ou vide) | |
| due_date | interventions.due_date | Timestamp → texte ISO (ou vide) | |
| contexte_intervention | interventions.contexte_intervention | Texte direct | |
| consigne_intervention | interventions.consigne_intervention | Texte direct | |
| consigne_second_artisan | interventions.consigne_second_artisan | Texte direct | |
| commentaire_agent | interventions.commentaire_agent | Texte direct | |
| adresse | interventions.adresse | Texte direct | |
| code_postal | interventions.code_postal | Texte direct | |
| ville | interventions.ville | Texte direct | |
| latitude | interventions.latitude | Numeric → texte | |
| longitude | interventions.longitude | Numeric → texte | |
| is_active | interventions.is_active | Boolean → "Oui"/"Non" | |
| created_at | interventions.created_at | Timestamp → texte ISO | |
| updated_at | interventions.updated_at | Timestamp → texte ISO | |
| artisans_list | artisans.plain_nom | JOIN via intervention_artisans | Liste séparée par virgule |
| costs_list | intervention_costs | Agrégation JSON | Liste formatée |
| payments_list | intervention_payments | Agrégation JSON | Liste formatée |

## Détails des listes complexes

### Liste des Artisans

La colonne `artisans_list` est construite en joignant la table `artisans` via `intervention_artisans` et en concaténant les valeurs de `artisans.plain_nom` séparées par des virgules.

### Liste des Coûts

La colonne `costs_list` est construite en agrégeant les données de la table `intervention_costs` au format JSON.

### Liste des Paiements

La colonne `payments_list` est construite en agrégeant les données de la table `intervention_payments` au format JSON.