// ===== INTERVENTIONS STATS - INTERNAL TYPES =====
// Types internes utilisés par les méthodes stats pour typer les résultats Supabase.
// Non exportés depuis l'API publique.

export interface StatusQueryRow {
  statut_id: string | null;
  date_prevue: string | null;
  status: { id?: string; code?: string; label?: string } | null;
}

export interface MarginQueryRow {
  id: string;
  id_inter: string | null;
  intervention_costs: Array<{ id: string; cost_type: string; amount: number; label: string | null }>;
}

export interface TransitionRow {
  id: string;
  intervention_id: string;
  transition_date: string;
  to_status_code: string;
  interventions: Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface ArtisanCreatedRow {
  id: string;
  created_at: string | null;
  gestionnaire_id: string | null;
}

export interface ArtisanMissionneRow {
  id: string;
  created_at: string | null;
  gestionnaire_id: string | null;
  intervention_artisans: unknown;
}

export interface RpcRankingItem {
  user_id: string;
  total_margin: number;
  total_revenue: number;
  total_interventions: number;
  average_margin_percentage: number;
}

export interface RpcRankingResult {
  rankings: RpcRankingItem[];
  period?: { start_date: string | null; end_date: string | null };
}

export interface SparklineRow {
  date: string;
  nb_interventions_demandees?: number;
  nb_interventions_terminees?: number;
  ca_jour?: number;
  marge_jour?: number;
}

export interface VolumeByStatusRow {
  date: string;
  demande?: number;
  devis_envoye?: number;
  accepte?: number;
  en_cours?: number;
  termine?: number;
}

export interface StatusBreakdownRow {
  status_code: string;
  status_label: string;
  count: number;
}

export interface ConversionFunnelRow {
  status_code: string;
  count: number;
}

export interface PerformanceRow {
  [key: string]: unknown;
}

export interface RecentInterventionQueryRow {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  date_prevue: string | null;
  date: string;
  adresse: string | null;
  ville: string | null;
  status: { id?: string; code?: string; label?: string; color?: string } | null;
  intervention_costs: Array<{ cost_type: string; amount: number | null }>;
}

export interface RecentInterventionByStatusRow {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  date_prevue: string | null;
  date: string;
  agence_id: string | null;
  metier_id: string | null;
  status: { id?: string; code?: string; label?: string; color?: string } | null;
  agence: { id?: string; label?: string; code?: string } | null;
  metier: { id?: string; label?: string; code?: string } | null;
  intervention_costs: Array<{ cost_type: string; amount: number | null }>;
}
