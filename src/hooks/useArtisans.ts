// ===== HOOK PERSONNALISÉ POUR LES ARTISANS =====
// Centralise la logique de chargement des artisans
// Utilise l'API v2 optimisée

import { artisansApi, type Artisan } from '@/lib/api/v2';
import * as React from 'react';
import { useCallback, useEffect, useState, useMemo } from 'react';

interface UseArtisansOptions {
  limit?: number;
  page?: number;
  autoLoad?: boolean;
  filters?: {
    statut?: string;
    metier?: string;
    zone?: string;
    gestionnaire?: string;
  };
  serverFilters?: {
    gestionnaire?: string;
    statut?: string;
  };
}

interface UseArtisansReturn {
  artisans: Artisan[];
  setArtisans: React.Dispatch<React.SetStateAction<Artisan[]>>;
  loading: boolean;
  error: string | null;
  totalCount: number | null;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  refresh: () => Promise<void>;
  setFilters: (filters: UseArtisansOptions['filters']) => void;
}

export function useArtisans(options: UseArtisansOptions = {}): UseArtisansReturn {
  const {
    limit = 100,
    page = 1,
    autoLoad = true,
    filters = {},
    serverFilters
  } = options;

  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(page);
  const [currentFilters, setCurrentFilters] = useState(filters);

  // Calculer l'offset depuis la page courante
  const offset = useMemo(() => {
    return (currentPage - 1) * limit;
  }, [currentPage, limit]);

  // Calculer le nombre total de pages
  const totalPages = useMemo(() => {
    return totalCount ? Math.max(1, Math.ceil(totalCount / limit)) : 1;
  }, [totalCount, limit]);

  const loadArtisans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit,
        offset,
        ...(serverFilters || currentFilters)
      };

      const result = await artisansApi.getAll(params);
      
      // Remplacer au lieu d'accumuler
      setArtisans(result.data);

      setTotalCount(result.pagination.total);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      console.error('Erreur lors du chargement des artisans:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, currentFilters, serverFilters]);

  const refresh = useCallback(async () => {
    await loadArtisans();
  }, [loadArtisans]);

  const goToPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const setFilters = useCallback((newFilters: UseArtisansOptions['filters'] = {}) => {
    setCurrentFilters(newFilters ?? {});
    setArtisans([]);
    setCurrentPage(1); // Réinitialiser à la page 1
  }, []);

  // Réinitialiser à la page 1 quand les filtres serveur changent
  useEffect(() => {
    setCurrentPage(1);
  }, [serverFilters]);

  // Chargement automatique quand la page ou les filtres changent
  useEffect(() => {
    if (autoLoad) {
      loadArtisans();
    }
  }, [autoLoad, loadArtisans]);

  return {
    artisans,
    setArtisans,
    loading,
    error,
    totalCount,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    refresh,
    setFilters
  };
}
