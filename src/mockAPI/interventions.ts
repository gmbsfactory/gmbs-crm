// Mock API - Interventions
// Basé sur le modèle legacy Intervention du CRM GMBS et les 24 colonnes du CSV

export interface Intervention {
  id: string;
  idFacture?: number;
  date: string;
  dateTermine?: string;
  agence: string;
  contexteIntervention: string;
  pieceJointeIntervention?: any[];
  pieceJointeCout?: any[];
  pieceJointeDevis?: any[];
  pieceJointePhotos?: any[];
  pieceJointeFactureGMBS?: any[];
  pieceJointeFactureArtisan?: any[];
  pieceJointeFactureMateriel?: any[];
  consigneIntervention?: string;
  consigneDeuxiemeArtisanIntervention?: string;
  commentaireAgent?: string;
  adresse: string;
  codePostal: string;
  ville: string;
  latitudeAdresse?: string;
  longitudeAdresse?: string;
  type: string;
  typeDeuxiemeArtisan?: string;
  datePrevue?: string;
  datePrevueDeuxiemeArtisan?: string;
  statut: string;
  sousStatutText?: string;
  sousStatutTextColor?: string;
  prenomProprietaire?: string;
  nomProprietaire?: string;
  telephoneProprietaire?: string;
  emailProprietaire?: string;
  prenomClient?: string;
  nomClient?: string;
  telephoneClient?: string;
  telephone2Client?: string;
  emailClient?: string;
  coutSST?: number;
  marge?: number;
  coutMateriel?: number;
  coutIntervention?: number;
  coutSSTDeuxiemeArtisan?: number;
  margeDeuxiemeArtisan?: number;
  coutMaterielDeuxiemeArtisan?: number;
  acompteSST?: number;
  acompteClient?: number;
  acompteSSTRecu: boolean;
  acompteClientRecu: boolean;
  dateAcompteSST?: string;
  dateAcompteClient?: string;
  deleteInterventionComptabilite?: boolean;
  
  // Relations
  attribueA?: string; // User ID
  artisan?: string; // Artisan ID
  deuxiemeArtisan?: string; // Artisan ID
  
  // Champs additionnels du CSV
  metier?: string;
  pourcentageSST?: number;
  dateIntervention?: string;
  telLoc?: string;
  locataire?: string;
  emailLocataire?: string;
  commentaire?: string;
  truspilot?: string;
  demandeIntervention?: string;
  demandeDevis?: string;
  demandeTrustPilot?: string;
}

