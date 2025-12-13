// Service API Supabase - Remplace les MockAPI
// Centralise toutes les appels vers les Edge Functions
// 
// SCHEMA UPDATE (2024): 
// - Interfaces alignées avec le schéma Supabase actuel
// - Support des relations normalisées (agencies, clients, metiers, statuses)
// - Champs legacy maintenus pour la compatibilité ascendante
// - Nouvelles interfaces pour les données liées (costs, payments, attachments)

const resolveFunctionsUrl = () => {
  const explicitUrl =
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL || process.env.SUPABASE_FUNCTIONS_URL;
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '');
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321').replace(/\/$/, '');
  if (baseUrl.endsWith('/rest/v1')) {
    return baseUrl.replace(/\/rest\/v1$/, '/functions/v1');
  }
  return `${baseUrl}/functions/v1`;
};

const SUPABASE_FUNCTIONS_URL = resolveFunctionsUrl();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Headers communs pour toutes les requêtes
const getHeaders = () => ({
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

// Gestionnaire d'erreurs centralisé
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
};

// Types d'interface alignés avec le schéma Supabase actuel
export interface User {
  id: string;
  firstname: string | null;
  lastname: string | null;
  username: string;
  email: string | null;
  roles: string[]; // Computed from user_roles table
  token_version: number | null;
  color: string | null;
  code_gestionnaire: string | null;
  status: 'connected' | 'dnd' | 'busy' | 'offline';
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Legacy fields for backward compatibility
  name?: string; // Computed from firstname + lastname
  prenom?: string; // Alias for firstname
  tokenVersion?: number; // Alias for token_version
  deleteDate?: string; // Not in current schema - using status instead
}

export interface Artisan {
  id: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  raison_sociale: string | null;
  siret: string | null;
  statut_juridique: string | null;
  metiers: string[]; // Computed from artisan_metiers table
  zones: string[]; // Computed from artisan_zones table
  statut_id: string | null; // Reference to artisan_statuses
  gestionnaire_id: string | null; // Reference to users
  adresse_siege_social: string | null;
  ville_siege_social: string | null;
  code_postal_siege_social: string | null;
  adresse_intervention: string | null;
  ville_intervention: string | null;
  code_postal_intervention: string | null;
  intervention_latitude: number | null;
  intervention_longitude: number | null;
  numero_associe: string | null;
  suivi_relances_docs: string | null;
  is_active: boolean | null;
  date_ajout: string | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Legacy fields for backward compatibility
  date?: string; // Alias for date_ajout
  statutArtisan?: string; // Computed from statut_id
  statutInactif?: boolean; // Computed from !is_active
  zoneIntervention?: number; // Computed from zones
  commentaire?: string; // Alias for suivi_relances_docs
  statutDossier?: string; // Legacy field
  statutAvantArchiver?: string; // Legacy field
  statutArtisanAvantInactif?: string; // Legacy field
  attribueA?: string; // Alias for gestionnaire_id
}

export interface Intervention {
  id: string;
  id_inter: string | null;
  agence_id: string | null; // Reference to agencies
  client_id: string | null; // Reference to clients
  assigned_user_id: string | null; // Reference to users
  statut_id: string | null; // Reference to intervention_statuses
  metier_id: string | null; // Reference to metiers
  
  date: string;
  date_termine: string | null;
  date_prevue: string | null;
  due_date: string | null;
  
  contexte_intervention: string | null;
  consigne_intervention: string | null;
  consigne_second_artisan: string | null;
  commentaire_agent: string | null;
  
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
  
  numero_sst: string | null;
  pourcentage_sst: number | null;
  
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Related data (computed from joins)
  artisans: string[]; // Computed from intervention_artisans
  costs: InterventionCost[];
  payments: InterventionPayment[];
  attachments: InterventionAttachment[];
  
  // Legacy fields for backward compatibility
  idFacture?: number; // Legacy field
  agence?: string; // Computed from agence_id
  contexteIntervention?: string; // Alias for contexte_intervention
  consigneIntervention?: string; // Alias for consigne_intervention
  consigneDeuxiemeArtisanIntervention?: string; // Alias for consigne_second_artisan
  commentaireAgent?: string; // Alias for commentaire_agent
  codePostal?: string; // Alias for code_postal
  latitudeAdresse?: string; // Alias for latitude
  longitudeAdresse?: string; // Alias for longitude
  type?: string; // Legacy field
  typeDeuxiemeArtisan?: string; // Legacy field
  datePrevue?: string; // Alias for date_prevue
  datePrevueDeuxiemeArtisan?: string; // Legacy field
  statut?: string; // Computed from statut_id
  sousStatutText?: string; // Legacy field
  sousStatutTextColor?: string; // Legacy field
  prenomProprietaire?: string; // Legacy field
  nomProprietaire?: string; // Legacy field
  telephoneProprietaire?: string; // Legacy field
  emailProprietaire?: string; // Legacy field
  prenomClient?: string; // Computed from client_id
  nomClient?: string; // Computed from client_id
  telephoneClient?: string; // Computed from client_id
  telephone2Client?: string; // Computed from client_id
  emailClient?: string; // Computed from client_id
  coutSST?: number; // Computed from costs
  marge?: number; // Computed from costs
  coutMateriel?: number; // Computed from costs
  coutIntervention?: number; // Computed from costs
  coutSSTDeuxiemeArtisan?: number; // Computed from costs
  margeDeuxiemeArtisan?: number; // Computed from costs
  coutMaterielDeuxiemeArtisan?: number; // Computed from costs
  acompteSST?: number; // Computed from payments
  acompteClient?: number; // Computed from payments
  acompteSSTRecu?: boolean; // Computed from payments
  acompteClientRecu?: boolean; // Computed from payments
  dateAcompteSST?: string; // Computed from payments
  dateAcompteClient?: string; // Computed from payments
  deleteInterventionComptabilite?: boolean; // Legacy field
  
  // Relations (legacy)
  attribueA?: string; // Alias for assigned_user_id
  artisan?: string; // Computed from artisans[0]
  deuxiemeArtisan?: string; // Computed from artisans[1]
  
  // Champs additionnels du CSV (legacy)
  metier?: string; // Computed from metier_id
  numeroSST?: string; // Alias for numero_sst
  pourcentageSST?: number; // Alias for pourcentage_sst
  dateIntervention?: string; // Alias for date
  telLoc?: string; // Legacy field
  locataire?: string; // Legacy field
  emailLocataire?: string; // Legacy field
  commentaire?: string; // Legacy field
  truspilot?: string; // Legacy field
  demandeIntervention?: string; // Legacy field
  demandeDevis?: string; // Legacy field
  demandeTrustPilot?: string; // Legacy field
  
  // Legacy attachment fields
  pieceJointeIntervention?: any[];
  pieceJointeCout?: any[];
  pieceJointeDevis?: any[];
  pieceJointePhotos?: any[];
  pieceJointeFactureGMBS?: any[];
  pieceJointeFactureArtisan?: any[];
  pieceJointeFactureMateriel?: any[];
}

// Supporting interfaces for related data
export interface InterventionCost {
  id: string;
  intervention_id: string;
  cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
  label: string | null;
  amount: number;
  currency: string | null;
  artisan_order: 1 | 2 | null; // 1=principal, 2=secondaire, null=global
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionPayment {
  id: string;
  intervention_id: string;
  payment_type: string;
  amount: number;
  currency: string | null;
  is_received: boolean | null;
  payment_date: string | null;
  reference: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionAttachment {
  id: string;
  intervention_id: string;
  kind: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string | null;
  created_by: string | null;
  created_by_display: string | null;
  created_by_code: string | null;
  created_by_color: string | null;
}

// Interface pour les réponses paginées
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// Additional interfaces for supporting data
export interface Agency {
  id: string;
  label: string;
  code: string | null;
  region: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Client {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  telephone: string | null;
  telephone2: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  external_ref: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Metier {
  id: string;
  label: string;
  code: string | null;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionStatus {
  id: string;
  code: string;
  label: string;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

export interface ArtisanStatus {
  id: string;
  code: string;
  label: string;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

// ===== API USERS =====

export const usersApi = {
  // Récupérer tous les utilisateurs actifs
  async getAll(): Promise<User[]> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/users/users`, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    const users = result.data || result;
    
    // Transform database fields to API interface
    return users.map((user: any) => ({
      ...user,
      // Legacy compatibility
      name: user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : user.firstname || user.lastname,
      prenom: user.firstname,
      tokenVersion: user.token_version,
      deleteDate: user.status === 'offline' ? new Date().toISOString() : undefined,
    }));
  },

  // Récupérer un utilisateur par ID
  async getById(id: string): Promise<User | null> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/users/users/${id}`, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    const user = result.data || result;
    
    if (!user) return null;
    
    // Transform database fields to API interface
    return {
      ...user,
      // Legacy compatibility
      name: user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : user.firstname || user.lastname,
      prenom: user.firstname,
      tokenVersion: user.token_version,
      deleteDate: user.status === 'offline' ? new Date().toISOString() : undefined,
    };
  },

  // Récupérer un utilisateur par username
  async getByUsername(username: string): Promise<User | null> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/users/users/username?username=${encodeURIComponent(username)}`, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    const user = result.data || result;
    
    if (!user) return null;
    
    // Transform database fields to API interface
    return {
      ...user,
      // Legacy compatibility
      name: user.firstname && user.lastname ? `${user.firstname} ${user.lastname}` : user.firstname || user.lastname,
      prenom: user.firstname,
      tokenVersion: user.token_version,
      deleteDate: user.status === 'offline' ? new Date().toISOString() : undefined,
    };
  },

  // Récupérer les utilisateurs par rôle
  async getByRole(role: string): Promise<User[]> {
    const allUsers = await this.getAll();
    return allUsers.filter(user => user.roles.includes(role));
  },

  // Récupérer les utilisateurs actifs
  async getActive(): Promise<User[]> {
    const allUsers = await this.getAll();
    return allUsers.filter(user => user.status !== 'offline');
  },
};

// ===== API ARTISANS =====

export const artisansApi = {
  // Récupérer tous les artisans (avec pagination)
  async getAll(params?: {
    limit?: number;
    offset?: number;
    metier?: string;
    zone?: number;
    statut?: string;
  }): Promise<PaginatedResponse<Artisan> | Artisan[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.metier) searchParams.append('metier', params.metier);
    if (params?.zone) searchParams.append('zone', params.zone.toString());
    if (params?.statut) searchParams.append('statut', params.statut);

    const url = `${SUPABASE_FUNCTIONS_URL}/artisans/artisans${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    
    // Retourner le format paginé si disponible, sinon le format simple
    return result.pagination ? result : { data: result, pagination: { limit: result.length, offset: 0, total: result.length, hasMore: false } };
  },

  // Récupérer un artisan par ID
  async getById(id: string): Promise<Artisan | null> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/artisans/artisans/${id}`, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    return result.data || result;
  },

  // Récupérer les artisans par métier
  async getByMetier(metier: string): Promise<Artisan[]> {
    const result = await this.getAll({ metier });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les artisans par zone
  async getByZone(zone: number): Promise<Artisan[]> {
    const result = await this.getAll({ zone });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les artisans actifs
  async getActive(): Promise<Artisan[]> {
    const result = await this.getAll();
    const artisans = 'data' in result ? result.data : result;
    return artisans.filter(artisan => artisan.is_active !== false);
  },

  // Récupérer les artisans par statut
  async getByStatut(statut: string): Promise<Artisan[]> {
    const result = await this.getAll({ statut });
    return 'data' in result ? result.data : result;
  },
};

// ===== API INTERVENTIONS =====

export const interventionsApi = {
  // Récupérer toutes les interventions (avec pagination)
  async getAll(params?: {
    limit?: number;
    offset?: number;
    statut?: string;
    agence?: string;
    artisan?: string;
    user?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Intervention> | Intervention[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.statut) searchParams.append('statut', params.statut);
    if (params?.agence) searchParams.append('agence', params.agence);
    if (params?.artisan) searchParams.append('artisan', params.artisan);
    if (params?.user) searchParams.append('user', params.user);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const url = `${SUPABASE_FUNCTIONS_URL}/interventions/interventions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    
    // Retourner le format paginé si disponible, sinon le format simple
    return result.pagination ? result : { data: result, pagination: { limit: result.length, offset: 0, total: result.length, hasMore: false } };
  },

  // Récupérer une intervention par ID
  async getById(id: string): Promise<Intervention | null> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/interventions/interventions/${id}`, {
      headers: await getHeaders(),
    });
    const result = await handleResponse(response);
    return result.data || result;
  },

  // Récupérer les interventions par statut
  async getByStatut(statut: string): Promise<Intervention[]> {
    const result = await this.getAll({ statut });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les interventions par agence
  async getByAgence(agence: string): Promise<Intervention[]> {
    const result = await this.getAll({ agence });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les interventions par artisan
  async getByArtisan(artisanId: string): Promise<Intervention[]> {
    const result = await this.getAll({ artisan: artisanId });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les interventions par utilisateur
  async getByUser(userId: string): Promise<Intervention[]> {
    const result = await this.getAll({ user: userId });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les interventions par plage de dates
  async getByDateRange(startDate: string, endDate: string): Promise<Intervention[]> {
    const result = await this.getAll({ startDate, endDate });
    return 'data' in result ? result.data : result;
  },

  // Récupérer les interventions par métier
  async getByMetier(metier: string): Promise<Intervention[]> {
    const allInterventions = await this.getAll();
    const interventions = 'data' in allInterventions ? allInterventions.data : allInterventions;
    return interventions.filter(intervention => 
      intervention.metier?.toLowerCase().includes(metier.toLowerCase())
    );
  },
};

// Export des constantes (pour compatibilité avec MockAPI)
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
