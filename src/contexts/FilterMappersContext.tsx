"use client"

import React, { createContext, useContext, ReactNode } from "react"
import { useInterventionStatusMap } from "@/hooks/useInterventionStatusMap"
import { useUserMap } from "@/hooks/useUserMap"
import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Type pour les fonctions de conversion de filtres
 * Utilisé pour convertir les codes (ex: "DEMANDE") en IDs (ex: "uuid-123")
 */
interface FilterMappersContextType {
  /**
   * Convertit un code de statut (ex: "DEMANDE") en ID de statut (ex: "uuid-123")
   * Supporte les valeurs uniques et les tableaux
   */
  statusCodeToId: (code: string | string[]) => string | string[] | undefined

  /**
   * Convertit un code utilisateur (ex: "john.doe") en ID utilisateur (ex: "uuid-456")
   * Supporte les valeurs uniques et les tableaux
   */
  userCodeToId: (code: string | string[]) => string | string[] | undefined

  /**
   * ID de l'utilisateur actuellement connecté
   */
  currentUserId: string | undefined

  /**
   * Indicateur de chargement : true si les mappers sont en cours de chargement
   */
  isLoading: boolean
}

const FilterMappersContext = createContext<FilterMappersContextType | null>(null)

/**
 * Provider qui centralise les fonctions de mapping pour les filtres
 *
 * Ce Context permet à tous les composants descendants d'accéder aux fonctions
 * de conversion de filtres sans avoir à les passer via props.
 *
 * Utilisé notamment pour :
 * - Conversion des filtres de vue en paramètres API
 * - Calcul des compteurs de filtres
 * - Affichage cohérent des données
 *
 * @example
 * ```tsx
 * <FilterMappersProvider>
 *   <InterventionsPage />
 * </FilterMappersProvider>
 * ```
 */
export function FilterMappersProvider({ children }: { children: ReactNode }) {
  const { data: currentUserData, isLoading: isLoadingUser } = useCurrentUser()
  const { statusCodeToId, isLoading: isLoadingStatuses } = useInterventionStatusMap()
  const { userCodeToId, isLoading: isLoadingUsers } = useUserMap()

  // Le Context est considéré comme chargé quand tous les mappers sont prêts
  const isLoading = isLoadingUser || isLoadingStatuses || isLoadingUsers

  return (
    <FilterMappersContext.Provider
      value={{
        statusCodeToId,
        userCodeToId,
        currentUserId: currentUserData?.id,
        isLoading,
      }}
    >
      {children}
    </FilterMappersContext.Provider>
  )
}

/**
 * Hook pour accéder aux fonctions de mapping de filtres
 *
 * Ce hook doit être utilisé dans un composant descendant de FilterMappersProvider
 *
 * @throws {Error} Si utilisé en dehors de FilterMappersProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { statusCodeToId, userCodeToId, currentUserId } = useFilterMappers()
 *
 *   const statusId = statusCodeToId("DEMANDE")
 *   // statusId = "uuid-123"
 * }
 * ```
 */
export function useFilterMappers(): FilterMappersContextType {
  const context = useContext(FilterMappersContext)

  if (!context) {
    throw new Error("useFilterMappers must be used within a FilterMappersProvider")
  }

  return context
}