export const mockInterventions: Intervention[] = [
  {
    id: "1",
    idFacture: 1001,
    date: "2024-01-15T08:00:00Z",
    agence: "Flatlooker",
    contexteIntervention: "Velux ne ferme pas correctement",
    adresse: "125 Rue du Marché",
    codePostal: "59000",
    ville: "Lille",
    type: "Vitrerie",
    statut: "Visite_Technique",
    prenomProprietaire: "Florence",
    nomProprietaire: "Lavaud",
    telephoneProprietaire: "06 12 34 56 78",
    emailProprietaire: "florence.lavaud@email.com",
    coutSST: 0,
    coutMateriel: 0,
    coutIntervention: 0,
    acompteSSTRecu: false,
    acompteClientRecu: false,
    attribueA: "1",
    artisan: "1",
    metier: "Vitrerie",
    pourcentageSST: 0,
    dateIntervention: "2024-01-20",
    telLoc: "06 12 34 56 78",
    locataire: "Le loc est jamais là",
    emailLocataire: "locataire@email.com",
    commentaire: "Intervention urgente",
    truspilot: "En attente",
    demandeIntervention: "✅",
    demandeDevis: "✅",
    demandeTrustPilot: "✅"
  },
  {
    id: "2",
    idFacture: 1002,
    date: "2024-01-17T10:30:00Z",
    agence: "Agence Blue",
    contexteIntervention: "Porte de placard décrochée",
    adresse: "19 rue Sarette",
    codePostal: "75014",
    ville: "Paris",
    type: "Bricolage",
    statut: "SAV",
    prenomProprietaire: "Jean",
    nomProprietaire: "Dupont",
    telephoneProprietaire: "06 13 27 31 07",
    emailProprietaire: "jean.dupont@email.com",
    coutSST: 70,
    coutMateriel: 25,
    coutIntervention: 95,
    acompteSSTRecu: true,
    acompteClientRecu: false,
    attribueA: "2",
    artisan: "2",
    metier: "Bricolage",
    pourcentageSST: 0,
    dateIntervention: "2024-01-18",
    telLoc: "06 13 27 31 07",
    locataire: "Marie Martin",
    emailLocataire: "marie.martin@email.com",
    commentaire: "Réparation rapide",
    truspilot: "En attente",
    demandeIntervention: "✅",
    demandeDevis: "✅",
    demandeTrustPilot: "✅"
  },
  {
    id: "3",
    idFacture: 1003,
    date: "2024-01-20T14:00:00Z",
    agence: "Flatlooker",
    contexteIntervention: "Remplacement de la résistance / remplacement de la résistance ok",
    adresse: "31 Rue Jean-Jacques Rousseau",
    codePostal: "92150",
    ville: "Suresnes",
    type: "Plomberie",
    statut: "SAV",
    prenomProprietaire: "Florence",
    nomProprietaire: "Lavaud",
    telephoneProprietaire: "06 98 76 54 32",
    emailProprietaire: "florence.lavaud@email.com",
    coutSST: 0,
    coutMateriel: 0,
    coutIntervention: 0,
    acompteSSTRecu: false,
    acompteClientRecu: false,
    attribueA: "1",
    artisan: "2",
    metier: "Plomberie",
    pourcentageSST: 0,
    dateIntervention: "2024-01-21",
    telLoc: "06 98 76 54 32",
    locataire: "Pierre Durand",
    emailLocataire: "pierre.durand@email.com",
    commentaire: "Résistance remplacée avec succès",
    truspilot: "En attente",
    demandeIntervention: "✅",
    demandeDevis: "✅",
    demandeTrustPilot: "✅"
  },
  {
    id: "4",
    idFacture: 1004,
    date: "2024-01-22T09:15:00Z",
    agence: "Flatlooker",
    contexteIntervention: "Diagnostic électrique suite à problème chauffe-eau",
    adresse: "31 Rue Jean-Jacques Rousseau",
    codePostal: "92150",
    ville: "Suresnes",
    type: "Électricité",
    statut: "SAV",
    prenomProprietaire: "Florence",
    nomProprietaire: "Lavaud",
    telephoneProprietaire: "06 98 76 54 32",
    emailProprietaire: "florence.lavaud@email.com",
    coutSST: 70,
    coutMateriel: 0,
    coutIntervention: 70,
    acompteSSTRecu: false,
    acompteClientRecu: false,
    attribueA: "1",
    artisan: "3",
    metier: "Électricité",
    pourcentageSST: 0,
    dateIntervention: "2024-01-23",
    telLoc: "06 98 76 54 32",
    locataire: "Pierre Durand",
    emailLocataire: "pierre.durand@email.com",
    commentaire: "Diagnostic effectué, devis envoyé",
    truspilot: "En attente",
    demandeIntervention: "✅",
    demandeDevis: "✅",
    demandeTrustPilot: "✅"
  },
  {
    id: "5",
    idFacture: 1005,
    date: "2024-01-25T11:00:00Z",
    agence: "Agence Blue",
    contexteIntervention: "Fuite d'eau sous l'évier",
    adresse: "45 Avenue des Champs-Élysées",
    codePostal: "75008",
    ville: "Paris",
    type: "Plomberie",
    statut: "En_cours",
    prenomProprietaire: "Sophie",
    nomProprietaire: "Bernard",
    telephoneProprietaire: "06 11 22 33 44",
    emailProprietaire: "sophie.bernard@email.com",
    coutSST: 120,
    coutMateriel: 45,
    coutIntervention: 165,
    acompteSSTRecu: true,
    acompteClientRecu: true,
    attribueA: "2",
    artisan: "5",
    metier: "Plomberie",
    pourcentageSST: 0,
    dateIntervention: "2024-01-26",
    telLoc: "06 11 22 33 44",
    locataire: "Thomas Moreau",
    emailLocataire: "thomas.moreau@email.com",
    commentaire: "Intervention en cours",
    truspilot: "En attente",
    demandeIntervention: "✅",
    demandeDevis: "✅",
    demandeTrustPilot: "✅"
  }
];

// Fonctions utilitaires pour les interventions
export const getInterventionById = (id: string): Intervention | undefined => {
  return mockInterventions.find(intervention => intervention.id === id);
};

export const getInterventionsByStatut = (statut: string): Intervention[] => {
  return mockInterventions.filter(intervention => intervention.statut === statut);
};

export const getInterventionsByAgence = (agence: string): Intervention[] => {
  return mockInterventions.filter(intervention => intervention.agence === agence);
};

export const getInterventionsByArtisan = (artisanId: string): Intervention[] => {
  return mockInterventions.filter(intervention => 
    intervention.artisan === artisanId || intervention.deuxiemeArtisan === artisanId
  );
};

export const getInterventionsByUser = (userId: string): Intervention[] => {
  return mockInterventions.filter(intervention => intervention.attribueA === userId);
};

export const getInterventionsByDateRange = (startDate: string, endDate: string): Intervention[] => {
  return mockInterventions.filter(intervention => {
    const interventionDate = new Date(intervention.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return interventionDate >= start && interventionDate <= end;
  });
};

export const getInterventionsByMetier = (metier: string): Intervention[] => {
  return mockInterventions.filter(intervention => 
    intervention.metier?.toLowerCase().includes(metier.toLowerCase())
  );
};

// Statuts disponibles (basés sur les machines d'état legacy)
export const INTERVENTION_STATUS = [
  'Demandé',
  'Devis_Envoyé', 
  'Accepté',
  'En_cours',
  'Visite_Technique',
  'Terminé',
  'Annulé',
  'Refusé',
  'STAND_BY',
  'SAV'
];

// Métiers disponibles (basés sur le CSV)
export const INTERVENTION_METIERS = [
  'Vitrerie',
  'Bricolage', 
  'Plomberie',
  'Électricité',
  'Couvreur',
  'Menuiserie',
  'Chauffage',
  'Dépannage'
];
