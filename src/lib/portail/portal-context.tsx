"use client"

import { createContext, useContext } from "react"

// Types pour le contexte du portail
export type ArtisanPortalData = {
  artisanId: string
  artisan: {
    id: string
    prenom: string | null
    nom: string | null
    raison_sociale: string | null
    email: string | null
    telephone: string | null
  } | null
  token: string
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const PortalContext = createContext<ArtisanPortalData | null>(null)

export function usePortalContext() {
  const context = useContext(PortalContext)
  if (!context) {
    throw new Error("usePortalContext must be used within PortalLayout")
  }
  return context
}
