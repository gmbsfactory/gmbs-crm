// ===== API DONNÉES DE RÉFÉRENCE =====
// Pour récupérer les statuts, agences, métiers, etc.

import { supabase } from './supabase-client';

export interface ReferenceData {
  interventionStatuses: Array<{ id: string; code: string; label: string; color: string; sort_order: number | null }>;
  artisanStatuses: Array<{ id: string; code: string; label: string; color: string; abbreviation: string | null }>;
  agencies: Array<{ id: string; code: string; label: string; color: string | null; requires_reference?: boolean }>;
  metiers: Array<{ id: string; code: string; label: string; color: string | null }>;
  users: Array<{
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    code_gestionnaire: string;
    color: string | null;
    avatar_url: string | null;
  }>;
}

export const referenceApi = {
  // Récupérer toutes les données de référence
  async getAll(): Promise<ReferenceData> {
    // Debug: vérifier si l'utilisateur est authentifié
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[referenceApi.getAll] Session debug:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      sessionError
    });

    const [interventionStatuses, artisanStatuses, agencies, metiers, users] = await Promise.all([
      supabase.from('intervention_statuses').select('id, code, label, color, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('artisan_statuses').select('id, code, label, color, abbreviation').eq('is_active', true).order('sort_order'),
      supabase.from('agencies').select('id, code, label, color, agency_config!left(requires_reference)').eq('is_active', true).order('label'),
      supabase.from('metiers').select('id, code, label, color').eq('is_active', true).order('label'),
      supabase.from('users').select('id, username, firstname, lastname, code_gestionnaire, color, avatar_url').neq('status', 'archived').order('username', { ascending: true })
    ]);

    // Debug: afficher les erreurs détaillées
    console.log('[referenceApi.getAll] Users query result:', {
      count: users.data?.length || 0,
      error: users.error,
      errorDetails: users.error ? {
        message: users.error.message,
        code: users.error.code,
        details: users.error.details,
        hint: users.error.hint
      } : null
    });

    // Mapper les agences pour extraire requires_reference depuis agency_config
    const mappedAgencies = (agencies.data || []).map((item: any) => ({
      id: item.id,
      code: item.code,
      label: item.label,
      color: item.color,
      requires_reference: item.agency_config?.requires_reference ?? false,
    }));

    return {
      interventionStatuses: interventionStatuses.data || [],
      artisanStatuses: artisanStatuses.data || [],
      agencies: mappedAgencies,
      metiers: metiers.data || [],
      users: users.data || []
    };
  },

  // Récupérer les statuts d'intervention
  async getInterventionStatuses() {
    const { data, error } = await supabase
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .order('sort_order');

    if (error) throw error;
    return data || [];
  },

  // Récupérer les agences
  async getAgencies() {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, code, label, color, agency_config!left(requires_reference)')
      .order('label');

    if (error) throw error;

    // Mapper pour extraire requires_reference depuis agency_config
    return (data || []).map((item: any) => ({
      id: item.id,
      code: item.code,
      label: item.label,
      color: item.color,
      requires_reference: item.agency_config?.requires_reference ?? false,
    }));
  },

  // Récupérer les métiers
  async getMetiers() {
    const { data, error } = await supabase
      .from('metiers')
      .select('id, code, label, color')
      .order('label');

    if (error) throw error;
    return data || [];
  },

  // Récupérer les utilisateurs (exclut les archivés)
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, firstname, lastname, code_gestionnaire, color, avatar_url')
      .neq('status', 'archived')
      .order('username', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};
