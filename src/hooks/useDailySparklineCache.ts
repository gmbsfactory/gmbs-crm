"use client"

import { useRef, useCallback } from "react"
import type { AdminDashboardStats } from "@/lib/api/v2"

interface CachedSparklineData {
  data: AdminDashboardStats["sparklines"]
  timestamp: number
  periodStart: string
  periodEnd: string
}

/**
 * Hook pour gérer le cache des données daily sparklines
 * 
 * Caractéristiques:
 * - Garde maximum 3 mois de données
 * - Écrase automatiquement les entrées les plus anciennes (comportement stack)
 * - Clé de cache basée sur la période (startDate-endDate)
 */
export function useDailySparklineCache() {
  // Cache en mémoire avec Map
  // Clé: "startDate-endDate" (ex: "2025-01-01-2025-01-31")
  // Valeur: { data, timestamp, periodStart, periodEnd }
  const cacheRef = useRef<Map<string, CachedSparklineData>>(new Map())
  
  // Durée maximale du cache: 3 mois (environ 90 jours)
  const MAX_CACHE_DAYS = 90
  const MAX_CACHE_MS = MAX_CACHE_DAYS * 24 * 60 * 60 * 1000

  /**
   * Génère une clé de cache à partir des dates de période
   */
  const getCacheKey = useCallback((startDate: string, endDate: string): string => {
    return `${startDate}-${endDate}`
  }, [])

  /**
   * Vérifie si une période est dans le cache et si elle est encore valide
   */
  const get = useCallback((startDate: string, endDate: string): AdminDashboardStats["sparklines"] | null => {
    const key = getCacheKey(startDate, endDate)
    const cached = cacheRef.current.get(key)
    
    if (!cached) {
      return null
    }

    // Vérifier si le cache est expiré (plus de 3 mois)
    const now = Date.now()
    const age = now - cached.timestamp
    
    if (age > MAX_CACHE_MS) {
      // Cache expiré, le supprimer
      cacheRef.current.delete(key)
      return null
    }

    return cached.data
  }, [getCacheKey])

  /**
   * Ajoute ou met à jour une entrée dans le cache
   * Supprime automatiquement les entrées les plus anciennes si on dépasse 3 mois
   */
  const set = useCallback((
    startDate: string,
    endDate: string,
    data: AdminDashboardStats["sparklines"]
  ): void => {
    const key = getCacheKey(startDate, endDate)
    const now = Date.now()

    // Créer la nouvelle entrée
    const newEntry: CachedSparklineData = {
      data,
      timestamp: now,
      periodStart: startDate,
      periodEnd: endDate,
    }

    // Ajouter au cache
    cacheRef.current.set(key, newEntry)

    // Nettoyer les entrées expirées et les plus anciennes si nécessaire
    cleanupCache()
  }, [getCacheKey])

  /**
   * Nettoie le cache:
   * 1. Supprime les entrées expirées (> 3 mois)
   * 2. Si on dépasse encore 3 mois de données, supprime les plus anciennes (stack behavior)
   */
  const cleanupCache = useCallback((): void => {
    const now = Date.now()
    const entries: Array<{ key: string; timestamp: number }> = []

    // Collecter toutes les entrées avec leur timestamp
    for (const [key, value] of cacheRef.current.entries()) {
      const age = now - value.timestamp
      
      // Supprimer les entrées expirées
      if (age > MAX_CACHE_MS) {
        cacheRef.current.delete(key)
      } else {
        entries.push({ key, timestamp: value.timestamp })
      }
    }

    // Si on a encore trop d'entrées, supprimer les plus anciennes
    // On garde au maximum 3 mois de données
    if (entries.length > 0) {
      // Trier par timestamp (plus ancien en premier)
      entries.sort((a, b) => a.timestamp - b.timestamp)

      // Calculer la date limite (3 mois avant maintenant)
      const limitTimestamp = now - MAX_CACHE_MS

      // Supprimer toutes les entrées plus anciennes que la limite
      for (const entry of entries) {
        if (entry.timestamp < limitTimestamp) {
          cacheRef.current.delete(entry.key)
        } else {
          // Les entrées suivantes sont plus récentes, on peut arrêter
          break
        }
      }
    }
  }, [])

  /**
   * Vide complètement le cache
   */
  const clear = useCallback((): void => {
    cacheRef.current.clear()
  }, [])

  /**
   * Retourne le nombre d'entrées dans le cache
   */
  const size = useCallback((): number => {
    return cacheRef.current.size
  }, [])

  return {
    get,
    set,
    clear,
    size,
  }
}

