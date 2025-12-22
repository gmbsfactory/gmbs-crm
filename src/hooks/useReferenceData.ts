// ===== HOOK POUR LES DONNÉES DE RÉFÉRENCE =====
// Cache les données de référence pour éviter les requêtes répétées

import { referenceApi, type ReferenceData } from '@/lib/reference-api';
import { useCallback, useEffect, useState } from 'react';

interface UseReferenceDataReturn {
  data: ReferenceData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getInterventionStatusLabel: (id: string) => string;
  getAgencyLabel: (id: string) => string;
  getUserCode: (id: string) => string;
}

// Cache global pour éviter les requêtes répétées
let cachedData: ReferenceData | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fonction pour invalider le cache (utile pour debug)
export function invalidateReferenceDataCache() {
  cachedData = null;
  lastFetch = 0;
}

export function useReferenceData(): UseReferenceDataReturn {
  // Le cache est valide seulement s'il existe, n'est pas expiré, ET contient des données utilisateurs
  const isCacheValid = cachedData 
    && Date.now() - lastFetch < CACHE_DURATION 
    && cachedData.users && cachedData.users.length > 0;
  const [data, setData] = useState<ReferenceData | null>(isCacheValid ? cachedData : null);
  const [loading, setLoading] = useState(!isCacheValid);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    // Utiliser le cache si disponible, récent ET contient des utilisateurs
    if (cachedData && Date.now() - lastFetch < CACHE_DURATION && cachedData.users && cachedData.users.length > 0) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await referenceApi.getAll();
      
      // Log pour debug
      console.log('[useReferenceData] Données chargées:', {
        users: result.users?.length || 0,
        agencies: result.agencies?.length || 0,
        statuses: result.interventionStatuses?.length || 0,
      });
      
      // Mettre en cache
      cachedData = result;
      lastFetch = Date.now();
      setData(result);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      console.error('Erreur lors du chargement des données de référence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    cachedData = null; // Invalider le cache
    await loadData();
  }, [loadData]);

  // Chargement automatique
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fonctions utilitaires
  const getInterventionStatusLabel = useCallback((id: string): string => {
    if (!data) return id;
    const status = data.interventionStatuses.find(s => s.id === id);
    return status?.label || id;
  }, [data]);

  const getAgencyLabel = useCallback((id: string): string => {
    if (!data) return id;
    const agency = data.agencies.find(a => a.id === id);
    return agency?.label || id;
  }, [data]);

  const getUserCode = useCallback((id: string): string => {
    if (!data) return id;
    const user = data.users.find(u => u.id === id);
    return user?.code_gestionnaire || id;
  }, [data]);

  return {
    data,
    loading,
    error,
    refresh,
    getInterventionStatusLabel,
    getAgencyLabel,
    getUserCode
  };
}
