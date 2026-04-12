import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { interventionsApi } from "@/lib/api/v2"
import { applyRecuToggle } from "@/lib/interventions/deposit-helpers"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface UseInterventionAccomptesOptions {
  interventionId: string
  formData: InterventionFormData
  interventionStatuses: Array<{ id: string; code: string; label: string }> | undefined
  handleInputChange: (field: keyof InterventionFormData, value: any) => void
}

export function useInterventionAccomptes({
  interventionId,
  formData,
  interventionStatuses,
  handleInputChange,
}: UseInterventionAccomptesOptions) {
  const getStatusCode = useCallback(
    (statusId?: string | null): string => {
      if (!statusId || !interventionStatuses) return ""
      return interventionStatuses.find((s) => s.id === statusId)?.code ?? ""
    },
    [interventionStatuses],
  )

  const findStatus = useCallback(
    (code: string) => interventionStatuses?.find((s) => s.code === code),
    [interventionStatuses],
  )

  const canEditAccomptes = useMemo(() => {
    const code = getStatusCode(formData.statut_id)
    return code === "ACCEPTE" || code === "ATT_ACOMPTE"
  }, [formData.statut_id, getStatusCode])

  // --- Transitions de statut (locales + persistées en base) ---

  const persistStatusTransition = useCallback(
    async (code: "ATT_ACOMPTE" | "ACCEPTE") => {
      const status = findStatus(code)
      if (!status) return
      await interventionsApi.update(interventionId, { statut_id: status.id })
      handleInputChange("statut_id", status.id)
    },
    [interventionId, findStatus, handleInputChange],
  )

  const transitionToAttAcompte = useCallback(async () => {
    await persistStatusTransition("ATT_ACOMPTE")
    toast.info("Aucun acompte reçu : Statut passé à 'Attente acompte'")
  }, [persistStatusTransition])

  const transitionToAccepte = useCallback(async () => {
    await persistStatusTransition("ACCEPTE")
    toast.success("Acompte reçu : Statut passé à 'Accepté'")
  }, [persistStatusTransition])

  // --- Handlers montant (onBlur) ---

  const handleAccompteSSTChange = useCallback(
    (value: string) => {
      handleInputChange("accompteSST", value)
    },
    [handleInputChange],
  )

  const handleAccompteClientChange = useCallback(
    (value: string) => {
      handleInputChange("accompteClient", value)
    },
    [handleInputChange],
  )

  const handleAccompteSSTBlur = useCallback(async () => {
    const amount = parseFloat(formData.accompteSST) || 0
    if (amount <= 0) return

    try {
      await interventionsApi.upsertPayment(interventionId, {
        payment_type: "acompte_sst",
        amount,
        currency: "EUR",
      })
    } catch (error) {
      console.error("[useInterventionAccomptes] Erreur acompte SST:", error)
      toast.error("Erreur lors de la sauvegarde de l'acompte SST")
    }
  }, [formData.accompteSST, interventionId])

  const handleAccompteClientBlur = useCallback(async () => {
    const amount = parseFloat(formData.accompteClient) || 0
    if (amount <= 0) return

    try {
      // Persister le statut EN PREMIER (même raison que SST)
      if (getStatusCode(formData.statut_id) === "ACCEPTE") {
        await transitionToAttAcompte()
      }

      await interventionsApi.upsertPayment(interventionId, {
        payment_type: "acompte_client",
        amount,
        currency: "EUR",
      })
    } catch (error) {
      console.error("[useInterventionAccomptes] Erreur acompte client:", error)
      toast.error("Erreur lors de la sauvegarde de l'acompte client")
    }
  }, [formData.accompteClient, formData.statut_id, interventionId, getStatusCode, transitionToAttAcompte])

  // --- Handlers checkbox Reçu ---

  const handleAccompteSSTRecuChange = useCallback(
    async (checked: boolean) => {
      const { recu, date } = applyRecuToggle(checked, formData.dateAccompteSSTRecu)

      try {
        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_sst",
          is_received: recu,
          payment_date: date || null,
        })

        handleInputChange("accompteSSTRecu", recu)
        if (date !== formData.dateAccompteSSTRecu) {
          handleInputChange("dateAccompteSSTRecu", date)
        }
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur reçu SST:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [interventionId, formData.dateAccompteSSTRecu, handleInputChange],
  )

  const handleAccompteClientRecuChange = useCallback(
    async (checked: boolean) => {
      const { recu, date } = applyRecuToggle(checked, formData.dateAccompteClientRecu)

      try {
        // Transition statut basée sur l'état EFFECTIF (auto-fill déjà appliqué).
        if (recu && date) {
          await transitionToAccepte()
        } else if (!recu && getStatusCode(formData.statut_id) === "ACCEPTE") {
          await transitionToAttAcompte()
        }

        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_client",
          is_received: recu,
          payment_date: date || null,
        })

        handleInputChange("accompteClientRecu", recu)
        if (date !== formData.dateAccompteClientRecu) {
          handleInputChange("dateAccompteClientRecu", date)
        }
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur reçu client:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [
      interventionId,
      formData.dateAccompteClientRecu,
      formData.statut_id,
      handleInputChange,
      getStatusCode,
      transitionToAccepte,
      transitionToAttAcompte,
    ],
  )

  // --- Handlers date ---

  const handleDateAccompteSSTRecuChange = useCallback(
    async (date: string) => {
      try {
        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_sst",
          is_received: formData.accompteSSTRecu,
          payment_date: date || null,
        })

        handleInputChange("dateAccompteSSTRecu", date)
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur date SST:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [interventionId, formData.accompteSSTRecu, handleInputChange],
  )

  const handleDateAccompteClientRecuChange = useCallback(
    async (date: string) => {
      try {
        if (formData.accompteClientRecu && date) {
          await transitionToAccepte()
        }

        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_client",
          is_received: formData.accompteClientRecu,
          payment_date: date || null,
        })

        handleInputChange("dateAccompteClientRecu", date)
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur date client:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [interventionId, formData.accompteClientRecu, handleInputChange, transitionToAccepte],
  )

  return {
    canEditAccomptes,
    handleAccompteSSTChange,
    handleAccompteClientChange,
    handleAccompteSSTBlur,
    handleAccompteClientBlur,
    handleAccompteSSTRecuChange,
    handleAccompteClientRecuChange,
    handleDateAccompteSSTRecuChange,
    handleDateAccompteClientRecuChange,
  }
}
