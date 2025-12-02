/**
 * Requête SQL pour exporter les interventions par année avec leurs relations
 */

const getInterventionsQuery = (year = null) => {
  const yearFilter = year 
    ? `WHERE EXTRACT(YEAR FROM i.date) = ${year}`
    : '';
    
  return `
    SELECT 
      i.id,
      i.id_inter,
      ag.code as agence_code,
      ag.label as agence_label,
      t.external_ref as tenant_external_ref,
      t.firstname as tenant_firstname,
      t.lastname as tenant_lastname,
      o.external_ref as owner_external_ref,
      o.owner_firstname as owner_firstname,
      o.owner_lastname as owner_lastname,
      u.username as assigned_user_username,
      u.firstname as assigned_user_firstname,
      u.lastname as assigned_user_lastname,
      ist.code as statut_code,
      ist.label as statut_label,
      m.code as metier_code,
      m.label as metier_label,
      i.date,
      i.date_termine,
      i.date_prevue,
      i.due_date,
      i.contexte_intervention,
      i.consigne_intervention,
      i.consigne_second_artisan,
      i.commentaire_agent,
      i.adresse,
      i.code_postal,
      i.ville,
      i.latitude,
      i.longitude,
      i.is_active,
      i.created_at,
      i.updated_at,
      COALESCE(
        (SELECT STRING_AGG(a.plain_nom, ', ' ORDER BY ia.is_primary DESC, a.plain_nom)
         FROM intervention_artisans ia
         JOIN artisans a ON ia.artisan_id = a.id
         WHERE ia.intervention_id = i.id),
        ''
      ) as artisans_list,
      COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'intervention_id', ic.intervention_id,
            'label', ic.label,
            'amount', ic.amount,
            'currency', ic.currency,
            'metadata', ic.metadata
          ) ORDER BY ic.created_at
        )::text
         FROM intervention_costs ic
         WHERE ic.intervention_id = i.id),
        '[]'
      ) as costs_list,
      COALESCE(
        (SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'payment_type', ip.payment_type,
            'amount', ip.amount,
            'currency', ip.currency,
            'payment_date', ip.payment_date
          ) ORDER BY ip.payment_date
        )::text
         FROM intervention_payments ip
         WHERE ip.intervention_id = i.id),
        '[]'
      ) as payments_list
    FROM interventions i
    LEFT JOIN agencies ag ON i.agence_id = ag.id
    LEFT JOIN tenants t ON i.tenant_id = t.id
    LEFT JOIN owner o ON i.owner_id = o.id
    LEFT JOIN users u ON i.assigned_user_id = u.id
    LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
    LEFT JOIN metiers m ON i.metier_id = m.id
    ${yearFilter}
    ORDER BY i.date DESC;
  `;
};

/**
 * Récupère la liste des années distinctes dans les interventions
 */
const getInterventionsYearsQuery = () => {
  return `
    SELECT DISTINCT EXTRACT(YEAR FROM date) as year
    FROM interventions
    WHERE date IS NOT NULL
    ORDER BY year DESC;
  `;
};

module.exports = {
  getInterventionsQuery,
  getInterventionsYearsQuery
};


