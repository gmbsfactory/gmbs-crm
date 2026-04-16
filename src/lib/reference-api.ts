// ===== API DONNÉES DE RÉFÉRENCE =====
// Façade par-dessus l'API v2 pour récupérer les statuts, agences, métiers, utilisateurs.
// Ne fait PAS d'appel direct à Supabase : délègue à src/lib/api/.
// Voir CLAUDE.md : "Toujours passer par API v2".

import {
  interventionStatusesApi,
  artisanStatusesApi,
  agenciesApi,
  metiersApi,
  usersApi,
} from './api';

export interface ReferenceData {
  interventionStatuses: Array<{ id: string; code: string; label: string; color: string; sort_order: number | null }>;
  artisanStatuses: Array<{ id: string; code: string; label: string; color: string; abbreviation: string | null }>;
  agencies: Array<{ id: string; code: string; label: string; color: string | null; is_active: boolean; requires_reference?: boolean }>;
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
  allUsers: Array<{
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    code_gestionnaire: string;
    color: string | null;
    avatar_url: string | null;
    status: string;
    archived_at: string | null;
  }>;
}

export const referenceApi = {
  async getAll(): Promise<ReferenceData> {
    const [
      interventionStatuses,
      artisanStatuses,
      agencies,
      metiers,
      users,
      allUsers,
    ] = await Promise.all([
      interventionStatusesApi.getAll(),
      artisanStatusesApi.getAll(),
      // includeInactive pour préserver le comportement historique de cette façade
      agenciesApi.getAll({ includeInactive: true }),
      metiersApi.getAll(),
      usersApi.listLight(),
      usersApi.listLightAll(),
    ]);

    return {
      interventionStatuses: interventionStatuses.map((s) => ({
        id: s.id,
        code: s.code,
        label: s.label,
        color: s.color,
        sort_order: s.sort_order,
      })),
      artisanStatuses: artisanStatuses
        .filter((s) => s.is_active)
        .map((s) => ({
          id: s.id,
          code: s.code,
          label: s.label,
          color: s.color ?? '',
          abbreviation: s.abbreviation,
        })),
      agencies: agencies.map((a) => ({
        id: a.id,
        code: a.code,
        label: a.label,
        color: a.color ?? null,
        is_active: a.is_active ?? true,
        requires_reference: a.requires_reference ?? false,
      })),
      metiers: metiers.map((m) => ({
        id: m.id,
        code: m.code,
        label: m.label,
        color: m.color ?? null,
      })),
      users,
      allUsers,
    };
  },

  async getInterventionStatuses() {
    const data = await interventionStatusesApi.getAll();
    return data.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      color: s.color,
      sort_order: s.sort_order,
    }));
  },

  async getAgencies() {
    const data = await agenciesApi.getAll({ includeInactive: true });
    return data.map((a) => ({
      id: a.id,
      code: a.code,
      label: a.label,
      color: a.color ?? null,
      requires_reference: a.requires_reference ?? false,
    }));
  },

  async getMetiers() {
    const data = await metiersApi.getAll();
    return data.map((m) => ({
      id: m.id,
      code: m.code,
      label: m.label,
      color: m.color ?? null,
    }));
  },

  async getUsers() {
    return usersApi.listLight();
  },
};
