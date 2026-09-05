import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DossierBadge } from "@/components/artisans/DossierBadge"
import { PIECES_A_VERIFIER_COLOR } from "@/lib/artisans/document-review"

describe("DossierBadge", () => {
  describe("badge de statut de dossier (existant)", () => {
    it("should afficher un tiret sans statut ni pièce à vérifier", () => {
      const { container } = render(<DossierBadge statutDossier={undefined} />)
      expect(container.textContent).toContain("—")
      expect(screen.queryByTestId("pieces-a-verifier")).toBeNull()
    })

    it("should afficher le statut du dossier tel quel", () => {
      render(<DossierBadge statutDossier="COMPLET" />)
      expect(screen.getByText("COMPLET")).toBeTruthy()
    })

    it("should ne pas afficher de pastille quand aucune pièce n'attend", () => {
      render(<DossierBadge statutDossier="COMPLET" piecesAVerifier={0} />)
      expect(screen.queryByTestId("pieces-a-verifier")).toBeNull()
    })
  })

  describe("pastille « pièces à vérifier » (lot L5)", () => {
    it("should afficher la pastille avec le compte quand pieces_a_verifier > 0", () => {
      render(<DossierBadge statutDossier="À compléter" piecesAVerifier={3} />)
      const pastille = screen.getByTestId("pieces-a-verifier")
      expect(pastille.textContent).toContain("3")
      expect(pastille.textContent).toContain("à vérifier")
    })

    it("should porter le violet du badge « À vérifier » des rapports", () => {
      render(<DossierBadge statutDossier="COMPLET" piecesAVerifier={1} />)
      const pastille = screen.getByTestId("pieces-a-verifier")
      // jsdom normalise les couleurs en rgb() : on compare au violet du socle
      // (#9333EA), celui du badge « À vérifier » des rapports.
      const [r, v, b] = [1, 3, 5].map((i) =>
        parseInt(PIECES_A_VERIFIER_COLOR.slice(i, i + 2), 16),
      )
      const style = pastille.getAttribute("style") ?? ""
      expect(style).toContain(`color: rgb(${r}, ${v}, ${b})`)
      expect(style).toContain(`border-color: rgb(${r}, ${v}, ${b})`)
    })

    it("should accorder le libellé accessible au singulier et au pluriel", () => {
      const { unmount } = render(<DossierBadge statutDossier="COMPLET" piecesAVerifier={1} />)
      expect(screen.getByLabelText("1 pièce à vérifier")).toBeTruthy()
      unmount()

      render(<DossierBadge statutDossier="COMPLET" piecesAVerifier={2} />)
      expect(screen.getByLabelText("2 pièces à vérifier")).toBeTruthy()
    })

    it("should afficher la pastille même sans statut de dossier", () => {
      render(<DossierBadge statutDossier={undefined} piecesAVerifier={2} />)
      expect(screen.getByTestId("pieces-a-verifier")).toBeTruthy()
    })

    it("should ignorer une valeur négative ou non numérique", () => {
      const { unmount } = render(<DossierBadge statutDossier="COMPLET" piecesAVerifier={-1} />)
      expect(screen.queryByTestId("pieces-a-verifier")).toBeNull()
      unmount()

      render(
        <DossierBadge
          statutDossier="COMPLET"
          piecesAVerifier={Number.NaN as unknown as number}
        />,
      )
      expect(screen.queryByTestId("pieces-a-verifier")).toBeNull()
    })

    it("should afficher les deux badges côte à côte", () => {
      render(<DossierBadge statutDossier="À compléter" piecesAVerifier={4} />)
      expect(screen.getByText("À compléter")).toBeTruthy()
      expect(screen.getByTestId("pieces-a-verifier")).toBeTruthy()
    })
  })
})
