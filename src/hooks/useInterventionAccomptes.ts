import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { interventionsApi } from "@/lib/api/v2"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface InterventionPayment {
  payment_type: string
  is_received?: boolean
  payment_date?: string | null
}

interface UseInterventionAccomptesOptions {
  interventionId: string
  formData: InterventionFormData
  interventionStatuses: Array<{ id: string; code: string; label: string }> | undefined
  sstPayment: InterventionPayment | undefined
  clientPayment: InterventionPayment | undefined
  handleInputChange: (field: keyof InterventionFormData, value: any) => void
}

export function useInterventionAccomptes({
  interventionId,
  formData,
  interventionStatuses,
  sstPayment,
  clientPayment,
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
      // Persister le statut EN PREMIER pour que le Realtime (déclenché par upsertPayment)
      // trouve déjà le bon statut en base et ne l'écrase pas
      if (getStatusCode(formData.statut_id) === "ACCEPTE") {
        await transitionToAttAcompte()
      }

      await interventionsApi.upsertPayment(interventionId, {
        payment_type: "acompte_sst",
        amount,
        currency: "EUR",
      })
    } catch (error) {
      console.error("[useInterventionAccomptes] Erreur acompte SST:", error)
      toast.error("Erreur lors de la sauvegarde de l'acompte SST")
    }
  }, [formData.accompteSST, formData.statut_id, interventionId, getStatusCode, transitionToAttAcompte])

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
      try {
        if (checked && formData.dateAccompteSSTRecu) {
          await transitionToAccepte()
        } else if (!checked) {
          const hasClientReceived = clientPayment?.is_received && clientPayment?.payment_date
          if (!hasClientReceived && getStatusCode(formData.statut_id) === "ACCEPTE") {
            await transitionToAttAcompte()
          }
        }

        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_sst",
          is_received: checked,
          payment_date: checked ? (formData.dateAccompteSSTRecu || null) : null,
        })

        handleInputChange("accompteSSTRecu", checked)
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur reçu SST:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [
      interventionId,
      formData.dateAccompteSSTRecu,
      formData.statut_id,
      clientPayment,
      handleInputChange,
      getStatusCode,
      transitionToAccepte,
      transitionToAttAcompte,
    ],
  )

  const handleAccompteClientRecuChange = useCallback(
    async (checked: boolean) => {
      try {
        if (checked && formData.dateAccompteClientRecu) {
          await transitionToAccepte()
        } else if (!checked) {
          const hasSSTReceived = sstPayment?.is_received && sstPayment?.payment_date
          if (!hasSSTReceived && getStatusCode(formData.statut_id) === "ACCEPTE") {
            await transitionToAttAcompte()
          }
        }

        await interventionsApi.upsertPayment(interventionId, {
          payment_type: "acompte_client",
          is_received: checked,
          payment_date: checked ? (formData.dateAccompteClientRecu || null) : null,
        })

        handleInputChange("accompteClientRecu", checked)
      } catch (error) {
        console.error("[useInterventionAccomptes] Erreur reçu client:", error)
        toast.error("Erreur lors de la sauvegarde")
      }
    },
    [
      interventionId,
      formData.dateAccompteClientRecu,
      formData.statut_id,
      sstPayment,
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
        if (formData.accompteSSTRecu && date) {
          await transitionToAccepte()
        }

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
    [interventionId, formData.accompteSSTRecu, handleInputChange, transitionToAccepte],
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
