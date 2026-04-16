import { useCallback, useMemo } from "react"
import { applyRecuToggle } from "@/lib/interventions/deposit-helpers"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface UseInterventionAccomptesOptions {
  formData: InterventionFormData
  interventionStatuses: Array<{ id: string; code: string; label: string }> | undefined
  handleInputChange: (field: keyof InterventionFormData, value: any) => void
}

// Local-only : aucune écriture DB ici. La persistence des acomptes et de la
// transition de statut associée se fait au submit via useInterventionSubmit.
// Cela évite les bumps updated_at qui déclenchent useInterventionRealtime et
// écrasent les saisies en cours dans le formulaire.
export function useInterventionAccomptes({
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

  const findStatusId = useCallback(
    (code: string): string | undefined =>
      interventionStatuses?.find((s) => s.code === code)?.id,
    [interventionStatuses],
  )

  const canEditAccomptes = useMemo(() => {
    const code = getStatusCode(formData.statut_id)
    return code === "ACCEPTE" || code === "ATT_ACOMPTE"
  }, [formData.statut_id, getStatusCode])

  // --- Montants (local) ---

  const handleAccompteSSTChange = useCallback(
    (value: string) => handleInputChange("accompteSST", value),
    [handleInputChange],
  )

  const handleAccompteClientChange = useCallback(
    (value: string) => handleInputChange("accompteClient", value),
    [handleInputChange],
  )

  // --- Checkbox SST (Envoyé) : auto-fill date du jour ---

  const handleAccompteSSTRecuChange = useCallback(
    (checked: boolean) => {
      const { recu, date } = applyRecuToggle(checked, formData.dateAccompteSSTRecu)
      handleInputChange("accompteSSTRecu", recu)
      if (date !== formData.dateAccompteSSTRecu) {
        handleInputChange("dateAccompteSSTRecu", date)
      }
    },
    [formData.dateAccompteSSTRecu, handleInputChange],
  )

  // --- Checkbox Client (Reçu) : pas d'auto-fill date, transition de statut LOCALE ---

  const handleAccompteClientRecuChange = useCallback(
    (checked: boolean) => {
      handleInputChange("accompteClientRecu", checked)

      if (checked) {
        const accepteId = findStatusId("ACCEPTE")
        if (accepteId) handleInputChange("statut_id", accepteId)
      } else if (getStatusCode(formData.statut_id) === "ACCEPTE") {
        const attId = findStatusId("ATT_ACOMPTE")
        if (attId) handleInputChange("statut_id", attId)
      }
    },
    [formData.statut_id, getStatusCode, findStatusId, handleInputChange],
  )

  // --- Saisie manuelle des dates (local) ---

  const handleDateAccompteSSTRecuChange = useCallback(
    (date: string) => handleInputChange("dateAccompteSSTRecu", date),
    [handleInputChange],
  )

  const handleDateAccompteClientRecuChange = useCallback(
    (date: string) => handleInputChange("dateAccompteClientRecu", date),
    [handleInputChange],
  )

  return {
    canEditAccomptes,
    handleAccompteSSTChange,
    handleAccompteClientChange,
    handleAccompteSSTRecuChange,
    handleAccompteClientRecuChange,
    handleDateAccompteSSTRecuChange,
    handleDateAccompteClientRecuChange,
  }
}
