// ===== INTERVENTIONS-V2 - TYPES =====
// Types de requête (JSON entrant) et types internes (curseur, filtres).

export interface CreateInterventionRequest {
  id_inter?: string;
  agence_id?: string;
  reference_agence?: string;
  client_id?: string;
  tenant_id?: string;
  owner_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date: string;
  date_prevue?: string;
  contexte_intervention?: string;
  consigne_intervention?: string;
  consigne_second_artisan?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  pourcentage_sst?: number;
  is_vacant?: boolean;
  key_code?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  vacant_housing_instructions?: string | null;
}

export interface UpdateInterventionRequest {
  id_inter?: string;
  agence_id?: string;
  reference_agence?: string;
  client_id?: string;
  tenant_id?: string;
  owner_id?: string;
  assigned_user_id?: string;
  statut_id?: string;
  metier_id?: string;
  date?: string;
  date_termine?: string;
  date_prevue?: string;
  contexte_intervention?: string;
  consigne_intervention?: string;
  consigne_second_artisan?: string;
  commentaire_agent?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  latitude?: number;
  longitude?: number;
  pourcentage_sst?: number;
  is_active?: boolean;
  is_vacant?: boolean;
  key_code?: string | null;
  floor?: string | null;
  apartment_number?: string | null;
  vacant_housing_instructions?: string | null;
  // Sous-statut personnalisé
  sous_statut_text?: string | null;
  sous_statut_text_color?: string | null;
  sous_statut_bg_color?: string | null;
  // Deuxième artisan - métier et coûts
  metier_second_artisan_id?: string | null;
  // Note: Les coûts du 2ème artisan sont gérés via intervention_costs avec artisan_order = 2
}

export interface AssignArtisanRequest {
  intervention_id: string;
  artisan_id: string;
  role?: 'primary' | 'secondary';
  is_primary?: boolean;
}

export interface CreateCommentRequest {
  intervention_id: string;
  content: string;
  comment_type?: string;
  is_internal?: boolean;
}

export interface CreateAttachmentRequest {
  intervention_id: string;
  kind: string;
  url: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
}

export interface CreateCostRequest {
  intervention_id: string;
  cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
  label?: string;
  amount: number;
  currency?: string;
  metadata?: any;
}

export interface CreatePaymentRequest {
  intervention_id: string;
  payment_type: string;
  amount: number;
  currency?: string;
  is_received?: boolean;
  payment_date?: string;
  reference?: string;
}

export type CursorDirection = 'forward' | 'backward';

export interface InterventionCursor {
  date: string;
  id: string;
  direction?: CursorDirection;
}

export interface FilterParams {
  statut?: string[];
  agence?: string[];
  metier?: string[];
  user?: string[];
  userIsNull?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
  isCheck?: boolean;
}
