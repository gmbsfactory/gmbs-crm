import type { ViewFilter } from "@/types/intervention-views"
import type { InterventionQueryParams } from "@/lib/api"
import type { ArtisanGetAllParams } from "@/lib/react-query/queryKeys"

// Alias pour compatibilité
type GetAllParams = InterventionQueryParams
import type { ArtisanViewFilter } from "@/hooks/useArtisanViews"

interface FilterConversionContext {
  statusCodeToId: (code: string | string[]) => string | string[] | undefined
  userCodeToId: (code: string | string[]) => string | string[] | undefined
  currentUserId?: string
}

/**
 * Convertit les ViewFilter en filtres serveur compatibles avec l'API
 * Retourne { serverFilters, clientFilters } pour séparer les filtres serveur/client
 */
export function convertViewFiltersToServerFilters(
  filters: ViewFilter[],
  context: FilterConversionContext
): {
  serverFilters: Partial<GetAllParams>
  clientFilters: ViewFilter[]
} {
  const serverFilters: Partial<GetAllParams> = {}
  const clientFilters: ViewFilter[] = []

  for (const filter of filters) {
    // Filtre sur statusValue → statut (serveur)
    if (filter.property === "statusValue") {
      if (filter.operator === "eq" && typeof filter.value === "string") {
        const statusId = context.statusCodeToId(filter.value)
        if (statusId && typeof statusId === "string") {
          serverFilters.statut = statusId
        } else {
          clientFilters.push(filter) // Fallback côté client si conversion échoue
        }
      } else if (filter.operator === "in" && Array.isArray(filter.value)) {
        // Convertir le tableau en string[] pour statusCodeToId
        const stringValues = filter.value.filter((v): v is string => typeof v === "string")
        if (stringValues.length > 0) {
          const statusIds = context.statusCodeToId(stringValues)
          if (statusIds && Array.isArray(statusIds) && statusIds.length > 0) {
            serverFilters.statuts = statusIds
          } else {
            clientFilters.push(filter)
          }
        } else {
          clientFilters.push(filter)
        }
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtre sur attribueA → user (serveur)
    if (filter.property === "attribueA") {
      if (filter.operator === "is_empty") {
        // Filtre pour les interventions sans assignation (vue Market)
        serverFilters.user = null
      } else if (filter.operator === "eq" && typeof filter.value === "string") {
        // Ignorer le placeholder __NO_USER_USERNAME__ qui ne peut pas être converti
        if (filter.value === "__NO_USER_USERNAME__") {
          // Ne pas appliquer le filtre si l'utilisateur n'est pas connu
          // Cela évite de filtrer pour une valeur impossible
          continue
        }
        // Gérer CURRENT_USER_PLACEHOLDER (plusieurs variantes possibles)
        if (
          filter.value === "CURRENT_USER" ||
          filter.value === "__CURRENT_USER__" ||
          filter.value === "__CURRENT_USER_USERNAME__" ||
          filter.value === context.currentUserId
        ) {
          if (context.currentUserId) {
            serverFilters.user = context.currentUserId
          } else {
            clientFilters.push(filter)
          }
        } else {
          const userId = context.userCodeToId(filter.value)
          if (userId && typeof userId === "string") {
            serverFilters.user = userId
          } else {
            clientFilters.push(filter)
          }
        }
      } else if (filter.operator === "in" && Array.isArray(filter.value)) {
        // Convertir le tableau en string[] pour userCodeToId
        // Filtrer le placeholder __NO_USER_USERNAME__ qui ne peut pas être converti
        const stringValues = filter.value
          .filter((v): v is string => typeof v === "string" && v !== "__NO_USER_USERNAME__")
        if (stringValues.length > 0) {
          const userIds = stringValues
            .map((v) => {
              if (
                v === "CURRENT_USER" ||
                v === "__CURRENT_USER__" ||
                v === "__CURRENT_USER_USERNAME__" ||
                v === context.currentUserId
              ) {
                return context.currentUserId
              }
              return context.userCodeToId(v)
            })
            .filter((id): id is string => Boolean(id))
          if (userIds.length > 0) {
            // Prendre le premier ID si plusieurs, ou null si aucun
            serverFilters.user = userIds[0] || null
          } else {
            clientFilters.push(filter)
          }
        } else {
          // Si tous les valeurs étaient __NO_USER_USERNAME__, ne pas appliquer le filtre
          continue
        }
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtre sur dateIntervention → startDate/endDate (serveur)
    if (filter.property === "dateIntervention" || filter.property === "date") {
      if (filter.operator === "between") {
        if (filter.value && typeof filter.value === "object" && !Array.isArray(filter.value)) {
          const { from, to } = filter.value as { from?: string; to?: string }
          if (from) serverFilters.startDate = from
          if (to) serverFilters.endDate = to
        } else if (Array.isArray(filter.value) && filter.value.length >= 2) {
          if (filter.value[0]) serverFilters.startDate = String(filter.value[0])
          if (filter.value[1]) serverFilters.endDate = String(filter.value[1])
        } else {
          clientFilters.push(filter)
        }
      } else if (filter.operator === "gte" && filter.value) {
        serverFilters.startDate = String(filter.value)
      } else if (filter.operator === "lte" && filter.value) {
        serverFilters.endDate = String(filter.value)
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtre sur isCheck → isCheck (serveur)
    // isCheck = interventions en retard (statut VISITE_TECHNIQUE ou INTER_EN_COURS avec date_prevue <= aujourd'hui)
    if (filter.property === "isCheck") {
      if (filter.operator === "eq" && typeof filter.value === "boolean") {
        serverFilters.isCheck = filter.value
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtre sur metier → metier (serveur)
    if (filter.property === "metier" || filter.property === "metierCode") {
      if (filter.operator === "eq" && typeof filter.value === "string") {
        serverFilters.metier = filter.value
      } else if (filter.operator === "in" && Array.isArray(filter.value)) {
        const stringValues = filter.value.filter((v): v is string => typeof v === "string")
        if (stringValues.length > 0) {
          serverFilters.metiers = stringValues
        } else {
          clientFilters.push(filter)
        }
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtres non supportés côté serveur → côté client
    // Exemples : artisan, marge, etc.
    clientFilters.push(filter)
  }

  return { serverFilters, clientFilters }
}

/**
 * Convertit les ArtisanViewFilter en filtres serveur compatibles avec l'API
 * Retourne { serverFilters, clientFilters } pour séparer les filtres serveur/client
 */
export function convertArtisanFiltersToServerFilters(
  filters: ArtisanViewFilter[],
  context: { currentUserId?: string }
): {
  serverFilters: Partial<ArtisanGetAllParams>
  clientFilters: ArtisanViewFilter[]
} {
  const serverFilters: Partial<ArtisanGetAllParams> = {}
  const clientFilters: ArtisanViewFilter[] = []

  for (const filter of filters) {
    // Filtre sur gestionnaire_id → gestionnaire (serveur)
    if (filter.property === "gestionnaire_id") {
      if (filter.operator === "eq") {
        // Gérer CURRENT_USER_PLACEHOLDER ou __CURRENT_USER__
        if (
          filter.value === "CURRENT_USER" ||
          filter.value === "__CURRENT_USER__" ||
          filter.value === context.currentUserId
        ) {
          if (context.currentUserId) {
            serverFilters.gestionnaire = context.currentUserId
          } else {
            clientFilters.push(filter)
          }
        } else if (typeof filter.value === "string") {
          // UUID direct
          serverFilters.gestionnaire = filter.value
        } else {
          clientFilters.push(filter)
        }
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtre sur statut_dossier → statut_dossier (serveur)
    // Ce filtre est déjà supporté dans l'API et utilisé dans page.tsx pour les filtres UI
    // On l'ajoute ici pour permettre aux vues de l'utiliser directement dans leurs filtres
    if (filter.property === "statut_dossier") {
      if (filter.operator === "eq" && typeof filter.value === "string") {
        serverFilters.statut_dossier = filter.value
      } else {
        clientFilters.push(filter)
      }
      continue
    }

    // Filtres non supportés côté serveur → côté client
    clientFilters.push(filter)
  }

  return { serverFilters, clientFilters }
}
