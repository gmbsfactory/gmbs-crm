"use client"

import { useState, useEffect, useCallback } from 'react'
import { detectDeviceCapabilities } from '@/lib/device-capabilities'

/**
 * Hook pour gérer le mode économie d'énergie
 * - Détecte automatiquement les appareils peu puissants
 * - Respecte prefers-reduced-motion
 * - Permet un basculement manuel via localStorage
 * - Applique la classe 'low-power-mode' sur <html> pour le CSS
 */
export function useLowPowerMode() {
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    
    // Vérifier localStorage d'abord (préférence utilisateur)
    const stored = localStorage.getItem('lowPowerMode')
    if (stored !== null) {
      return stored === 'true'
    }
    
    // Sinon, détecter automatiquement
    const { isLowEnd } = detectDeviceCapabilities()
    return isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  // Appliquer la classe CSS sur <html>
  useEffect(() => {
    if (typeof document === 'undefined') return
    
    if (isEnabled) {
      document.documentElement.classList.add('low-power-mode')
    } else {
      document.documentElement.classList.remove('low-power-mode')
    }
  }, [isEnabled])

  // Écouter les changements de prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Ne changer que si pas de préférence utilisateur stockée
      const stored = localStorage.getItem('lowPowerMode')
      if (stored === null) {
        setIsEnabled(e.matches)
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Fonction pour basculer manuellement
  const toggle = useCallback(() => {
    setIsEnabled(prev => {
      const newValue = !prev
      localStorage.setItem('lowPowerMode', String(newValue))
      return newValue
    })
  }, [])

  // Fonction pour activer/désactiver explicitement
  const setEnabled = useCallback((value: boolean) => {
    localStorage.setItem('lowPowerMode', String(value))
    setIsEnabled(value)
  }, [])

  // Fonction pour réinitialiser (supprimer la préférence utilisateur)
  const reset = useCallback(() => {
    localStorage.removeItem('lowPowerMode')
    const { isLowEnd } = detectDeviceCapabilities()
    setIsEnabled(isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  return {
    isEnabled,
    toggle,
    setEnabled,
    reset,
  }
}

/**
 * Hook simplifié pour juste savoir si le mode low-power est actif
 * (sans les fonctions de contrôle)
 */
export function useIsLowPowerMode(): boolean {
  const [isLowPower, setIsLowPower] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Vérifier localStorage
    const stored = localStorage.getItem('lowPowerMode')
    if (stored !== null) {
      setIsLowPower(stored === 'true')
      return
    }

    // Détecter automatiquement
    const { isLowEnd } = detectDeviceCapabilities()
    setIsLowPower(isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  return isLowPower
}


