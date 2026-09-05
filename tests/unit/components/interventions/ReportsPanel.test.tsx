import React from "react"
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ReportsPanel } from "@/components/interventions/report-panel/ReportsPanel"

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}))

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true, canAny: () => true, canAll: () => true, isLoading: false }),
}))

const INTERVENTION_ID = "11111111-1111-4111-8111-111111111111"
const KARIM = { id: "art-karim", nom: "Benali", prenom: "Karim" }
const SOFIA = { id: "art-sofia", nom: "Martins", prenom: "Sofia" }

function assignment(artisan: typeof KARIM, overrides: Record<string, unknown> = {}) {
  return {
    artisan,
    artisan_id: artisan.id,
    is_primary: artisan.id === KARIM.id,
    cout_sst: 320,
    price: { response: null, responded_at: null, accepted_amount: null, source: null, refused_reason: null, drift: false },
    work: { started_at: null, from: null },
    payment: { state: "not_applicable", paid_at: null },
    report_ids: [],
    ...overrides,
  }
}

function report(id: string, version: number, artisan: typeof KARIM, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: "submitted",
    version,
    travaux_realises: `Travaux v${version}`,
    duree_minutes: 300,
    materiel_utilise: null,
    reste_a_faire: false,
    reste_a_faire_detail: null,
    anomalies: null,
    client_present: true,
    submitted_at: "2026-09-12T12:02:00.000Z",
    review_comment: null,
    reviewed_at: null,
    attachment_ids: [],
    started_at: "2026-09-12T06:40:00.000Z",
    superseded_at: null,
    superseded_by: null,
    artisan,
    artisan_id: artisan.id,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    report: null,
    photos: [],
    artisan: null,
    reports: [],
    photosByReport: {},
    assignments: [],
    ...overrides,
  }
}

function renderPanel(props: Partial<React.ComponentProps<typeof ReportsPanel>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ReportsPanel interventionId={INTERVENTION_ID} {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, queryClient }
}

