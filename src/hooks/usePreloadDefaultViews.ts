"use client"

import { useState, useEffect, useMemo } from "react"
import { useInterventionViews } from "@/hooks/useInterventionViews"
import { useInterventionStatusMap } from "@/hooks/useInterventionStatusMap"
import { useUserMap } from "@/hooks/useUserMap"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePreloadViews } from "@/hooks/usePreloadInterventions"
import { getHasPreloaded } from "@/lib/preload-flag"
import { getPreloadConfig } from "@/lib/device-capabilities"

/**
 * Hook pour précharger les vues par défaut en arrière-plan avec TanStack Query
 * Utilise une configuration adaptative selon les capacités de l'appareil :
 * - PC puissant : précharge jusqu'à 6 vues
 * - PC faible : précharge seulement 2 vues pour économiser le CPU
 * 
 * DÉSACTIVÉ si preloadCriticalData a déjà été exécuté pour éviter les doublons
 */
export function usePreloadDefaultViews() {
  const { views, isReady } = useInterventionViews()
  const { codeToId: statusCodeToId } = useInterventionStatusMap()
  const { nameToId: userCodeToId } = useUserMap()
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? undefined
  const [isPreloading, setIsPreloading] = useState(false)
  
  // Vérifier si le préchargement global a déjà été fait
  const hasGlobalPreloaded = getHasPreloaded()

  // Configuration adaptative selon les capacités de l'appareil
  const preloadConfig = useMemo(() => getPreloadConfig(), [])

  // Vues par défaut à précharger (exclure calendrier)
  // Limiter selon les capacités de l'appareil
  const defaultViewsToPreload = useMemo(() => {
    if (!isReady) return []
    const allDefaultViews = views.filter((view) => view.isDefault && view.id !== "calendar")
    // Limiter le nombre de vues selon les capacités (PC faible = 2, PC normal = 6)
    return allDefaultViews.slice(0, preloadConfig.maxViews)
  }, [views, isReady, preloadConfig.maxViews])

  // Précharger avec TanStack Query SEULEMENT si le préchargement global n'a pas déjà été fait
  // Le préchargement utilise idle callback pour ne pas bloquer le thread principal
  usePreloadViews(
    hasGlobalPreloaded ? [] : defaultViewsToPreload,
    {
      useLight: true, // Utiliser l'endpoint léger pour le warm-up
      statusCodeToId,
      userCodeToId,
      currentUserId,
    }
  )

  useEffect(() => {
    if (defaultViewsToPreload.length > 0) {
      setIsPreloading(true)
      const timer = setTimeout(() => {
        setIsPreloading(false)
        console.log(`[usePreloadDefaultViews] 🎉 Préchargement de ${defaultViewsToPreload.length} vues (adaptatif)`)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [defaultViewsToPreload.length])

  return {
    preloadedViews: defaultViewsToPreload.map((v) => v.id),
    isPreloading,
    // Exposer si on est en mode économie (pour affichage optionnel)
    isLowPowerMode: preloadConfig.maxViews < 6,
  }
}

