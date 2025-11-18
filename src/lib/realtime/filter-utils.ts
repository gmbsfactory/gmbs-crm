/**
 * Utilitaires pour le filtrage des interventions dans le contexte Realtime
 * Permet de déterminer si une intervention correspond aux filtres d'une vue
 */

import type { Intervention } from '@/lib/api/v2/common/types'
import type { GetAllParams } from '@/lib/supabase-api-v2'

/**
 * Vérifie si une intervention correspond aux filtres d'une vue
 * 
 * @param intervention - Intervention à vérifier
 * @param filters - Paramètres de filtrage de la vue (GetAllParams)
 * @returns true si l'intervention correspond aux filtres
 */
export function matchesFilters(
  intervention: Intervention,
  filters: GetAllParams | undefined
): boolean {
  if (!filters) return true
  
  // Filtrer les interventions inactives
  if (!intervention.is_active) return false
  
  // Filtre par statut
  // US2, US4-6: Gère les filtres par statut pour toutes les vues (Demandé, Devis envoyé, Accepté, En cours, Terminé, etc.)
  if (filters.statut !== undefined) {
    if (Array.isArray(filters.statut)) {
      if (!filters.statut.includes(intervention.statut_id ?? '')) {
        return false
      }
    } else if (filters.statut !== null && intervention.statut_id !== filters.statut) {
      return false
    }
  }
  
  // Filtre par utilisateur assigné
  // US1: Gère le filtre Market (user === null) et Mes demandes (user === user_id)
  if (filters.user !== undefined) {
    if (filters.user === null) {
      // Market: assigned_user_id doit être null
      if (intervention.assigned_user_id !== null) return false
    } else {
      // Mes demandes: assigned_user_id doit correspondre
      if (Array.isArray(filters.user)) {
        if (!filters.user.includes(intervention.assigned_user_id ?? '')) {
          return false
        }
      } else if (intervention.assigned_user_id !== filters.user) {
        return false
      }
    }
  }
  
  // Filtre par artisan
  if (filters.artisan !== undefined && filters.artisan !== null) {
    if (Array.isArray(filters.artisan)) {
      if (!filters.artisan.includes(intervention.artisan_id ?? '')) {
        return false
      }
    } else if (intervention.artisan_id !== filters.artisan) {
      return false
    }
  }
  
  // Filtre par agence
  if (filters.agence !== undefined && filters.agence !== null) {
    if (Array.isArray(filters.agence)) {
      if (!filters.agence.includes(intervention.agence_id ?? '')) {
        return false
      }
    } else if (intervention.agence_id !== filters.agence) {
      return false
    }
  }
  
  // Filtre par métier
  if (filters.metier !== undefined && filters.metier !== null) {
    if (Array.isArray(filters.metier)) {
      if (!filters.metier.includes(intervention.metier_id ?? '')) {
        return false
      }
    } else if (intervention.metier_id !== filters.metier) {
      return false
    }
  }
  
  // Filtre par date de début
  if (filters.startDate && intervention.date < filters.startDate) {
    return false
  }
  
  // Filtre par date de fin
  if (filters.endDate && intervention.date > filters.endDate) {
    return false
  }
  
  // Filtre par recherche textuelle (si applicable)
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    const searchableFields = [
      intervention.contexte_intervention,
      intervention.adresse,
      intervention.ville,
      intervention.commentaire_agent,
    ].filter(Boolean).join(' ').toLowerCase()
    
    if (!searchableFields.includes(searchTerm)) {
      return false
    }
  }
  
  return true
}

/**
 * Extrait les paramètres de filtrage depuis une query key TanStack Query
 * 
 * @param queryKey - Query key TanStack Query (ex: ['interventions', 'list', params])
 * @returns Paramètres de filtrage ou undefined
 */
export function extractFiltersFromQueryKey(queryKey: unknown[]): GetAllParams | undefined {
  // Vérifier que queryKey existe et est un tableau
  if (!queryKey || !Array.isArray(queryKey)) {
    return undefined
  }
  
  // Les query keys ont la structure: ['interventions', 'list' | 'light', params]
  if (queryKey.length >= 3 && typeof queryKey[2] === 'object' && queryKey[2] !== null) {
    return queryKey[2] as GetAllParams
  }
  return undefined
}

