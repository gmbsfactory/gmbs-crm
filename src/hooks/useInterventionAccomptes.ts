import { useCallback, useMemo } from "react"
import {
  applyRecuToggle,
  canEditDeposits,
  canMarkDepositReceived,
  isDepositSpecified,
} from "@/lib/interventions/deposit-helpers"
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

  const canEditAccomptes = useMemo(
    () => canEditDeposits(getStatusCode(formData.statut_id)),
    [formData.statut_id, getStatusCode],
  )

  // « Reçu » exige (1) un statut ACCEPTE/ATT_ACOMPTE — depuis DEVIS_ENVOYE on passe
  // d'abord par ATT_ACOMPTE au submit — et (2) un montant saisi (0 compris).
  const canMarkAccompteClientRecu = useMemo(
    () => canMarkDepositReceived(getStatusCode(formData.statut_id), formData.accompteClient),
    [formData.statut_id, formData.accompteClient, getStatusCode],
  )

  // --- Montants (local) ---

  const handleAccompteSSTChange = useCallback(
    (value: string) => handleInputChange("accompteSST", value),
    [handleInputChange],
  )

  // Vider le montant retire l'acompte : « Reçu » et sa date ne peuvent pas lui survivre
  // (sinon la case resterait cochée alors qu'elle est verrouillée, donc indécochable).
  const handleAccompteClientChange = useCallback(
    (value: string) => {
      handleInputChange("accompteClient", value)

      if (!isDepositSpecified(value) && formData.accompteClientRecu) {
        handleInputChange("accompteClientRecu", false)
        handleInputChange("dateAccompteClientRecu", "")
      }
    },
    [formData.accompteClientRecu, handleInputChange],
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

  // --- Checkbox Client (Reçu) : auto-fill date du jour + transition de statut LOCALE ---
  // La date reste éditable et redevient bloquante au submit si l'utilisateur la vide
  // (cf. getDepositValidationError dans useInterventionSubmit).

  const handleAccompteClientRecuChange = useCallback(
    (checked: boolean) => {
      const { recu, date } = applyRecuToggle(checked, formData.dateAccompteClientRecu)
      handleInputChange("accompteClientRecu", recu)
      if (date !== formData.dateAccompteClientRecu) {
        handleInputChange("dateAccompteClientRecu", date)
      }

      if (recu) {
        const accepteId = findStatusId("ACCEPTE")
        if (accepteId) handleInputChange("statut_id", accepteId)
      } else if (getStatusCode(formData.statut_id) === "ACCEPTE") {
        const attId = findStatusId("ATT_ACOMPTE")
        if (attId) handleInputChange("statut_id", attId)
      }
    },
    [formData.statut_id, formData.dateAccompteClientRecu, getStatusCode, findStatusId, handleInputChange],
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
    canMarkAccompteClientRecu,
    handleAccompteSSTChange,
    handleAccompteClientChange,
    handleAccompteSSTRecuChange,
    handleAccompteClientRecuChange,
    handleDateAccompteSSTRecuChange,
    handleDateAccompteClientRecuChange,
  }
}
