export interface PropertySchema {
  key: string
  label: string
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox"
  options?: { value: string; label: string; color?: string }[]
  sortable?: boolean
  filterable?: boolean
}

export const INTERVENTION_PROPERTIES: PropertySchema[] = [
  // Identifiants et références
  { key: "id", label: "UUID", type: "text", sortable: true, filterable: true },
  { key: "id_inter", label: "ID Intervention", type: "text", sortable: true, filterable: true },
  
  // Informations principales
  { key: "contexteIntervention", label: "Contexte", type: "text", sortable: true, filterable: true },
  
  // Relations (IDs)
  { key: "agence_id", label: "ID Agence", type: "text", sortable: true, filterable: true },
  { key: "agence", label: "Agence", type: "select", sortable: true, filterable: true },
  { key: "client_id", label: "ID Client", type: "text", sortable: true, filterable: true },
  { key: "assigned_user_id", label: "ID Utilisateur assigné", type: "text", sortable: true, filterable: true },
  { key: "attribueA", label: "Assigné à", type: "user", sortable: true, filterable: true },
  { key: "assignedUserName", label: "Nom complet assigné", type: "text", sortable: true, filterable: true },
  { key: "statut_id", label: "ID Statut", type: "text", sortable: true, filterable: true },
  {
    key: "statusValue",
    label: "Statut",
    type: "select",
    sortable: true,
    filterable: true,
    options: [
      { value: "DEMANDE", label: "Demandé", color: "blue" },
      { value: "DEVIS_ENVOYE", label: "Devis envoyé", color: "indigo" },
      { value: "VISITE_TECHNIQUE", label: "Visite technique", color: "teal" },
      { value: "REFUSE", label: "Refusé", color: "rose" },
      { value: "ANNULE", label: "Annulé", color: "slate" },
      { value: "STAND_BY", label: "Stand-by", color: "amber" },
      { value: "ACCEPTE", label: "Accepté", color: "green" },
      { value: "INTER_EN_COURS", label: "Inter en cours", color: "purple" },
      { value: "INTER_TERMINEE", label: "Inter terminée", color: "sky" },
      { value: "SAV", label: "SAV", color: "orange" },
      { value: "ATT_ACOMPTE", label: "Attente acompte", color: "pink" },
    ],
  },
  { key: "understatement", label: "ST", type: "text", sortable: true, filterable: true },
  { key: "metier_id", label: "ID Métier", type: "text", sortable: true, filterable: true },
  { key: "metier", label: "Métier", type: "select", sortable: true, filterable: true },
  
  // Dates
  { key: "date", label: "Date création", type: "date", sortable: true, filterable: true },
  { key: "dateIntervention", label: "Date intervention", type: "date", sortable: true, filterable: true },
  { key: "datePrevue", label: "Date prévue", type: "date", sortable: true, filterable: true },
  { key: "date_prevue", label: "Date prévue (BDD)", type: "date", sortable: true, filterable: true },
  { key: "date_termine", label: "Date terminée", type: "date", sortable: true, filterable: true },
  { key: "due_date", label: "Date d'échéance", type: "date", sortable: true, filterable: true },
  { key: "created_at", label: "Créé le", type: "date", sortable: true, filterable: true },
  { key: "updated_at", label: "Modifié le", type: "date", sortable: true, filterable: true },
  
  // Consignes et commentaires
  { key: "consigneIntervention", label: "Consigne intervention", type: "text", sortable: true, filterable: true },
  { key: "consigneDeuxiemeArtisanIntervention", label: "Consigne 2ème artisan", type: "text", sortable: true, filterable: true },
  { key: "commentaireAgent", label: "Commentaire agent", type: "text", sortable: true, filterable: true },
  
  // Localisation
  { key: "adresse", label: "Adresse", type: "text", sortable: true, filterable: true },
  { key: "codePostal", label: "Code postal", type: "text", sortable: true, filterable: true },
  { key: "ville", label: "Ville", type: "text", sortable: true, filterable: true },
  { key: "latitude", label: "Latitude", type: "number", sortable: true, filterable: true },
  { key: "longitude", label: "Longitude", type: "number", sortable: true, filterable: true },
  { key: "latitudeAdresse", label: "Latitude (texte)", type: "text", sortable: true, filterable: true },
  { key: "longitudeAdresse", label: "Longitude (texte)", type: "text", sortable: true, filterable: true },
  
  // Informations client
  { key: "nomClient", label: "Nom client", type: "text", sortable: true, filterable: true },
  { key: "prenomClient", label: "Prénom client", type: "text", sortable: true, filterable: true },
  { key: "telephoneClient", label: "Téléphone client", type: "text", sortable: true, filterable: true },
  { key: "telephone2Client", label: "Téléphone 2 client", type: "text", sortable: true, filterable: true },
  { key: "emailClient", label: "Email client", type: "text", sortable: true, filterable: true },
  
  // Informations propriétaire
  { key: "nomProprietaire", label: "Nom propriétaire", type: "text", sortable: true, filterable: true },
  { key: "prenomProprietaire", label: "Prénom propriétaire", type: "text", sortable: true, filterable: true },
  { key: "telephoneProprietaire", label: "Téléphone propriétaire", type: "text", sortable: true, filterable: true },
  { key: "emailProprietaire", label: "Email propriétaire", type: "text", sortable: true, filterable: true },
  
  // Informations SST
  { key: "numeroSST", label: "Numéro SST", type: "text", sortable: true, filterable: true },
  { key: "pourcentageSST", label: "Pourcentage SST", type: "number", sortable: true, filterable: true },
  
  // Finances - Coûts
  { key: "coutIntervention", label: "Coût intervention", type: "number", sortable: true, filterable: true },
  { key: "coutSST", label: "Coût SST", type: "number", sortable: true, filterable: true },
  { key: "coutMateriel", label: "Coût matériel", type: "number", sortable: true, filterable: true },
  { key: "marge", label: "Marge", type: "number", sortable: true, filterable: true },
  { key: "coutSSTDeuxiemeArtisan", label: "Coût SST 2ème artisan", type: "number", sortable: true, filterable: true },
  { key: "margeDeuxiemeArtisan", label: "Marge 2ème artisan", type: "number", sortable: true, filterable: true },
  { key: "coutMaterielDeuxiemeArtisan", label: "Coût matériel 2ème artisan", type: "number", sortable: true, filterable: true },
  
  // Finances - Acomptes
  { key: "acompteSST", label: "Acompte SST", type: "number", sortable: true, filterable: true },
  { key: "acompteClient", label: "Acompte client", type: "number", sortable: true, filterable: true },
  { key: "acompteSSTRecu", label: "Acompte SST reçu", type: "checkbox", sortable: true, filterable: true },
  { key: "acompteClientRecu", label: "Acompte client reçu", type: "checkbox", sortable: true, filterable: true },
  { key: "dateAcompteSST", label: "Date acompte SST", type: "date", sortable: true, filterable: true },
  { key: "dateAcompteClient", label: "Date acompte client", type: "date", sortable: true, filterable: true },
  
  // État
  { key: "is_active", label: "Actif", type: "checkbox", sortable: true, filterable: true },
  
  // Relations avec artisans
  { key: "artisan", label: "Artisan principal", type: "text", sortable: true, filterable: true },
  { key: "deuxiemeArtisan", label: "Artisan secondaire", type: "text", sortable: true, filterable: true },
  
  // Informations legacy additionnelles
  { key: "type", label: "Type", type: "text", sortable: true, filterable: true },
  { key: "typeDeuxiemeArtisan", label: "Type 2ème artisan", type: "text", sortable: true, filterable: true },
  { key: "telLoc", label: "Tél. locataire", type: "text", sortable: true, filterable: true },
  { key: "locataire", label: "Locataire", type: "text", sortable: true, filterable: true },
  { key: "emailLocataire", label: "Email locataire", type: "text", sortable: true, filterable: true },
  { key: "commentaire", label: "Commentaire", type: "text", sortable: true, filterable: true },
  { key: "idFacture", label: "ID Facture", type: "number", sortable: true, filterable: true },
]

export function getPropertyLabel(key: string): string {
  return INTERVENTION_PROPERTIES.find((property) => property.key === key)?.label ?? key
}

export function getPropertySchema(key: string): PropertySchema | undefined {
  return INTERVENTION_PROPERTIES.find((property) => property.key === key)
}