describe("ReportsPanel", () => {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
  })

  describe("les sept états du panneau", () => {
    it("état 1 — aucun artisan affecté : le panneau reste non vide", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(payload()))
      const onGoToInfos = vi.fn()
      renderPanel({ onGoToInfos })

      expect(await screen.findByText(/Aucun artisan sur cette intervention/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /Choisir un artisan/i }))
      expect(onGoToInfos).toHaveBeenCalled()
    })

    it("état 2 — prix non posé : l'artisan ne voit pas encore la mission", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(payload({ assignments: [assignment(KARIM, { cout_sst: null })] })),
      )
      renderPanel({ statutCode: "DEVIS_ENVOYE" })

      expect(await screen.findByText(/ne voit pas encore la mission/i)).toBeInTheDocument()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "prix_non_pose")
    })

    it("état 3 — prix proposé, sans réponse", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(payload({ assignments: [assignment(KARIM)] })))
      renderPanel({ statutCode: "DEVIS_ENVOYE" })

      expect(await screen.findByText(/En attente de la réponse de Karim B/i)).toBeInTheDocument()
      expect(screen.getByText("320 €")).toBeInTheDocument()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "prix_propose")
    })

    it("état 4 — prix refusé : motif affiché et proposition à un autre artisan", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          payload({
            assignments: [
              assignment(KARIM, {
                price: {
                  response: "refused",
                  responded_at: "2026-09-10T08:00:00.000Z",
                  accepted_amount: null,
                  source: "portal",
                  refused_reason: "trop loin",
                  drift: false,
                },
              }),
            ],
          }),
        ),
      )
      const onGoToInfos = vi.fn()
      renderPanel({ onGoToInfos })

      expect(await screen.findByText(/trop loin/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /Proposer à un autre artisan/i }))
      expect(onGoToInfos).toHaveBeenCalled()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "prix_refuse")
    })

    it("état 5 — prix accepté, chantier non démarré, dérive du montant signalée", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          payload({
            assignments: [
              assignment(KARIM, {
                cout_sst: 280,
                price: {
                  response: "accepted",
                  responded_at: "2026-09-10T09:12:00.000Z",
                  accepted_amount: 320,
                  source: "portal",
                  refused_reason: null,
                  drift: true,
                },
              }),
            ],
          }),
        ),
      )
      renderPanel({ statutCode: "ACCEPTE" })

      expect(await screen.findByText(/Chantier non démarré/i)).toBeInTheDocument()
      expect(screen.getByText(/a accepté 320 € ; le coût SST enregistré est aujourd'hui 280 €/)).toBeInTheDocument()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "accepte_non_demarre")
    })

    it("état 6 — chantier démarré sans rapport : compteur vivant et champs manquants", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          payload({
            assignments: [
              assignment(KARIM, {
                work: { started_at: "2026-09-12T06:40:00.000Z", from: "portal" },
                price: { response: "accepted", responded_at: null, accepted_amount: 320, source: "portal", refused_reason: null, drift: false },
              }),
            ],
          }),
        ),
      )
      // Statut encore ACCEPTE : la transition a échoué, le fait est conservé.
      renderPanel({ statutCode: "ACCEPTE", missingFields: ["Coût SST", "Date prévue"] })

      expect(await screen.findByText(/en cours depuis/i)).toBeInTheDocument()
      expect(screen.getByText("Démarré · 2 champs manquants")).toBeInTheDocument()
      expect(screen.getByText("Coût SST")).toBeInTheDocument()
      expect(screen.getByText("Date prévue")).toBeInTheDocument()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "demarre")
    })

    it("état 7 — rapport reçu : bandeau de chantier, durée réelle et durée déclarée", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          payload({
            assignments: [
              assignment(KARIM, { work: { started_at: "2026-09-12T06:40:00.000Z", from: "portal" } }),
            ],
            reports: [report("rep-1", 1, KARIM)],
          }),
        ),
      )
      renderPanel({ statutCode: "INTER_EN_COURS" })

      expect(await screen.findByText("Travaux v1")).toBeInTheDocument()
      // 06:40 → 12:02 = 5 h 22 réelles, contre 5 h déclarées.
      expect(screen.getByText(/Durée réelle 5 h 22/)).toBeInTheDocument()
      expect(screen.getByText(/\(déclarée : 5 h\)/)).toBeInTheDocument()
      expect(screen.getByTestId(`report-block-${KARIM.id}`)).toHaveAttribute("data-state", "rapport_recu")
    })
  })

  it("rend un bloc par artisan affecté", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        payload({
          assignments: [assignment(KARIM), assignment(SOFIA, { is_primary: false, cout_sst: 150 })],
          reports: [report("rep-karim", 1, KARIM)],
        }),
      ),
    )
    renderPanel({ statutCode: "INTER_EN_COURS" })

    expect(await screen.findByTestId(`report-block-${KARIM.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`report-block-${SOFIA.id}`)).toBeInTheDocument()
    expect(screen.getByText("Karim B.")).toBeInTheDocument()
    expect(screen.getByText("Sofia M.")).toBeInTheDocument()
  })

  it("sélecteur de versions : replié, ordonné, et affiche le motif de la reprise", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        payload({
          assignments: [assignment(KARIM)],
          reports: [
            report("rep-2", 2, KARIM),
            report("rep-1", 1, KARIM, {
              status: "rejected",
              travaux_realises: "Travaux v1",
              review_comment: "Photo après illisible",
              submitted_at: "2026-09-11T09:00:00.000Z",
            }),
          ],
        }),
      ),
    )
    renderPanel({ statutCode: "INTER_EN_COURS" })

    // Version courante affichée, versions antérieures repliées.
    expect(await screen.findByText("Travaux v2")).toBeInTheDocument()
    expect(screen.queryByText("Travaux v1")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /1 version précédente/i }))
    expect(screen.getByText("Photo après illisible")).toBeInTheDocument()

    // Sélection de la v1 : c'est elle qui s'affiche.
    fireEvent.click(screen.getByText("v1").closest("button") as HTMLButtonElement)
    await waitFor(() => expect(screen.getByText("Travaux v1")).toBeInTheDocument())
  })

  it("visionneuse : n'affiche que les photos de la version sélectionnée", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        payload({
          assignments: [assignment(KARIM)],
          reports: [
            report("rep-2", 2, KARIM, { attachment_ids: ["ph-3"] }),
            report("rep-1", 1, KARIM, { status: "superseded", attachment_ids: ["ph-1"] }),
          ],
          photosByReport: { "rep-2": ["ph-3"], "rep-1": ["ph-1"], _hors_rapport: ["ph-9"] },
          photos: [
            { id: "ph-1", url: "http://local/v1.jpg", filename: "v1.jpg", metadata: { phase: "avant", comment: "Photo v1" } },
            { id: "ph-3", url: "http://local/v2.jpg", filename: "v2.jpg", metadata: { phase: "avant", comment: "Photo v2" } },
            { id: "ph-9", url: "http://local/orpheline.jpg", filename: "orpheline.jpg", metadata: { phase: "autre" } },
          ],
        }),
      ),
    )
    renderPanel({ statutCode: "INTER_EN_COURS" })

    const block = await screen.findByTestId(`report-block-${KARIM.id}`)
    expect(within(block).getByAltText("Photo v2")).toBeInTheDocument()
    expect(within(block).queryByAltText("Photo v1")).not.toBeInTheDocument()

    // La photo orpheline est isolée dans son propre bloc, pas dans la version.
    expect(screen.getByText(/Photos déposées hors d'un rapport \(1\)/)).toBeInTheDocument()

    fireEvent.click(within(block).getByAltText("Photo v2").closest("button") as HTMLButtonElement)
    const lightbox = screen.getByRole("dialog", { name: /Photo agrandie/i })
    expect(lightbox.querySelector("img")).toHaveAttribute("src", "http://local/v2.jpg")
    expect(within(lightbox).getByText(/v2 · Karim B\. · avant/)).toBeInTheDocument()
  })

  it("validation : cible explicitement le rapport affiché", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          payload({
            assignments: [assignment(KARIM), assignment(SOFIA, { is_primary: false })],
            reports: [report("rep-karim", 3, KARIM), report("rep-sofia", 1, SOFIA)],
          }),
        ),
      )
      .mockResolvedValue(jsonResponse({ report: report("rep-sofia", 1, SOFIA, { status: "approved" }) }))

    renderPanel({ statutCode: "INTER_EN_COURS" })

    const sofiaBlock = await screen.findByTestId(`report-block-${SOFIA.id}`)
    fireEvent.click(within(sofiaBlock).getByRole("button", { name: /Valider le rapport/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/portal-report/review"))
      expect(call).toBeDefined()
      expect(JSON.parse((call as [string, RequestInit])[1].body as string)).toEqual({
        decision: "approved",
        report_id: "rep-sofia",
      })
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Rapport validé"))
  })

  it("correction : motif obligatoire, et réouverture proposée sur INTER_TERMINEE", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(payload({ assignments: [assignment(KARIM)], reports: [report("rep-1", 1, KARIM)] })),
      )
      .mockResolvedValue(jsonResponse({ report: report("rep-1", 1, KARIM, { status: "rejected" }) }))

    renderPanel({ statutCode: "INTER_TERMINEE" })

    fireEvent.click(await screen.findByRole("button", { name: /Demander une correction/i }))

    const send = await screen.findByRole("button", { name: /Envoyer la demande/i })
    expect(send).toBeDisabled()

    // Case cochée par défaut sur une intervention terminée.
    expect(screen.getByLabelText(/Rouvrir l'intervention/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Commentaire \(obligatoire\)/i), { target: { value: "Photo illisible" } })
    fireEvent.click(send)

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/portal-report/review"))
      expect(JSON.parse((call as [string, RequestInit])[1].body as string)).toEqual({
        decision: "rejected",
        comment: "Photo illisible",
        report_id: "rep-1",
        reopen_intervention: true,
      })
    })
  })

  it("remonte l'erreur de chargement sans jamais disparaître", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Accès refusé" }, 403))
    renderPanel()
    expect(await screen.findByText("Accès refusé")).toBeInTheDocument()
  })
})

describe("ReportsPanel — replis « au téléphone » (constat 7)", () => {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
  })

  it("enregistre un prix accepté par téléphone sur l'affectation affichée", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(payload({ assignments: [assignment(KARIM)] })))
      .mockResolvedValueOnce(jsonResponse({ price: { response: "accepted", source: "crm" } }))
      .mockResolvedValue(jsonResponse(payload({ assignments: [assignment(KARIM)] })))

    renderPanel()
    fireEvent.click(await screen.findByTestId("prix-par-telephone"))
    fireEvent.click(await screen.findByRole("button", { name: "Accepté" }))

    await waitFor(() => {
      const appel = fetchMock.mock.calls.find(
        (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/price"),
      )
      expect(appel).toBeTruthy()
      expect(appel?.[0]).toBe(`/api/interventions/${INTERVENTION_ID}/artisans/${KARIM.id}/price`)
      // Verrou optimiste : le montant envoyé est celui que le gestionnaire voit.
      expect(JSON.parse((appel?.[1] as { body: string }).body)).toEqual({
        response: "accepted",
        amount_seen: 320,
      })
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it("transmet le motif d'un refus enregistré par téléphone", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(payload({ assignments: [assignment(KARIM)] })))
      .mockResolvedValueOnce(jsonResponse({ price: { response: "refused", source: "crm" } }))
      .mockResolvedValue(jsonResponse(payload({ assignments: [assignment(KARIM)] })))

    renderPanel()
    fireEvent.click(await screen.findByTestId("prix-par-telephone"))
    fireEvent.change(await screen.findByLabelText(/Motif/i), { target: { value: "Agenda plein" } })
    fireEvent.click(screen.getByRole("button", { name: "Refusé" }))

    await waitFor(() => {
      const appel = fetchMock.mock.calls.find(
        (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/price"),
      )
      expect(JSON.parse((appel?.[1] as { body: string }).body)).toMatchObject({
        response: "refused",
        reason: "Agenda plein",
      })
    })
  })

  it("appelle la route de démarrage sans qu'aucune prop ne soit fournie", async () => {
    const accepte = assignment(KARIM, {
      price: {
        response: "accepted",
        responded_at: "2026-09-12T09:00:00.000Z",
        accepted_amount: 320,
        source: "crm",
        refused_reason: null,
        drift: false,
      },
    })
    fetchMock
      .mockResolvedValueOnce(jsonResponse(payload({ assignments: [accepte] })))
      .mockResolvedValueOnce(jsonResponse({ work: { started_at: "x", from: "crm" } }))
      .mockResolvedValue(jsonResponse(payload({ assignments: [accepte] })))

    renderPanel()
    fireEvent.click(await screen.findByRole("button", { name: /Démarré par téléphone/i }))

    await waitFor(() => {
      const appel = fetchMock.mock.calls.find(
        (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).endsWith("/start"),
      )
      expect(appel?.[0]).toBe(`/api/interventions/${INTERVENTION_ID}/artisans/${KARIM.id}/start`)
    })
  })

  it("affiche le message métier renvoyé par l'API en cas d'échec", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(payload({ assignments: [assignment(KARIM)] })))
      .mockResolvedValueOnce(jsonResponse({ error: "price_changed" }, 409))
      .mockResolvedValue(jsonResponse(payload({ assignments: [assignment(KARIM)] })))

    renderPanel()
    fireEvent.click(await screen.findByTestId("prix-par-telephone"))
    fireEvent.click(await screen.findByRole("button", { name: "Accepté" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/coût SST a changé/i)))
  })
})
