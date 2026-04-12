"use client"

import { useCallback, useEffect, useState } from "react"
import { documentsApi } from "@/lib/api/v2/documentsApi"

/**
 * Vérifie l'existence de documents obligatoires (facture GMBS et devis) pour une intervention.
 */
export function useInterventionDocumentChecks(interventionId: string) {
  const [hasFactureGMBS, setHasFactureGMBS] = useState(false)
  const [hasDevis, setHasDevis] = useState(false)

  const checkFactureGMBS = useCallback(async () => {
    if (!interventionId) return
    try {
      const docs = await documentsApi.getAll({
        entity_id: interventionId,
        entity_type: "intervention",
        kind: "facturesGMBS"
      })
      setHasFactureGMBS((docs?.data?.length ?? 0) > 0)
    } catch (error) {
      console.error("[useInterventionDocumentChecks] Erreur checkFactureGMBS:", error)
    }
  }, [interventionId])

  const checkDevis = useCallback(async () => {
    if (!interventionId) return
    try {
      const docs = await documentsApi.getAll({
        entity_id: interventionId,
        entity_type: "intervention",
        kind: "devis"
      })
      setHasDevis((docs?.data?.length ?? 0) > 0)
    } catch (error) {
      console.error("[useInterventionDocumentChecks] Erreur checkDevis:", error)
    }
  }, [interventionId])

  useEffect(() => {
    void checkFactureGMBS()
    void checkDevis()
  }, [checkFactureGMBS, checkDevis])

  return {
    hasFactureGMBS,
    hasDevis,
    refreshFactureGMBS: checkFactureGMBS,
    refreshDevis: checkDevis,
  }
}
