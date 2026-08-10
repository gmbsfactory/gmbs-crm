import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExpandedRowContent } from "@/components/interventions/views/ExpandedRowContent"

// La colonne commentaires tire sur Supabase / TanStack Query : hors sujet ici.
vi.mock("@/components/shared/CommentSection", () => ({
  CommentSection: () => <div data-testid="comment-section" />,
}))

const LONG_CONTEXTE = Array.from({ length: 40 }, (_, i) => `Ligne de contexte ${i}`).join("\n")

function renderExpandedRow(overrides: Record<string, unknown> = {}) {
  const intervention = {
    id: "intervention-1",
    contexteIntervention: LONG_CONTEXTE,
    consigneIntervention: LONG_CONTEXTE,
    adresse: "1 rue des Tests",
    ...overrides,
  }

  return render(
    <ExpandedRowContent
      intervention={intervention as never}
      statusColor="#123456"
      showStatusBorder={false}
      statusBorderWidth="2px"
      currentUserId="user-1"
    />
  )
}

describe("ExpandedRowContent", () => {
  describe("scroll des blocs texte longs", () => {
    it.each([
      ["expanded-row-contexte"],
      ["expanded-row-consigne"],
    ])("should confine le scroll de %s dans un conteneur borne", (testId) => {
      renderExpandedRow()

      const container = screen.getByTestId(testId)

      // Hauteur bornee : la ligne depliee ne peut pas devenir geante.
      expect(container.className).toContain("max-h-[320px]")
      expect(container.className).toContain("overflow-y-auto")
      // Empeche la propagation de la molette au scroll du tableau en fin de course.
      expect(container.className).toContain("overscroll-contain")
    })

    it("should conserver le texte integral et les retours a la ligne", () => {
      renderExpandedRow()

      const container = screen.getByTestId("expanded-row-contexte")
      const paragraph = container.querySelector("p")

      expect(paragraph?.textContent).toBe(LONG_CONTEXTE)
      expect(paragraph?.className).toContain("whitespace-pre-wrap")
    })

    it("should afficher un placeholder quand le contexte est absent", () => {
      renderExpandedRow({ contexteIntervention: undefined })

      expect(screen.getByTestId("expanded-row-contexte").textContent).toBe("—")
    })
  })
})
