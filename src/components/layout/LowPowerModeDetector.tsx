"use client"

import { useEffect } from 'react'
import { detectDeviceCapabilities } from '@/lib/device-capabilities'

/**
 * Composant invisible qui gère les changements dynamiques du mode économie d'énergie.
 * 
 * Note : La détection initiale est faite dans le script inline du layout
 * pour éviter le flash d'animations avant l'hydratation.
 * Ce composant ne fait que :
 * 1. Écouter les changements de prefers-reduced-motion
 * 2. Synchroniser les changements entre onglets (localStorage)
 * 
 * À placer une fois dans le layout principal.
 */
export function LowPowerModeDetector() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const applyLowPowerClass = () => {
      // Vérifier localStorage (préférence utilisateur)
      let isLowPower: boolean
      try {
        const stored = localStorage.getItem('lowPowerMode')
        if (stored !== null) {
          isLowPower = stored === 'true'
        } else {
          // Détecter automatiquement
          const { isLowEnd } = detectDeviceCapabilities()
          isLowPower = isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        }
      } catch {
        // localStorage inaccessible
        isLowPower = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      }

      if (isLowPower) {
        document.documentElement.classList.add('low-power-mode')
      } else {
        document.documentElement.classList.remove('low-power-mode')
      }
    }

    // Note: Pas d'appel initial - déjà fait par le script inline du layout

    // Écouter les changements de prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMediaChange = () => {
      // Ne re-détecter que si pas de préférence utilisateur
      try {
        if (localStorage.getItem('lowPowerMode') === null) {
          applyLowPowerClass()
        }
      } catch {
        applyLowPowerClass()
      }
    }

    mediaQuery.addEventListener('change', handleMediaChange)

    // Écouter les changements de localStorage (pour sync entre onglets)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lowPowerMode') {
        applyLowPowerClass()
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Composant invisible
  return null
}

