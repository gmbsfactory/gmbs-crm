import type { InterventionSearchRecord } from "@/types/search"

/**
 * Helper function to convert InterventionWithStatus (from API) to InterventionSearchRecord
 * This function can be used to convert interventions fetched from the API
 * to the format expected by the search system
 */
export function convertInterventionToSearchRecord(intervention: any): InterventionSearchRecord {
  const record: InterventionSearchRecord = {
    id: intervention.id,
    id_inter: intervention.id_inter,
    agence_id: intervention.agence_id,
    statut_id: intervention.statut_id,
    metier_id: intervention.metier_id,
    assigned_user_id: intervention.assigned_user_id,
    contexte_intervention: intervention.contexte_intervention,
    consigne_intervention: intervention.consigne_intervention,
    commentaire_agent: intervention.commentaire_agent,
    adresse: intervention.adresse,
    code_postal: intervention.code_postal,
    ville: intervention.ville,
    date: intervention.date,
    date_prevue: intervention.date_prevue,
    due_date: intervention.due_date,
    numero_sst: intervention.numero_sst,
    pourcentage_sst: intervention.pourcentage_sst,
    tenant: intervention.tenant
      ? {
          id: intervention.tenant.id,
          firstname: intervention.tenant.firstname,
          lastname: intervention.tenant.lastname,
          plain_nom: intervention.tenant.plain_nom_client ?? null,
          telephone: intervention.tenant.telephone,
          telephone2: intervention.tenant.telephone2,
          email: intervention.tenant.email,
          adresse: intervention.tenant.adresse,
          code_postal: intervention.tenant.code_postal,
          ville: intervention.tenant.ville,
        }
      : (intervention.nomPrenomClient || intervention.prenomClient || intervention.nomClient || intervention.emailClient || intervention.telephoneClient)
        ? {
            id: intervention.tenant_id ?? intervention.client_id ?? null,
            firstname: intervention.prenomClient ?? null,
            lastname: intervention.nomClient ?? null,
            plain_nom: intervention.nomPrenomClient ?? null,
            telephone: intervention.telephoneClient ?? null,
            telephone2: intervention.telephone2Client ?? null,
            email: intervention.emailClient ?? null,
            adresse: null,
            code_postal: null,
            ville: null,
          }
        : null,
    owner: intervention.owner
      ? {
          id: intervention.owner.id,
          owner_firstname: intervention.owner.owner_firstname,
          owner_lastname: intervention.owner.owner_lastname,
          plain_nom: intervention.owner.plain_nom_facturation ?? null,
          telephone: intervention.owner.telephone,
          telephone2: intervention.owner.telephone2,
          email: intervention.owner.email,
          adresse: intervention.owner.adresse,
          code_postal: intervention.owner.code_postal,
          ville: intervention.owner.ville,
        }
      : (intervention.nomPrenomFacturation || intervention.prenomProprietaire || intervention.nomProprietaire || intervention.emailProprietaire || intervention.telephoneProprietaire)
        ? {
            id: intervention.owner_id ?? null,
            owner_firstname: intervention.prenomProprietaire ?? null,
            owner_lastname: intervention.nomProprietaire ?? null,
            plain_nom: intervention.nomPrenomFacturation ?? null,
            telephone: intervention.telephoneProprietaire ?? null,
            telephone2: null,
            email: intervention.emailProprietaire ?? null,
            adresse: null,
            code_postal: null,
            ville: null,
          }
        : null,
    status: intervention.status,
    assigned_user: intervention.assigned_user
      ? {
          id: intervention.assigned_user.id,
          firstname: intervention.assigned_user.firstname,
          lastname: intervention.assigned_user.lastname,
          username: intervention.assigned_user.username,
          code_gestionnaire: intervention.assigned_user.code_gestionnaire,
          color: intervention.assigned_user.color,
          avatar_url: intervention.assigned_user.avatar_url,
        }
      : null,
    metier: intervention.metier,
    intervention_artisans: (intervention.artisans ?? intervention.intervention_artisans ?? []).map((a: any) => ({
      is_primary: a.is_primary,
      role: a.role,
      artisan: a.artisan ?? {
        id: a.id,
        prenom: a.prenom,
        nom: a.nom,
        numero_associe: a.numero_associe,
        telephone: a.telephone,
        telephone2: a.telephone2,
      },
    })),
    payments: intervention.payments,
  }

  // Set primary artisan
  const primary = record.intervention_artisans.find((entry) => entry.is_primary)
  record.primaryArtisan = primary?.artisan ?? record.intervention_artisans[0]?.artisan ?? null

  return record
}
