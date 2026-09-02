import React from "react"
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

import { ArtisanPortalLinkButton, generateArtisanPortalLink } from "@/components/artisans/ArtisanPortalLinkButton"

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}))

const ARTISAN_ID = "33333333-3333-4333-8333-333333333333"
const PORTAL_URL = "http://localhost:3001/t/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe("ArtisanPortalLinkButton", () => {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
  })

  describe("generateArtisanPortalLink", () => {
    it("should POST to /api/artisans/{id}/portal-link and return the link", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ url: PORTAL_URL, expires_at: "2026-10-02T09:00:00.000Z" }))

      const link = await generateArtisanPortalLink(ARTISAN_ID)

      expect(fetchMock).toHaveBeenCalledWith(`/api/artisans/${ARTISAN_ID}/portal-link`, { method: "POST" })
      expect(link).toEqual({ url: PORTAL_URL, expires_at: "2026-10-02T09:00:00.000Z" })
    })

    it("should explain that the portal is not configured on 503", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Portal not configured" }, 503))

      await expect(generateArtisanPortalLink(ARTISAN_ID)).rejects.toThrow(/portail artisans n'est pas configuré/i)
    })

    it("should surface the API error message on other failures", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Permission refusée" }, 403))

      await expect(generateArtisanPortalLink(ARTISAN_ID)).rejects.toThrow("Permission refusée")
    })
  })

  it("should open a dialog with the read-only URL and the expiration date", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ url: PORTAL_URL, expires_at: "2026-10-02T09:00:00.000Z" }))

    render(<ArtisanPortalLinkButton artisanId={ARTISAN_ID} artisanName="Karim Benali" />)

    fireEvent.click(screen.getByRole("button", { name: /Lien portail/i }))

    const input = (await screen.findByLabelText(/Adresse du portail/i)) as HTMLInputElement
    expect(input.value).toBe(PORTAL_URL)
    expect(input).toHaveAttribute("readonly")
    expect(screen.getByText(/Lien personnel de l'artisan, à lui transmettre/i)).toBeInTheDocument()
    expect(screen.getByText(/Valable jusqu'au/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copier" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ouvrir/i })).toBeInTheDocument()
  })

  it("should toast an error and keep the dialog closed on 503", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Portal not configured" }, 503))

    render(<ArtisanPortalLinkButton artisanId={ARTISAN_ID} />)

    fireEvent.click(screen.getByRole("button", { name: /Lien portail/i }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/portail artisans n'est pas configuré/i))
    })
    expect(screen.queryByLabelText(/Adresse du portail/i)).not.toBeInTheDocument()
  })
})
