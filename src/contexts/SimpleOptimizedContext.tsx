"use client"

// ===== VERSION SIMPLIFIÉE ULTRA-OPTIMISÉE =====
// Évite les problèmes de build Next.js

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ===== CACHE SIMPLE =====
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize = 50; // Limite pour PC faibles
  private ttl = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any): void {
    if (this.cache.size >= this.maxSize) {
      const iterator = this.cache.keys().next();
      if (!iterator.done && iterator.value !== undefined) {
        this.cache.delete(iterator.value as string);
      }
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

// ===== CONTEXT SIMPLIFIÉ =====
interface SimpleContextType {
  cache: SimpleCache;
  clearCache: () => void;
}

const SimpleContext = createContext<SimpleContextType | null>(null);

export function SimpleOptimizedProvider({ children }: { children: ReactNode }) {
  const cache = useMemo(() => new SimpleCache(), []);

  const clearCache = useCallback(() => {
    cache.clear();
  }, [cache]);

  return (
    <SimpleContext.Provider value={{ cache, clearCache }}>
      {children}
    </SimpleContext.Provider>
  );
}

export function useSimpleOptimized() {
  const context = useContext(SimpleContext);
  if (!context) {
    throw new Error('useSimpleOptimized must be used within SimpleOptimizedProvider');
  }
  return context;
}

// ===== HOOKS SIMPLIFIÉS =====
export function useSimpleInterventions() {
  const { cache } = useSimpleOptimized();
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = 'interventions-all';
      const cached = cache.get(cacheKey);
      
      if (cached && !reset) {
        setInterventions(cached.data);
        setTotalCount(cached.total);
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Import dynamique
      const { interventionsApi } = await import('@/lib/api/v2');
      const result = await interventionsApi.getAll({ limit: 100 });

      const newData = result.data;
      const newTotal = result.pagination.total;

      setInterventions(newData);
      setTotalCount(newTotal);
      setHasMore(false);

      // Cache
      cache.set(cacheKey, {
        data: newData,
        total: newTotal,
        hasMore: false
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [cache]);

  // Chargement initial
  useEffect(() => {
    if (interventions.length === 0) {
      loadData(true);
    }
  }, [interventions.length, loadData]);

  return {
    interventions,
    totalCount,
    hasMore,
    loading,
    error,
    loadMore: () => loadData(false),
    refresh: () => loadData(true)
  };
}

export function useSimpleArtisans() {
  const { cache } = useSimpleOptimized();
  const [artisans, setArtisans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = `artisans-${reset ? 'reset' : 'more'}`;
      const cached = cache.get(cacheKey);
      
      if (cached && !reset) {
        setArtisans(prev => reset ? cached.data : [...prev, ...cached.data]);
        setTotalCount(cached.total);
        setHasMore(cached.hasMore);
        setLoading(false);
        return;
      }

      // Import dynamique
      const { artisansApi } = await import('@/lib/api/v2');
      const result = await artisansApi.getAll({ 
        limit: 30, // Limité pour PC faibles
        offset: reset ? 0 : artisans.length 
      });

      const newData = result.data;
      const newTotal = result.pagination.total;
      const newHasMore = result.pagination.hasMore;

      if (reset) {
        setArtisans(newData);
      } else {
        setArtisans(prev => [...prev, ...newData]);
      }

      setTotalCount(newTotal);
      setHasMore(newHasMore);

      // Cache
      cache.set(cacheKey, {
        data: newData,
        total: newTotal,
        hasMore: newHasMore
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [cache, artisans.length]);

  // Chargement initial
  useEffect(() => {
    if (artisans.length === 0) {
      loadData(true);
    }
  }, [artisans.length, loadData]);

  return {
    artisans,
    totalCount,
    hasMore,
    loading,
    error,
    loadMore: () => loadData(false),
    refresh: () => loadData(true)
  };
}
