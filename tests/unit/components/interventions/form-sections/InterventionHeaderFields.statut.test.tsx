import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { InterventionHeaderFields } from "@/components/interventions/form-sections/InterventionHeaderFields"
import type { InterventionFormData } from "@/lib/interventions/form-types"
import type { ReferenceData } from "@/lib/reference-api"

/**
 * §10.1, point 1 — « Aucune route du portail ne doit EMPÊCHER un changement de
 * statut côté CRM ». Ce test verrouille la contrepartie côté interface : quoi
 * que l'artisan ait déclaré (démarrage, rapport en attente), le sélecteur de
 * statut du modal reste libre — toutes les valeurs offertes, en avant comme en
 * arrière, et aucun champ désactivé.
 */
// jsdom n'implémente pas scrollIntoView, appelé par la liste au montage.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const STATUSES = [
  { id: "s-1", code: "DEVIS_ENVOYE", label: "Devis envoyé", color: "#94A3B8" },
  { id: "s-2", code: "ACCEPTE", label: "Accepté", color: "#0EA5E9" },
  { id: "s-3", code: "INTER_EN_COURS", label: "En cours", color: "#F59E0B" },
  { id: "s-4", code: "INTER_TERMINEE", label: "Terminée", color: "#22C55E" },
]

function renderHeader(over: { hasPortalReport?: boolean } = {}) {
  const onChange = vi.fn()
  render(
    <InterventionHeaderFields
      formData={{ statut_id: "s-2" } as InterventionFormData}
      onChange={onChange}
      refData={{ interventionStatuses: STATUSES, agencies: [], metiers: [] } as unknown as ReferenceData}
      showReferenceField={false}
      requiresDefinitiveId={false}
      renderUserBadge={() => null}
      hasPortalReport={over.hasPortalReport ?? false}
    />,
  )
  // Le sélecteur de statut est le premier combobox de la ligne d'en-tête
  // (badge utilisateur, puis Statut, Agence, Métier).
  const statut = () => screen.getAllByRole("combobox")[0]
  return { onChange, statut }
}

describe("InterventionHeaderFields — le gestionnaire garde la main (§10.1)", () => {
  it("should offer every status, forward and backward, on a card the artisan touched", () => {
    const { statut } = renderHeader({ hasPortalReport: true })
    fireEvent.click(statut())

    // En avant comme en arrière : rien n'est retiré de la liste.
    const liste = screen.getByRole("listbox")
    for (const option of STATUSES) {
      expect(within(liste).getByRole("option", { name: new RegExp(option.label, "i") })).toBeInTheDocument()
    }
  })

  it("should never disable the status selector", () => {
    const { statut } = renderHeader({ hasPortalReport: true })
    expect(statut()).not.toBeDisabled()
  })

  it("should let the manager move the status backwards", () => {
    const { onChange, statut } = renderHeader({ hasPortalReport: true })
    fireEvent.click(statut())
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /Devis envoyé/i }))
    expect(onChange).toHaveBeenCalledWith("statut_id", "s-1")
  })
})
