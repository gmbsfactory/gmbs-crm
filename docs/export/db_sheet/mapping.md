# Mapping Excel - Base de données : Interventions

## Identifiants
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| id | interventions.id | UUID → texte |
| id_inter | interventions.id_inter | Texte direct |

## Agence
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| agence_code | agencies.code | JOIN via interventions.agence_id |
| agence_label | agencies.label | JOIN via interventions.agence_id |

## Locataire (Tenant)
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| tenant_external_ref | tenants.external_ref | JOIN via interventions.tenant_id |
| tenant_firstname | tenants.firstname | JOIN via interventions.tenant_id |
| tenant_lastname | tenants.lastname | JOIN via interventions.tenant_id |

## Propriétaire (Owner)
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| owner_external_ref | owner.external_ref | JOIN via interventions.owner_id |
| owner_firstname | owner.owner_firstname | JOIN via interventions.owner_id |
| owner_lastname | owner.owner_lastname | JOIN via interventions.owner_id |

## Utilisateur assigné
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| assigned_user_username | users.username | JOIN via interventions.assigned_user_id |
| assigned_user_firstname | users.firstname | JOIN via interventions.assigned_user_id |
| assigned_user_lastname | users.lastname | JOIN via interventions.assigned_user_id |

## Statut et Métier
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| statut_code | intervention_statuses.code | JOIN via interventions.statut_id |
| statut_label | intervention_statuses.label | JOIN via interventions.statut_id |
| metier_code | metiers.code | JOIN via interventions.metier_id |
| metier_label | metiers.label | JOIN via interventions.metier_id |

## Dates
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| date | interventions.date | Timestamp → texte ISO |
| date_termine | interventions.date_termine | Timestamp → texte ISO (ou vide) |
| date_prevue | interventions.date_prevue | Timestamp → texte ISO (ou vide) |
| due_date | interventions.due_date | Timestamp → texte ISO (ou vide) |

## Contenu textuel
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| contexte_intervention | interventions.contexte_intervention | Texte direct |
| consigne_intervention | interventions.consigne_intervention | Texte direct |
| consigne_second_artisan | interventions.consigne_second_artisan | Texte direct |
| commentaire_agent | interventions.commentaire_agent | Texte direct |

## Adresse
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| adresse | interventions.adresse | Texte direct |
| code_postal | interventions.code_postal | Texte direct |
| ville | interventions.ville | Texte direct |
| latitude | interventions.latitude | Numeric → texte |
| longitude | interventions.longitude | Numeric → texte |

## Métadonnées
| Colonne Excel | Source BDD | Transformation |
|--------------|------------|----------------|
| is_active | interventions.is_active | Boolean → "Oui"/"Non" |
| created_at | interventions.created_at | Timestamp → texte ISO |
| updated_at | interventions.updated_at | Timestamp → texte ISO |

## Listes agrégées
| Colonne Excel | Source BDD | Transformation | Format |
|--------------|------------|----------------|--------|
| artisans_list | artisans.plain_nom | JOIN via intervention_artisans | Liste séparée par virgule |
| costs_list | intervention_costs | Agrégation JSON | Liste formatée |
| payments_list | intervention_payments | Agrégation JSON | Liste formatée |