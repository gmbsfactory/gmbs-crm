"use client"

// ===== ARCHITECTURE ULTRA-OPTIMISÉE =====
// Système de cache intelligent avec virtualisation et lazy loading

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

// ===== TYPES DE BASE =====
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface VirtualizedData<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  loadedRanges: Set<string>;
}

// ===== CACHE INTELLIGENT =====
class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Limite pour PC faibles
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    // Éviction LRU si nécessaire
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Incrémenter les hits pour LRU
    entry.hits++;
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Array.from(this.cache.values()).reduce((acc, entry) => acc + entry.hits, 0) / this.cache.size || 0
    };
  }
}

// ===== VIRTUALISATION INTELLIGENTE =====
class VirtualizedManager<T> {
  private data: VirtualizedData<T> = {
    items: [],
    totalCount: 0,
    hasMore: true,
    loadedRanges: new Set()
  };

  private pageSize = 50; // Optimisé pour PC faibles
  private cache = new SmartCache();

  async loadPage(page: number, loader: (offset: number, limit: number) => Promise<{data: T[], total: number, hasMore: boolean}>): Promise<void> {
    const rangeKey = `page-${page}`;
    
    // Vérifier le cache d'abord
    const cached = this.cache.get<{data: T[], total: number, hasMore: boolean}>(rangeKey);
    if (cached) {
      this.updateData(cached.data, cached.total, cached.hasMore, rangeKey);
      return;
    }

    // Charger depuis l'API
    const offset = page * this.pageSize;
    const result = await loader(offset, this.pageSize);
    
    // Mettre en cache
    this.cache.set(rangeKey, result);
    this.updateData(result.data, result.total, result.hasMore, rangeKey);
  }

  private updateData(newData: T[], total: number, hasMore: boolean, rangeKey: string): void {
    this.data = {
      items: [...this.data.items, ...newData],
      totalCount: total,
      hasMore,
      loadedRanges: new Set([...this.data.loadedRanges, rangeKey])
    };
  }

  getData(): VirtualizedData<T> {
    return this.data;
  }

  reset(): void {
    this.data = {
      items: [],
      totalCount: 0,
      hasMore: true,
      loadedRanges: new Set()
    };
    this.cache.clear();
  }
}

// ===== CONTEXT ULTRA-OPTIMISÉ =====
interface UltraOptimizedContextType {
  cache: SmartCache;
  interventionsManager: VirtualizedManager<any>;
  artisansManager: VirtualizedManager<any>;
  clearAllCache: () => void;
  getPerformanceStats: () => any;
}

const UltraOptimizedContext = createContext<UltraOptimizedContextType | null>(null);

export function UltraOptimizedProvider({ children }: { children: ReactNode }) {
  const cache = useMemo(() => new SmartCache(), []);
  const interventionsManager = useMemo(() => new VirtualizedManager(), []);
  const artisansManager = useMemo(() => new VirtualizedManager(), []);

  const clearAllCache = useCallback(() => {
    cache.clear();
    interventionsManager.reset();
    artisansManager.reset();
  }, [cache, interventionsManager, artisansManager]);

  const getPerformanceStats = useCallback(() => ({
    cache: cache.getStats(),
    interventions: interventionsManager.getData(),
    artisans: artisansManager.getData()
  }), [cache, interventionsManager, artisansManager]);

  return (
    <UltraOptimizedContext.Provider value={{
      cache,
      interventionsManager,
      artisansManager,
      clearAllCache,
      getPerformanceStats
    }}>
      {children}
    </UltraOptimizedContext.Provider>
  );
}

export function useUltraOptimized() {
  const context = useContext(UltraOptimizedContext);
  if (!context) {
    throw new Error('useUltraOptimized must be used within UltraOptimizedProvider');
  }
  return context;
}

// ===== HOOKS ULTRA-OPTIMISÉS =====
export function useUltraInterventions() {
  const { interventionsManager } = useUltraOptimized();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      
      await interventionsManager.loadPage(page, async () => {
        // Import dynamique pour éviter les bundles lourds
        const { interventionsApi } = await import('@/lib/api/v2');
        const result = await interventionsApi.getAll({ limit: 100 });
        return {
          data: result.data,
          total: result.pagination.total,
          hasMore: false
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [interventionsManager]);

  const data = interventionsManager.getData();

  return {
    interventions: data.items,
    totalCount: data.totalCount,
    hasMore: data.hasMore,
    loading,
    error,
    loadPage,
    reset: () => interventionsManager.reset()
  };
}

export function useUltraArtisans() {
  const { artisansManager } = useUltraOptimized();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      
      await artisansManager.loadPage(page, async (offset, limit) => {
        const { artisansApi } = await import('@/lib/api/v2');
        const result = await artisansApi.getAll({ limit, offset });
        return {
          data: result.data,
          total: result.pagination.total,
          hasMore: result.pagination.hasMore
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [artisansManager]);

  const data = artisansManager.getData();

  return {
    artisans: data.items,
    totalCount: data.totalCount,
    hasMore: data.hasMore,
    loading,
    error,
    loadPage,
    reset: () => artisansManager.reset()
  };
}
