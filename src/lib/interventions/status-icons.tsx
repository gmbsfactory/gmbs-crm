"use client"

import * as React from "react"
import {
  Info,
  FileText,
  Check,
  Play,
  UserSearch,
  XCircle,
  Hammer,
  PauseCircle,
  CheckCircle2,
  Clock,
} from "lucide-react"
import type { InterventionStatusValue } from "@/types/interventions"

/**
 * Fonction utilitaire pour obtenir l'icône d'un statut d'intervention
 * Utilisée dans FiltersBar et TableView pour garantir la cohérence
 */
export const iconForStatus = (statusKey: InterventionStatusValue | string): React.ReactNode => {
  switch (statusKey) {
    case "DEMANDE":
      return <Info className="h-3.5 w-3.5" />
    case "DEVIS_ENVOYE":
      return <FileText className="h-3.5 w-3.5" />
    case "VISITE_TECHNIQUE":
      return <UserSearch className="h-3.5 w-3.5" />
    case "REFUSE":
      return <XCircle className="h-3.5 w-3.5" />
    case "ANNULE":
      return <XCircle className="h-3.5 w-3.5" />
    case "STAND_BY":
      return <PauseCircle className="h-3.5 w-3.5" />
    case "ACCEPTE":
      return <Check className="h-3.5 w-3.5" />
    case "INTER_EN_COURS":
      return <Play className="h-3.5 w-3.5" />
    case "INTER_TERMINEE":
      return <CheckCircle2 className="h-3.5 w-3.5" />
    case "SAV":
      return <Hammer className="h-3.5 w-3.5" />
    case "ATT_ACOMPTE":
      return <Clock className="h-3.5 w-3.5" />
    default:
      return null
  }
}
