/**
 * Requête SQL pour exporter tous les artisans avec leurs relations
 */

const getArtisansQuery = () => {
  return `
    SELECT 
      a.id,
      a.prenom,
      a.nom,
      a.plain_nom,
      a.email,
      a.telephone,
      a.telephone2,
      a.departement,
      a.raison_sociale,
      a.siret,
      a.statut_juridique,
      a.adresse_siege_social,
      a.ville_siege_social,
      a.code_postal_siege_social,
      a.adresse_intervention,
      a.ville_intervention,
      a.code_postal_intervention,
      a.intervention_latitude,
      a.intervention_longitude,
      a.numero_associe,
      u.username as gestionnaire_username,
      u.firstname as gestionnaire_firstname,
      u.lastname as gestionnaire_lastname,
      ast.code as statut_code,
      ast.label as statut_label,
      COALESCE(
        (SELECT STRING_AGG(m.label, ', ' ORDER BY m.label)
         FROM artisan_metiers am
         JOIN metiers m ON am.metier_id = m.id
         WHERE am.artisan_id = a.id),
        ''
      ) as metiers,
      COALESCE(
        (SELECT STRING_AGG(z.label, ' | ' ORDER BY z.label)
         FROM artisan_zones az
         JOIN zones z ON az.zone_id = z.id
         WHERE az.artisan_id = a.id),
        ''
      ) as zones,
      a.suivi_relances_docs,
      a.date_ajout,
      a.is_active,
      a.created_at,
      a.updated_at
    FROM artisans a
    LEFT JOIN users u ON a.gestionnaire_id = u.id
    LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
    ORDER BY a.created_at DESC;
  `;
};

module.exports = {
  getArtisansQuery
};


