// ===== INTERVENTIONS CRUD - SHARED SELECT CLAUSES =====
// Le SELECT complet (avec relations) utilisé par getById/getByIds.
// Extrait pour éviter la duplication d'une chaîne de ~60 lignes.

export const FULL_INTERVENTION_SELECT = `
  *,
  status:intervention_statuses(id,code,label,color,sort_order),
  tenants (
    id,
    firstname,
    lastname,
    plain_nom_client,
    email,
    telephone,
    telephone2,
    adresse,
    ville,
    code_postal
  ),
  owner (
    id,
    owner_firstname,
    owner_lastname,
    plain_nom_facturation,
    telephone,
    telephone2,
    email,
    adresse,
    ville,
    code_postal
  ),
  intervention_artisans (
    artisan_id,
    role,
    is_primary,
    artisans (
      id,
      prenom,
      nom,
      plain_nom,
      raison_sociale,
      telephone,
      email
    )
  ),
  intervention_costs (
    id,
    cost_type,
    label,
    amount,
    currency,
    metadata,
    artisan_order
  ),
  intervention_payments (
    id,
    payment_type,
    amount,
    currency,
    is_received,
    payment_date,
    reference
  )
`;

/** SELECT minimal pour récupérer status + relations basiques (utilisé par update et getByArtisan). */
export const STATUS_AND_ARTISANS_SELECT = `
  *,
  status:intervention_statuses(id,code,label,color,sort_order),
  intervention_artisans (
    artisan_id,
    is_primary,
    role
  ),
  intervention_costs (
    id,
    cost_type,
    label,
    amount,
    currency,
    metadata,
    artisan_order
  )
`;
