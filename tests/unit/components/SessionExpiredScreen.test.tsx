import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { SessionExpiredScreen } from "@/components/layout/session-expired-screen"

function stubLocation(pathname = "/interventions", search = "") {
  const assign = vi.fn()
  const reload = vi.fn()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname, search, assign, reload },
  })
  return { assign, reload }
}

describe("SessionExpiredScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("daily-expired", () => {
    it("should state that the session has expired", () => {
      stubLocation()
      render(<SessionExpiredScreen reason="daily-expired" />)

      expect(screen.getByText("Session expirée")).toBeInTheDocument()
    })

    it("should offer reconnection as the only action", () => {
      stubLocation()
      render(<SessionExpiredScreen reason="daily-expired" />)

      expect(screen.getByRole("button", { name: "Se reconnecter" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Recharger la page" })).not.toBeInTheDocument()
    })

    it("should send the user to the login portal, keeping the current page as target", () => {
      const { assign } = stubLocation("/interventions", "?view=market")
      render(<SessionExpiredScreen reason="daily-expired" />)

      fireEvent.click(screen.getByRole("button", { name: "Se reconnecter" }))

      expect(assign).toHaveBeenCalledWith(expect.stringContaining("expired=daily"))
      expect(assign).toHaveBeenCalledWith(expect.stringContaining("redirect="))
    })
  })

  describe("session-unavailable", () => {
    it("should not claim the session expired when the day is still current", () => {
      stubLocation()
      render(<SessionExpiredScreen reason="session-unavailable" />)

      expect(screen.getByText("Connexion au CRM interrompue")).toBeInTheDocument()
      expect(screen.queryByText("Session expirée")).not.toBeInTheDocument()
    })

    it("should offer a reload first, reconnection as fallback", () => {
      stubLocation()
      render(<SessionExpiredScreen reason="session-unavailable" />)

      expect(screen.getByRole("button", { name: "Recharger la page" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Se reconnecter" })).toBeInTheDocument()
    })

    it("should reload the page on the primary action", () => {
      const { reload } = stubLocation()
      render(<SessionExpiredScreen reason="session-unavailable" />)

      fireEvent.click(screen.getByRole("button", { name: "Recharger la page" }))

      expect(reload).toHaveBeenCalledTimes(1)
    })
  })
})
