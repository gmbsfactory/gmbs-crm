// ===== HOOK POUR LES FILTRES INTELLIGENTS =====
// Gère les filtres avec conversion automatique ID <-> Code

import { useCallback, useMemo } from 'react';
import { useReferenceDataQuery } from './useReferenceDataQuery';

interface FilterOptions {
  statut?: string;
  agence?: string;
  user?: string;
  metier?: string;
  search?: string;
}

export function useSmartFilters() {
  const { data: referenceData, getInterventionStatusLabel, getAgencyLabel, getUserCode } = useReferenceDataQuery();

  // Convertir les filtres d'affichage en filtres API
  const convertFiltersToApi = useCallback((filters: FilterOptions) => {
    const apiFilters: any = {};

    // Convertir les codes en IDs si nécessaire
    if (filters.statut && referenceData?.interventionStatuses) {
      const status = referenceData.interventionStatuses.find(s => s.code === filters.statut || s.label === filters.statut);
      if (status) apiFilters.statut = status.id;
    }

    if (filters.agence && referenceData?.agencies) {
      const agency = referenceData.agencies.find(a => a.code === filters.agence || a.label === filters.agence);
      if (agency) apiFilters.agence = agency.id;
    }

    if (filters.user && referenceData?.users) {
      const user = referenceData.users.find(u => u.code_gestionnaire === filters.user || u.username === filters.user);
      if (user) apiFilters.user = user.id;
    }

    // Ajouter la recherche textuelle
    if (filters.search) {
      apiFilters.search = filters.search;
    }

    return apiFilters;
  }, [referenceData]);

  // Convertir les données d'API en données d'affichage
  const convertApiToDisplay = useCallback((interventions: any[]) => {
    return interventions.map(intervention => ({
      ...intervention,
      // Ajouter les labels pour l'affichage
      statutLabel: getInterventionStatusLabel(intervention.statut_id),
      agenceLabel: getAgencyLabel(intervention.agence_id),
      userLabel: getUserCode(intervention.assigned_user_id),
    }));
  }, [getInterventionStatusLabel, getAgencyLabel, getUserCode]);

  // Options de filtres pour les composants UI
  const filterOptions = useMemo(() => ({
    statuts: referenceData?.interventionStatuses.map(s => ({ value: s.code, label: s.label })) || [],
    agences: referenceData?.agencies.map(a => ({ value: a.code, label: a.label })) || [],
    users: referenceData?.users.map(u => ({ value: u.code_gestionnaire, label: `${u.firstname} ${u.lastname}` })) || [],
  }), [referenceData]);

  return {
    convertFiltersToApi,
    convertApiToDisplay,
    filterOptions,
    referenceData
  };
}
