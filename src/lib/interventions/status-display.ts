import type { InterventionStatusValue } from "@/types/interventions"
import type { WorkflowConfig } from "@/types/intervention-workflow"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { iconForStatus } from "./status-icons"
import {
  PORTAL_REPORT_REVIEW_COLOR,
  PORTAL_REPORT_REVIEW_LABEL,
  isPortalReportToReview,
} from "./portal-report-status"

/**
 * Représente un statut hydraté depuis la base de données
 * (tel que retourné par mapInterventionRecord)
 */
export interface StatusFromDb {
  code: string
  label: string
  color?: string | null
}

/**
 * Options pour getStatusDisplay
 */
export interface GetStatusDisplayOptions {
  /**
   * Statut hydraté depuis la DB (priorité la plus haute)
   * Contient le label et la couleur customisés depuis la base
   */
  statusFromDb?: StatusFromDb | null
  /**
   * Configuration du workflow (priorité moyenne)
   * Permet de récupérer les labels/couleurs depuis workflow.statuses
   */
  workflow?: WorkflowConfig | null
  /**
   * Indique si un rapport envoyé depuis le portail artisans est en attente
   * (`interventions.has_portal_report`). Si vrai et que le statut est
   * ACCEPTE, INTER_EN_COURS ou SAV, l'affichage devient « À vérifier » (violet),
   * sans modifier le statut en base.
   */
  hasPortalReport?: boolean
}

/**
 * Résultat de getStatusDisplay
 */
export interface StatusDisplay {
  label: string
  color: string
  icon: React.ReactNode | null
}

/**
 * Helper centralisé pour obtenir l'affichage d'un statut (label, couleur, icône).
 * 
 * Ordre de priorité :
 * 0. hasPortalReport + statut ACCEPTE/INTER_EN_COURS/SAV → « À vérifier » (violet)
 * 1. statusFromDb (label et couleur depuis la DB) - source de vérité absolue
 * 2. workflow.statuses (label et couleur depuis la config workflow)
 * 3. INTERVENTION_STATUS (fallback legacy)
 * 
 * Ce helper garantit que FiltersBar et TableView utilisent exactement les mêmes labels.
 * 
 * @param code - Code du statut (ex: "DEMANDE", "INTER_EN_COURS", etc.)
 * @param options - Options optionnelles pour personnaliser la récupération
 * @returns Objet avec label, color (hex), et icon (ReactNode)
 */
export function getStatusDisplay(
  code: string | null | undefined,
  options: GetStatusDisplayOptions = {}
): StatusDisplay {
  if (!code) {
    // Fallback par défaut si pas de code
    const defaultStatus = INTERVENTION_STATUS.DEMANDE
    return {
      label: defaultStatus.label,
      color: defaultStatus.hexColor,
      icon: iconForStatus("DEMANDE"),
    }
  }

  const { statusFromDb, workflow, hasPortalReport } = options

  // 0. Rapport portail à vérifier : prime sur le libellé/couleur du statut
  if (isPortalReportToReview(code, hasPortalReport)) {
    return {
      label: PORTAL_REPORT_REVIEW_LABEL,
      color: PORTAL_REPORT_REVIEW_COLOR,
      icon: iconForStatus(code as InterventionStatusValue),
    }
  }

  // 1. Priorité absolue : statusFromDb (hydraté depuis la DB via mapInterventionRecord)
  if (statusFromDb && statusFromDb.code === code) {
    return {
      label: statusFromDb.label,
      color: statusFromDb.color ?? INTERVENTION_STATUS[code as keyof typeof INTERVENTION_STATUS]?.hexColor ?? "#6366F1",
      icon: iconForStatus(code as InterventionStatusValue),
    }
  }

  // 2. Priorité moyenne : workflow.statuses (config workflow customisée)
  if (workflow?.statuses) {
    const workflowStatus = workflow.statuses.find((s) => s.key === code)
    if (workflowStatus) {
      return {
        label: workflowStatus.label,
        color: workflowStatus.color,
        icon: iconForStatus(code as InterventionStatusValue),
      }
    }
  }

  // 3. Fallback : INTERVENTION_STATUS (legacy)
  const config = INTERVENTION_STATUS[code as keyof typeof INTERVENTION_STATUS]
  if (config) {
    return {
      label: config.label,
      color: config.hexColor,
      icon: iconForStatus(code as InterventionStatusValue),
    }
  }

  // 4. Dernier recours : utiliser le code comme label
  return {
    label: code,
    color: "#6366F1",
    icon: iconForStatus(code as InterventionStatusValue),
  }
}
