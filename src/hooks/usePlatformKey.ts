"use client"

import { useMemo, useEffect, useState } from "react"

/**
 * Hook pour détecter la plateforme (Mac vs autres) et fournir
 * les informations de raccourcis clavier appropriées.
 * 
 * Utilisé pour afficher les bons raccourcis dans l'UI (⌘ vs Ctrl)
 * et pour gérer les événements clavier de manière cohérente.
 */
export function usePlatformKey() {
  // Valeur par défaut pendant SSR : on assume non-Mac pour éviter un flash
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // Détection côté client uniquement
    if (typeof navigator !== "undefined") {
      const platform = navigator.platform?.toUpperCase() || ""
      const userAgent = navigator.userAgent?.toUpperCase() || ""
      
      // Vérifier plateforme Mac (inclut macOS et iOS)
      const detected = platform.includes("MAC") || 
                       platform.includes("IPHONE") || 
                       platform.includes("IPAD") ||
                       userAgent.includes("MACINTOSH")
      
      setIsMac(detected)
    }
  }, [])

  return useMemo(() => ({
    /** True si l'utilisateur est sur macOS/iOS */
    isMac,
    
    /** Symbole du modificateur principal (⌘ ou Ctrl) */
    modifierSymbol: isMac ? "⌘" : "Ctrl",
    
    /** Texte complet du modificateur */
    modifierLabel: isMac ? "Command" : "Ctrl",
    
    /** 
     * Vérifie si le modificateur correct est pressé dans un événement clavier 
     * @param event L'événement clavier
     */
    isModifierPressed: (event: KeyboardEvent): boolean => {
      return isMac ? event.metaKey : event.ctrlKey
    },
    
    /**
     * Génère une chaîne de raccourci lisible
     * @param key La touche (ex: "K", "F", "S")
     * @returns Chaîne formatée (ex: "⌘K" ou "Ctrl+K")
     */
    formatShortcut: (key: string): string => {
      const symbol = isMac ? "⌘" : "Ctrl+"
      return `${symbol}${key.toUpperCase()}`
    },
    
    /**
     * Génère l'aria-label pour un raccourci
     * @param action Description de l'action (ex: "Rechercher")
     * @param key La touche du raccourci
     */
    formatAriaLabel: (action: string, key: string): string => {
      const mod = isMac ? "⌘" : "Ctrl+"
      return `${action} (${mod}${key.toUpperCase()})`
    },
  }), [isMac])
}

/**
 * Type pour les props du hook usePlatformKey
 */
export type PlatformKeyInfo = ReturnType<typeof usePlatformKey>

