/**
 * Utilitaires pour le filtrage des interventions dans le contexte Realtime
 * Permet de déterminer si une intervention correspond aux filtres d'une vue
 */

import type { Intervention, InterventionQueryParams } from '@/lib/api'

// Alias pour compatibilité
type GetAllParams = InterventionQueryParams

// T093: Logs de debug pour le développement (à désactiver en production)
const DEBUG_FILTERS = process.env.NODE_ENV === 'development'

/**
 * Vérifie si une intervention correspond aux filtres d'une vue
 * 
 * @param intervention - Intervention à vérifier
 * @param filters - Paramètres de filtrage de la vue (GetAllParams)
 * @returns true si l'intervention correspond aux filtres
 * 
 * IMPORTANT: Cette fonction garantit que seules les interventions correspondant EXACTEMENT
 * aux filtres de la vue sont considérées comme correspondantes. Tous les filtres doivent
 * être satisfaits pour qu'une intervention soit incluse dans la vue.
 * 
 * CRITIQUE: Si filters est undefined, retourne false pour éviter d'ajouter des interventions
 * à des queries sans filtres définis (sécurité par défaut). Les queries sans filtres doivent
 * être gérées explicitement dans les handlers (handleInsert, handleUpdate).
 * 
 * T092: Optimisé pour les grandes listes d'interventions avec vérifications court-circuit
 */
export function matchesFilters(
  intervention: Intervention,
  filters: GetAllParams | undefined
): boolean {
  // CRITIQUE: Si aucun filtre n'est défini, ne pas accepter l'intervention par défaut
  // Cela évite d'ajouter des interventions à des queries sans filtres spécifiques
  // Les handlers (handleInsert, handleUpdate) gèrent explicitement le cas où filters est undefined
  if (!filters) {
    if (DEBUG_FILTERS) {
    }
    return false
  }
  
  // Filtrer les interventions inactives (toujours exclure les interventions supprimées)
  // T092: Vérification court-circuit pour optimiser les performances
  if (!intervention.is_active) {
    if (DEBUG_FILTERS) {
    }
    return false
  }
  
  // Filtre par statut
  // US2, US4-6: Gère les filtres par statut pour toutes les vues (Demandé, Devis envoyé, Accepté, En cours, Terminé, etc.)
  if (filters.statut !== undefined) {
    if (Array.isArray(filters.statut)) {
      // Filtre multiple : l'intervention doit avoir un statut dans la liste
      if (!filters.statut.includes(intervention.statut_id ?? '')) {
        return false
      }
    } else if (filters.statut !== null) {
      // Filtre unique : l'intervention doit avoir exactement ce statut
      if (intervention.statut_id !== filters.statut) {
        return false
      }
    }
    // Si filters.statut === null, aucun filtre de statut n'est appliqué
  }
  
  // Filtre par utilisateur assigné
  // US1: Gère le filtre Market (user === null) et Mes demandes (user === user_id)
  // CRITIQUE: Ce filtre est essentiel pour éviter qu'une intervention assignée à un utilisateur
  // apparaisse dans la vue d'un autre utilisateur
  if (filters.user !== undefined) {
    if (filters.user === null) {
      // Market: assigned_user_id doit être null (pas d'assignation)
      if (intervention.assigned_user_id !== null) {
        return false
      }
    } else {
      // Vue avec filtre utilisateur : assigned_user_id doit correspondre exactement
      if (Array.isArray(filters.user)) {
        // Filtre multiple : l'intervention doit être assignée à un des utilisateurs de la liste
        if (!filters.user.includes(intervention.assigned_user_id ?? '')) {
          return false
        }
      } else {
        // Filtre unique : l'intervention doit être assignée exactement à cet utilisateur
        // CRITIQUE: Comparaison stricte pour éviter les problèmes de type
        const interventionUserId = intervention.assigned_user_id ?? null
        const filterUserId = filters.user
        
        if (interventionUserId !== filterUserId) {
          return false
        }
      }
    }
  }
  
  // Filtre par artisan
  if (filters.artisan !== undefined && filters.artisan !== null) {
    const interventionArtisans = intervention.artisans || []
    if (Array.isArray(filters.artisan)) {
      if (!filters.artisan.some(artisanId => interventionArtisans.includes(artisanId))) {
        return false
      }
    } else if (!interventionArtisans.includes(filters.artisan)) {
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
  
  // Tous les filtres sont satisfaits
  return true
}

/**
 * Extrait les paramètres de filtrage depuis une query key TanStack Query
 * 
 * @param queryKey - Query key TanStack Query (ex: ['interventions', 'list', params] ou ['interventions', 'list', params, viewId])
 * @returns Paramètres de filtrage ou undefined
 * 
 * IMPORTANT: Les query keys peuvent avoir deux structures :
 * - ['interventions', 'list' | 'light', params]
 * - ['interventions', 'list' | 'light', params, viewId]
 * 
 * Dans les deux cas, les params sont toujours à l'index 2.
 */
export function extractFiltersFromQueryKey(queryKey: unknown[]): GetAllParams | undefined {
  // Vérifier que queryKey existe et est un tableau
  if (!queryKey || !Array.isArray(queryKey)) {
    return undefined
  }
  
  // Les query keys ont la structure: ['interventions', 'list' | 'light', params, viewId?]
  // Les params sont toujours à l'index 2, même si viewId est présent à l'index 3
  if (queryKey.length >= 3 && typeof queryKey[2] === 'object' && queryKey[2] !== null) {
    const params = queryKey[2] as GetAllParams
    
    // Log seulement si la structure semble incorrecte (params vide alors qu'on s'attend à des filtres)
    // Les logs détaillés sont gérés dans cache-sync.ts pour éviter le bruit
    if (Object.keys(params).length === 0 && queryKey.length > 3) {
      console.warn(`[filter-utils] extractFiltersFromQueryKey - Params vides pour query key avec viewId:`, queryKey.slice(0, 4))
    }
    
    return params
  }
  
  // Log seulement pour les query keys vraiment invalides (structure incorrecte)
  if (queryKey.length > 0 && queryKey[0] === 'interventions') {
    console.warn(`[filter-utils] extractFiltersFromQueryKey - Query key invalide (structure incorrecte):`, queryKey)
  }
  
  return undefined
}

