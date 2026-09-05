import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const h = vi.hoisted(() => ({
  reviewPiece: vi.fn(),
  validerDossier: vi.fn(),
  etat: {
    pieces: [] as unknown[],
    nbAVerifier: 0,
    dossierValidable: false,
    isLoading: false,
    enCours: null as string | null,
  },
}))

vi.mock("@/components/ui/artisan-modal/_hooks/useArtisanDossierReview", () => ({
  useArtisanDossierReview: () => ({
    ...h.etat,
    error: null,
    reviewPiece: h.reviewPiece,
    validerDossier: h.validerDossier,
  }),
}))

// L'aperçu s'appuie sur next/image : un rendu texte suffit pour ces tests.
vi.mock("@/components/documents/DocumentPreview", () => ({
  DocumentPreview: ({ filename }: { filename?: string }) => <div>aperçu {filename}</div>,
}))

import { DossierVerificationCard } from "@/components/ui/artisan-modal/_components/DossierVerificationCard"

const ARTISAN_ID = "a0000000-0000-4000-8000-000000000001"

function piece(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    kind: "kbis",
    url: "http://local/kbis.pdf",
    filename: "kbis.pdf",
    mime_type: "application/pdf",
    created_at: "2026-09-04T08:00:00.000Z",
    review_status: "pending",
    reviewed_at: null,
    review_comment: null,
    metadata: { source: "portal" },
    ...overrides,
  }
}

/** Déplie la carte : le contenu n'est monté qu'à l'ouverture. */
function ouvrir() {
  fireEvent.click(screen.getByText("Vérification des pièces"))
}

describe("DossierVerificationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.etat.pieces = []
    h.etat.nbAVerifier = 0
    h.etat.dossierValidable = false
    h.etat.isLoading = false
    h.etat.enCours = null
  })

  it("should afficher le compte de pièces à vérifier", () => {
    h.etat.pieces = [piece()]
    h.etat.nbAVerifier = 1
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    expect(screen.getByTestId("dossier-a-verifier").textContent).toContain("1 à vérifier")
  })

  it("should afficher « Dossier complet validé le … » quand la date est posée", () => {
    render(
      <DossierVerificationCard
        artisanId={ARTISAN_ID}
        dossierValidatedAt="2026-09-12T09:00:00.000Z"
      />,
    )
    expect(screen.getByText(/Dossier complet validé le/)).toBeTruthy()
  })

  it("should ne rien afficher tant que dossier_validated_at est nul", () => {
    render(<DossierVerificationCard artisanId={ARTISAN_ID} dossierValidatedAt={null} />)
    expect(screen.queryByText(/Dossier complet validé le/)).toBeNull()
  })

  it("should valider une pièce en un clic, avec sa date de validité", async () => {
    h.etat.pieces = [piece()]
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()

    fireEvent.change(screen.getByLabelText("Date de validité"), {
      target: { value: "2027-03-31" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Valider$/ }))

    await waitFor(() =>
      expect(h.reviewPiece).toHaveBeenCalledWith("p1", {
        decision: "approved",
        validUntil: "2027-03-31",
      }),
    )
  })

  it("should exiger un motif pour refuser : le bouton reste désactivé", () => {
    h.etat.pieces = [piece()]
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()

    fireEvent.click(screen.getByRole("button", { name: /Refuser$/ }))
    const confirmer = screen.getByRole("button", { name: "Refuser la pièce" })
    expect((confirmer as HTMLButtonElement).disabled).toBe(true)
    expect(h.reviewPiece).not.toHaveBeenCalled()
  })

  it("should envoyer le refus une fois le motif saisi", async () => {
    h.etat.pieces = [piece()]
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()

    fireEvent.click(screen.getByRole("button", { name: /Refuser$/ }))
    fireEvent.change(screen.getByLabelText("Motif du refus"), {
      target: { value: "Kbis de plus de 3 mois" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Refuser la pièce" }))

    await waitFor(() =>
      expect(h.reviewPiece).toHaveBeenCalledWith("p1", {
        decision: "rejected",
        comment: "Kbis de plus de 3 mois",
      }),
    )
  })

  it("should afficher « vérifiée le … » seulement quand reviewed_at est renseigné", () => {
    h.etat.pieces = [
      piece({ id: "p1", review_status: "approved", reviewed_at: null }),
      piece({
        id: "p2",
        kind: "iban",
        review_status: "approved",
        reviewed_at: "2026-09-12T09:00:00.000Z",
      }),
    ]
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()
    // Une pièce héritée du DEFAULT 'approved' n'a jamais été regardée.
    expect(screen.getAllByText(/Vérifiée le/)).toHaveLength(1)
  })

  it("should afficher le motif de refus en entier", () => {
    h.etat.pieces = [
      piece({
        review_status: "rejected",
        reviewed_at: "2026-09-12T09:00:00.000Z",
        review_comment: "Le document est illisible sur la seconde page.",
      }),
    ]
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()
    expect(
      screen.getByText(/Le document est illisible sur la seconde page\./),
    ).toBeTruthy()
  })

  it("should désactiver « Valider le dossier » tant que les 5 pièces ne sont pas validées", () => {
    h.etat.pieces = [piece()]
    h.etat.dossierValidable = false
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()
    const bouton = screen.getByRole("button", { name: /Valider le dossier/ })
    expect((bouton as HTMLButtonElement).disabled).toBe(true)
  })

  it("should activer « Valider le dossier » quand le dossier est complet", async () => {
    h.etat.pieces = [piece({ review_status: "approved", reviewed_at: "2026-09-12T09:00:00.000Z" })]
    h.etat.dossierValidable = true
    render(<DossierVerificationCard artisanId={ARTISAN_ID} />)
    ouvrir()
    fireEvent.click(screen.getByRole("button", { name: /Valider le dossier/ }))
    await waitFor(() => expect(h.validerDossier).toHaveBeenCalled())
  })

  it("should masquer toute action en lecture seule", () => {
    h.etat.pieces = [piece()]
    h.etat.dossierValidable = true
    render(<DossierVerificationCard artisanId={ARTISAN_ID} readOnly />)
    ouvrir()
    expect(screen.queryByRole("button", { name: /Valider$/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Refuser$/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Valider le dossier/ })).toBeNull()
  })
})
