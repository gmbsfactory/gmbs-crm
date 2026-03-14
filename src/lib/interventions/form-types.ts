// ===== TYPES PARTAGÉS PAR LES FORMULAIRES D'INTERVENTION =====

/**
 * Structure des données de formulaire d'intervention
 * Partagée entre NewInterventionForm et InterventionEditForm
 */
export interface InterventionFormData {
  // Champs principaux
  statut_id: string
  id_inter: string
  agence_id: string
  reference_agence: string
  assigned_user_id: string
  metier_id: string
  contexte_intervention: string
  consigne_intervention: string

  // Adresse
  adresse: string
  code_postal: string
  ville: string
  latitude: number
  longitude: number
  adresse_complete: string

  // Dates
  date: string
  date_prevue: string

  // Commentaires
  consigne_second_artisan: string
  commentaire_initial: string
  commentaire_agent: string

  // SST (principalement edit)
  numero_sst: string
  pourcentage_sst: string

  // Propriétaire (owner)
  nomPrenomFacturation: string
  telephoneProprietaire: string
  emailProprietaire: string

  // Client (tenant)
  nomPrenomClient: string
  telephoneClient: string
  emailClient: string

  // Logement vacant
  is_vacant: boolean
  key_code: string
  floor: string
  apartment_number: string
  vacant_housing_instructions: string

  // Artisan
  artisan: string
  artisanTelephone: string
  artisanEmail: string

  // Coûts
  coutSST: string
  coutMateriel: string
  coutIntervention: string

  // Acomptes
  accompteSST: string
  accompteSSTRecu: boolean
  dateAccompteSSTRecu: string
  accompteClient: string
  accompteClientRecu: boolean
  dateAccompteClientRecu: string

  // Sous-statut personnalisé
  sousStatutText: string
  sousStatutTextColor: string
  sousStatutBgColor: string

  // Deuxième artisan
  secondArtisan: string
  secondArtisanTelephone: string
  secondArtisanEmail: string
  metierSecondArtisanId: string
  coutSSTSecondArtisan: string
  coutMaterielSecondArtisan: string
}

/**
 * État des sections collapsibles du formulaire
 */
export interface CollapsibleSectionsState {
  isProprietaireOpen: boolean
  isClientOpen: boolean
  isAccompteOpen: boolean
  isDocumentsOpen: boolean
  isCommentsOpen: boolean
  isSecondArtisanOpen: boolean
  isSousStatutOpen: boolean
}

/**
 * Retourne l'état initial des sections collapsibles
 */
export function getDefaultCollapsibleState(): CollapsibleSectionsState {
  return {
    isProprietaireOpen: false,
    isClientOpen: false,
    isAccompteOpen: false,
    isDocumentsOpen: false,
    isCommentsOpen: true,
    isSecondArtisanOpen: false,
    isSousStatutOpen: false,
  }
}

/**
 * Crée les données initiales du formulaire pour une nouvelle intervention
 */
export function createNewFormData(
  defaultValues?: Partial<Record<string, any>>
): InterventionFormData {
  const dv = defaultValues || {}
  return {
    // Champs principaux
    statut_id: "",
    id_inter: "",
    agence_id: dv.agence_id || "",
    reference_agence: dv.reference_agence || "",
    assigned_user_id: dv.assigned_user_id || "",
    metier_id: dv.metier_id || "",
    contexte_intervention: "",
    consigne_intervention: "",

    // Adresse
    adresse: dv.adresse || "",
    code_postal: dv.code_postal || "",
    ville: dv.ville || "",
    latitude: dv.latitude || 48.8566,
    longitude: dv.longitude || 2.3522,
    adresse_complete: "",

    // Dates
    date: new Date().toISOString().split('T')[0],
    date_prevue: dv.datePrevue || "",

    // Commentaires
    consigne_second_artisan: dv.consigneSecondArtisan || "",
    commentaire_initial: dv.commentairesIntervention || "",
    commentaire_agent: "",

    // SST
    numero_sst: "",
    pourcentage_sst: "",

    // Propriétaire (owner)
    nomPrenomFacturation: dv.nomPrenomFacturation || "",
    telephoneProprietaire: dv.telephoneProprietaire || "",
    emailProprietaire: dv.emailProprietaire || "",

    // Client (tenant)
    nomPrenomClient: dv.nomPrenomClient || "",
    telephoneClient: dv.telephoneClient || "",
    emailClient: dv.emailClient || "",

    // Logement vacant
    is_vacant: false,
    key_code: "",
    floor: "",
    apartment_number: "",
    vacant_housing_instructions: "",

    // Artisan
    artisan: dv.artisan || "",
    artisanTelephone: dv.artisanTelephone || "",
    artisanEmail: dv.artisanEmail || "",

    // Coûts
    coutSST: dv.coutSST || "",
    coutMateriel: dv.coutMateriel || "",
    coutIntervention: dv.coutIntervention || "",

    // Acomptes
    accompteSST: "",
    accompteSSTRecu: false,
    dateAccompteSSTRecu: "",
    accompteClient: "",
    accompteClientRecu: false,
    dateAccompteClientRecu: "",

    // Sous-statut personnalisé
    sousStatutText: "",
    sousStatutTextColor: "#000000",
    sousStatutBgColor: "transparent",

    // Deuxième artisan
    secondArtisan: "",
    secondArtisanTelephone: "",
    secondArtisanEmail: "",
    metierSecondArtisanId: "",
    coutSSTSecondArtisan: "",
    coutMaterielSecondArtisan: "",
  }
}

// Types utilitaires pour createEditFormData
interface EditCosts {
  sstCost: { amount?: number | null } | undefined
  materielCost: { amount?: number | null } | undefined
  interventionCost: { amount?: number | null } | undefined
  sstCostSecondArtisan: { amount?: number | null } | undefined
  materielCostSecondArtisan: { amount?: number | null } | undefined
}

