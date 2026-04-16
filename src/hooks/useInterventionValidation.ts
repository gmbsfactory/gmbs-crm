// ===== HOOK DE VALIDATION DES STATUTS D'INTERVENTION =====
// Détermine les champs requis en fonction du statut sélectionné

import { useMemo } from "react"

import {
  STATUSES_REQUIRING_DATE_PREVUE,
  STATUSES_REQUIRING_DEFINITIVE_ID,
  STATUSES_REQUIRING_NOM_FACTURATION,
  STATUSES_REQUIRING_ASSIGNED_USER,
  STATUSES_REQUIRING_COUTS,
  STATUSES_REQUIRING_CONSIGNE_ARTISAN,
  STATUSES_REQUIRING_CLIENT_INFO,
  STATUSES_REQUIRING_AGENCE,
  STATUSES_REQUIRING_METIER,
  STATUSES_REQUIRING_DEVIS,
  ARTISAN_REQUIRED_STATUS_CODES,
} from "@/lib/interventions/form-constants"

export interface InterventionStatusLike {
  id: string
  code?: string | null
  label?: string | null
  color?: string | null
  sort_order?: number | null
}

export interface InterventionValidationFlags {
  requiresDefinitiveId: boolean
  requiresDatePrevue: boolean
  requiresArtisan: boolean
  requiresFacture: boolean
  requiresNomFacturation: boolean
  requiresAssignedUser: boolean
  requiresCouts: boolean
  requiresConsigneArtisan: boolean
  requiresClientInfo: boolean
  requiresAgence: boolean
  requiresMetier: boolean
  requiresDevis: boolean
}

/**
 * Détermine les champs requis en fonction du statut sélectionné.
 * Seul le `code` du statut est utilisé — pas de fallback sur les labels.
 */
export function useInterventionValidation(
  selectedStatus: InterventionStatusLike | undefined | null
): InterventionValidationFlags {
  return useMemo(() => {
    if (!selectedStatus) {
      return {
        requiresDefinitiveId: false,
        requiresDatePrevue: false,
        requiresArtisan: false,
        requiresFacture: false,
        requiresNomFacturation: false,
        requiresAssignedUser: false,
        requiresCouts: false,
        requiresConsigneArtisan: false,
        requiresClientInfo: false,
        requiresAgence: false,
        requiresMetier: false,
        requiresDevis: false,
      }
    }

    const code = (selectedStatus.code ?? "").toUpperCase()

    return {
      requiresDefinitiveId: STATUSES_REQUIRING_DEFINITIVE_ID.has(code),
      requiresDatePrevue: STATUSES_REQUIRING_DATE_PREVUE.has(code),
      requiresArtisan: (ARTISAN_REQUIRED_STATUS_CODES as readonly string[]).includes(code),
      requiresFacture: code === "INTER_TERMINEE",
      requiresNomFacturation: STATUSES_REQUIRING_NOM_FACTURATION.has(code),
      requiresAssignedUser: STATUSES_REQUIRING_ASSIGNED_USER.has(code),
      requiresCouts: STATUSES_REQUIRING_COUTS.has(code),
      requiresConsigneArtisan: STATUSES_REQUIRING_CONSIGNE_ARTISAN.has(code),
      requiresClientInfo: STATUSES_REQUIRING_CLIENT_INFO.has(code),
      requiresAgence: STATUSES_REQUIRING_AGENCE.has(code),
      requiresMetier: STATUSES_REQUIRING_METIER.has(code),
      requiresDevis: STATUSES_REQUIRING_DEVIS.has(code),
    }
  }, [selectedStatus])
}
