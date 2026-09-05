import React from "react"
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { PortalReportSection } from "@/components/interventions/form-sections/PortalReportSection"

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
const ARTISAN_ID = "22222222-2222-4222-8222-222222222222"

const submittedReport = {
  id: "report-1",
  status: "submitted" as const,
  version: 2,
  travaux_realises: "Remplacement du siphon et test d'étanchéité",
  duree_minutes: 90,
  materiel_utilise: "Siphon PVC 40 mm",
  reste_a_faire: true,
  reste_a_faire_detail: "Repeindre le placard",
  anomalies: "Fuite ancienne sous l'évier",
  client_present: true,
  submitted_at: "2026-09-02T09:30:00.000Z",
  review_comment: null,
  reviewed_at: null,
  attachment_ids: ["p1", "p2"],
}

const photos = [
  { id: "p1", url: "http://127.0.0.1:54321/storage/avant.jpg", filename: "avant.jpg", metadata: { source: "portal", phase: "avant", comment: "Avant travaux" } },
  { id: "p2", url: "http://127.0.0.1:54321/storage/apres.jpg", filename: "apres.jpg", metadata: { source: "portal", phase: "apres" } },
]

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function renderSection(props: Partial<React.ComponentProps<typeof PortalReportSection>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PortalReportSection interventionId={INTERVENTION_ID} artisanId={ARTISAN_ID} defaultOpen {...props} />
    </QueryClientProvider>,
  )
  return { ...utils, queryClient, invalidateSpy }
}

describe("PortalReportSection", () => {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
  })

  it("should render nothing without an artisan", () => {
    const { container } = renderSection({ artisanId: null })
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("should show the loading state then « aucun rapport » when the API returns null", async () => {
    let resolveFetch: (value: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveFetch = resolve }))

    renderSection()

    expect(screen.getByText(/Chargement du rapport/i)).toBeInTheDocument()

    resolveFetch(jsonResponse({ report: null, photos: [], artisan: { id: ARTISAN_ID, nom: "Benali", prenom: "Karim" } }))

    await waitFor(() => {
      expect(screen.getByText(/n'a pas encore envoyé de rapport/i)).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/interventions/${INTERVENTION_ID}/portal-report`,
      expect.objectContaining({ cache: "no-store" }),
    )
    expect(screen.queryByRole("button", { name: /Valider le rapport/i })).not.toBeInTheDocument()
  })

  it("should render a submitted report with its fields, photos and actions", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ report: submittedReport, photos, artisan: { id: ARTISAN_ID, nom: "Benali", prenom: "Karim" } }),
    )

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Remplacement du siphon et test d'étanchéité")).toBeInTheDocument()
    })
    expect(screen.getAllByText("À vérifier").length).toBeGreaterThan(0)
    expect(screen.getByText(/Version 2/)).toBeInTheDocument()
    expect(screen.getByText(/par Karim Benali/)).toBeInTheDocument()
    expect(screen.getByText("1 h 30")).toBeInTheDocument()
    expect(screen.getByText("Siphon PVC 40 mm")).toBeInTheDocument()
    expect(screen.getByText(/Repeindre le placard/)).toBeInTheDocument()
    expect(screen.getByText("Fuite ancienne sous l'évier")).toBeInTheDocument()
    expect(screen.getByText(/Photos avant \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Photos après \(1\)/)).toBeInTheDocument()
    expect(screen.getByAltText("Avant travaux")).toHaveAttribute("src", photos[0].url)
    expect(screen.getByRole("button", { name: /Valider le rapport/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Demander une correction/i })).toBeInTheDocument()
  })

  it("should open the photo in a lightbox when a thumbnail is clicked", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ report: submittedReport, photos, artisan: null }))
    renderSection()

    const thumbnail = await screen.findByAltText("Avant travaux")
    fireEvent.click(thumbnail.closest("button") as HTMLButtonElement)

    const lightbox = screen.getByRole("dialog", { name: /Photo agrandie/i })
    expect(lightbox).toBeInTheDocument()
    expect(lightbox.querySelector("img")).toHaveAttribute("src", photos[0].url)
  })

  it("should POST decision=approved when « Valider le rapport » is clicked and invalidate caches", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ report: submittedReport, photos: [], artisan: null }))
      .mockResolvedValueOnce(jsonResponse({ report: { ...submittedReport, status: "approved" } }))
      .mockResolvedValue(jsonResponse({ report: { ...submittedReport, status: "approved" }, photos: [], artisan: null }))

    const { invalidateSpy } = renderSection()

    const approveButton = await screen.findByRole("button", { name: /Valider le rapport/i })
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/interventions/${INTERVENTION_ID}/portal-report/review`,
        expect.objectContaining({ method: "POST" }),
      )
    })
    const reviewCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/portal-report/review"))
    expect(reviewCall).toBeDefined()
    // L2 : la décision vise explicitement le rapport affiché (N rapports possibles).
    expect(JSON.parse((reviewCall as [string, RequestInit])[1].body as string)).toEqual({
      decision: "approved",
      report_id: "report-1",
    })

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Rapport validé")
    })
    const invalidatedKeys = invalidateSpy.mock.calls.map(([opts]) => JSON.stringify((opts as { queryKey: unknown }).queryKey))
    expect(invalidatedKeys).toContain(JSON.stringify(["interventions", "portal-report", INTERVENTION_ID]))
    expect(invalidatedKeys).toContain(JSON.stringify(["interventions", "list"]))
    expect(invalidatedKeys).toContain(JSON.stringify(["interventions", "detail", INTERVENTION_ID]))
  })

  it("should require a comment before sending a correction request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ report: submittedReport, photos: [], artisan: null }))
      .mockResolvedValueOnce(jsonResponse({ report: { ...submittedReport, status: "rejected" } }))
      .mockResolvedValue(jsonResponse({ report: { ...submittedReport, status: "rejected" }, photos: [], artisan: null }))

    renderSection()

    fireEvent.click(await screen.findByRole("button", { name: /Demander une correction/i }))

    const sendButton = await screen.findByRole("button", { name: /Envoyer la demande/i })
    expect(sendButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Commentaire \(obligatoire\)/i), { target: { value: "Photo après illisible" } })
    expect(sendButton).toBeEnabled()
    fireEvent.click(sendButton)

    await waitFor(() => {
      const reviewCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/portal-report/review"))
      expect(reviewCall).toBeDefined()
      expect(JSON.parse((reviewCall as [string, RequestInit])[1].body as string)).toEqual({
        decision: "rejected",
        comment: "Photo après illisible",
        report_id: "report-1",
      })
    })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Correction demandée à l'artisan")
    })
  })

  it("should show the review comment and hide actions for a rejected report", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        report: { ...submittedReport, status: "rejected", review_comment: "Merci de refaire la photo après", reviewed_at: "2026-09-02T10:00:00.000Z" },
        photos: [],
        artisan: null,
      }),
    )

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Merci de refaire la photo après")).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: /Valider le rapport/i })).not.toBeInTheDocument()
  })

  it("should surface an API error when the report cannot be loaded", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Accès refusé" }, 403))

    renderSection()

    await waitFor(() => {
      expect(screen.getByText("Accès refusé")).toBeInTheDocument()
    })
  })
})
