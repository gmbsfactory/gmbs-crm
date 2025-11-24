import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from './useDebounce';

interface PaginationData {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

interface UseInfiniteScrollOptions<T> {
  endpoint: string;
  limit?: number;
  dependencies?: any[];
  debounceDelay?: number;
  cacheTime?: number; // Cache léger en ms
}

interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  hasMore: boolean;
}

export function useInfiniteScroll<T>({
  endpoint,
  limit = 20,
  dependencies = [],
  debounceDelay = 300,
  cacheTime = 30000 // 30 secondes par défaut
}: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // Cache léger pour éviter les requêtes redondantes
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    const cacheKey = `${endpoint}?limit=${limit}&offset=${offset}`;
    const cached = cacheRef.current.get(cacheKey);
    
    // Utiliser le cache si disponible et récent
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      setItems(prev => [...prev, ...cached.data]);
      setHasMore(cached.hasMore);
      setOffset(prev => prev + limit);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const url = `${endpoint}?limit=${limit}&offset=${offset}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const newData = result.data || result;
      const newHasMore = result.pagination?.hasMore ?? (newData.length === limit);
      
      // Mettre en cache
      cacheRef.current.set(cacheKey, {
        data: newData,
        timestamp: Date.now(),
        hasMore: newHasMore
      });
      
      setItems(prev => [...prev, ...newData]);
      setHasMore(newHasMore);
      setOffset(prev => prev + limit);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [endpoint, limit, offset, hasMore, cacheTime]);

  // Debounce pour éviter les appels multiples
  const debouncedLoadMore = useDebounce(loadMore, debounceDelay);

  // Reset quand les dépendances changent
  // Note: dependencies est un array dynamique passé en paramètre, donc ESLint ne peut pas le vérifier statiquement
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    cacheRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Nettoyer le cache périodiquement
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of Array.from(cacheRef.current.entries())) {
        if (now - entry.timestamp > cacheTime) {
          cacheRef.current.delete(key);
        }
      }
    }, cacheTime);

    return () => clearInterval(interval);
  }, [cacheTime]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore: debouncedLoadMore,
    reset: () => {
      setItems([]);
      setOffset(0);
      setHasMore(true);
      setError(null);
      cacheRef.current.clear();
    }
  };
}