interface EditPayments {
  sstPayment: { amount?: number | null; is_received?: boolean; payment_date?: string | null } | undefined
  clientPayment: { amount?: number | null; is_received?: boolean; payment_date?: string | null } | undefined
}

/**
 * Crée les données initiales du formulaire pour l'édition d'une intervention existante
 */
export function createEditFormData(
  intervention: any,
  primaryArtisan: any | null,
  secondaryArtisan: any | null,
  costs: EditCosts,
  payments: EditPayments
): InterventionFormData {
  const { sstCost, materielCost, interventionCost, sstCostSecondArtisan, materielCostSecondArtisan } = costs
  const { sstPayment, clientPayment } = payments

  return {
    // Champs principaux
    statut_id: intervention.statut_id || "",
    id_inter: intervention.id_inter || "",
    agence_id: intervention.agence_id || "",
    reference_agence: (intervention as any).reference_agence || "",
    assigned_user_id: intervention.assigned_user_id || "",
    metier_id: intervention.metier_id || "",
    contexte_intervention: intervention.contexte_intervention || "",
    consigne_intervention: intervention.consigne_intervention || "",

    // Adresse
    adresse: intervention.adresse || "",
    code_postal: intervention.code_postal || "",
    ville: intervention.ville || "",
    latitude: intervention.latitude || 48.8566,
    longitude: intervention.longitude || 2.3522,
    adresse_complete: (intervention as any).adresse_complete || "",

    // Dates
    date: intervention.date?.split('T')[0] || "",
    date_prevue: intervention.date_prevue?.split('T')[0] || "",

    // SST
    numero_sst: (intervention as any).numero_sst || "",
    pourcentage_sst: (intervention as any).pourcentage_sst?.toString() || "",

    // Commentaires
    consigne_second_artisan: intervention.consigne_second_artisan || "",
    commentaire_initial: "",
    commentaire_agent: intervention.commentaire_agent || "",

    // Propriétaire (owner)
    nomPrenomFacturation: intervention.owner?.plain_nom_facturation ||
      `${intervention.owner?.owner_lastname || ''} ${intervention.owner?.owner_firstname || ''}`.trim() || "",
    telephoneProprietaire: intervention.owner?.telephone || "",
    emailProprietaire: intervention.owner?.email || "",

    // Client (tenant)
    nomPrenomClient: intervention.tenants?.plain_nom_client ||
      `${intervention.tenants?.lastname || ''} ${intervention.tenants?.firstname || ''}`.trim() || "",
    telephoneClient: intervention.tenants?.telephone || "",
    emailClient: intervention.tenants?.email || "",

    // Logement vacant
    is_vacant: (intervention as any).is_vacant || false,
    key_code: (intervention as any).key_code || "",
    floor: (intervention as any).floor || "",
    apartment_number: (intervention as any).apartment_number || "",
    vacant_housing_instructions: (intervention as any).vacant_housing_instructions || "",

    // Artisan
    artisan: primaryArtisan ? `${primaryArtisan.prenom || ''} ${primaryArtisan.nom || ''}`.trim() : "",
    artisanTelephone: primaryArtisan?.telephone || "",
    artisanEmail: primaryArtisan?.email || "",

    // Coûts (traiter 0 comme vide, ne pas afficher "0")
    coutSST: (sstCost?.amount ?? null) !== null && (sstCost?.amount ?? 0) !== 0 ? String(sstCost?.amount ?? 0) : "",
    coutMateriel: (materielCost?.amount ?? null) !== null && (materielCost?.amount ?? 0) !== 0 ? String(materielCost?.amount ?? 0) : "",
    coutIntervention: (interventionCost?.amount ?? null) !== null && (interventionCost?.amount ?? 0) !== 0 ? String(interventionCost?.amount ?? 0) : "",

    // Acomptes
    accompteSST: (sstPayment?.amount ?? null) !== null && (sstPayment?.amount ?? 0) !== 0 ? String(sstPayment?.amount ?? 0) : "",
    accompteSSTRecu: sstPayment?.is_received || false,
    dateAccompteSSTRecu: sstPayment?.payment_date?.split('T')[0] || "",
    accompteClient: (clientPayment?.amount ?? null) !== null && (clientPayment?.amount ?? 0) !== 0 ? String(clientPayment?.amount ?? 0) : "",
    accompteClientRecu: clientPayment?.is_received || false,
    dateAccompteClientRecu: clientPayment?.payment_date?.split('T')[0] || "",

    // Sous-statut personnalisé
    sousStatutText: (intervention as any).sous_statut_text || "",
    sousStatutTextColor: (intervention as any).sous_statut_text_color || "#000000",
    sousStatutBgColor: (intervention as any).sous_statut_bg_color || "transparent",

    // Deuxième artisan
    secondArtisan: secondaryArtisan ? `${secondaryArtisan.prenom || ''} ${secondaryArtisan.nom || ''}`.trim() : "",
    secondArtisanTelephone: secondaryArtisan?.telephone || "",
    secondArtisanEmail: secondaryArtisan?.email || "",
    metierSecondArtisanId: (intervention as any).metier_second_artisan_id || "",
    coutSSTSecondArtisan: (sstCostSecondArtisan?.amount ?? null) !== null && (sstCostSecondArtisan?.amount ?? 0) !== 0 ? String(sstCostSecondArtisan?.amount ?? 0) : "",
    coutMaterielSecondArtisan: (materielCostSecondArtisan?.amount ?? null) !== null && (materielCostSecondArtisan?.amount ?? 0) !== 0 ? String(materielCostSecondArtisan?.amount ?? 0) : "",
  }
}
