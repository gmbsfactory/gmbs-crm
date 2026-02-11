import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, act } from "@testing-library/react"
import React from "react"

// Mock createPortal
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom")
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  }
})

import {
  GenieEffectOverlay,
  triggerGenieEffect,
  clearGenieEffect,
  useGenieEffect,
  badgeBounceStyles,
} from "@/components/ui/genie-effect/GenieEffect"

// Helper pour creer un element source mock
function createMockElement(tag = "tr"): HTMLElement {
  const el = document.createElement(tag)
  el.textContent = "Mock row content"
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 100,
    top: 200,
    right: 500,
    bottom: 240,
    width: 400,
    height: 40,
  })
  document.body.appendChild(el)
  return el
}

function createMockTarget(): HTMLElement {
  const el = document.createElement("div")
  el.textContent = "Badge"
  el.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 800,
    top: 50,
    right: 830,
    bottom: 80,
    width: 30,
    height: 30,
  })
  document.body.appendChild(el)
  return el
}

describe("GenieEffect", () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    clearGenieEffect()

    // Default : animations activees
    matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal("matchMedia", matchMediaMock)

    // Mock Element.animate (jsdom ne supporte pas Web Animations API)
    Element.prototype.animate = vi.fn().mockReturnValue({
      onfinish: null,
      cancel: vi.fn(),
      finished: Promise.resolve(),
    })
  })

  afterEach(() => {
    // Nettoyer les elements ajoutes au DOM
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  describe("Security - innerHTML elimination", () => {
    it("should not use innerHTML to clone source element", () => {
      const { container } = render(<GenieEffectOverlay />)

      const source = createMockElement()
      const target = createMockTarget()

      // Espionner innerHTML
      const cloneNodeSpy = vi.spyOn(source, "cloneNode")

      act(() => {
        triggerGenieEffect({
          interventionId: "test-1",
          sourceElement: source,
          targetElement: target,
          duration: 500,
        })
      })

      // Verifier que cloneNode est utilise (pas innerHTML)
      expect(cloneNodeSpy).toHaveBeenCalledWith(true)
    })

    it("should use cloneNode(true) for safe DOM cloning", () => {
      const source = createMockElement()
      const cloneNodeSpy = vi.spyOn(source, "cloneNode")
      const target = createMockTarget()

      render(<GenieEffectOverlay />)

      act(() => {
        triggerGenieEffect({
          interventionId: "test-clone",
          sourceElement: source,
          targetElement: target,
        })
      })

      expect(cloneNodeSpy).toHaveBeenCalledWith(true)
    })
  })

  describe("Accessibility attributes", () => {
    it("should have role=presentation on the overlay", () => {
      const { container } = render(<GenieEffectOverlay />)

      const source = createMockElement()
      const target = createMockTarget()

      act(() => {
        triggerGenieEffect({
          interventionId: "test-role",
          sourceElement: source,
          targetElement: target,
        })
      })

      const overlay = container.querySelector("[role='presentation']")
      expect(overlay).not.toBeNull()
    })

    it("should have aria-hidden=true on the overlay", () => {
      const { container } = render(<GenieEffectOverlay />)

      const source = createMockElement()
      const target = createMockTarget()

      act(() => {
        triggerGenieEffect({
          interventionId: "test-aria",
          sourceElement: source,
          targetElement: target,
        })
      })

      const overlay = container.querySelector("[aria-hidden='true']")
      expect(overlay).not.toBeNull()
    })

    it("should have aria-label on the overlay", () => {
      const { container } = render(<GenieEffectOverlay />)

      const source = createMockElement()
      const target = createMockTarget()

      act(() => {
        triggerGenieEffect({
          interventionId: "test-label",
          sourceElement: source,
          targetElement: target,
        })
      })

      const overlay = container.querySelector("[aria-label]")
      expect(overlay).not.toBeNull()
    })
  })

  describe("prefers-reduced-motion", () => {
    it("should skip animation when prefers-reduced-motion is set", () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      const onComplete = vi.fn()
      const source = createMockElement()
      const target = createMockTarget()

      render(<GenieEffectOverlay />)

      act(() => {
        triggerGenieEffect({
          interventionId: "test-motion",
          sourceElement: source,
          targetElement: target,
          onComplete,
        })
      })

      // Quand prefers-reduced-motion est actif, onComplete doit etre appele immediatement
      expect(onComplete).toHaveBeenCalled()
    })

    it("should proceed with animation when prefers-reduced-motion is not set", () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })

      const onComplete = vi.fn()
      const source = createMockElement()
      const target = createMockTarget()

      render(<GenieEffectOverlay />)

      act(() => {
        triggerGenieEffect({
          interventionId: "test-animate",
          sourceElement: source,
          targetElement: target,
          onComplete,
        })
      })

      // Quand prefers-reduced-motion est desactive, onComplete ne doit PAS etre appele immediatement
      // (contrairement au cas reduce ou il est appele tout de suite)
      expect(onComplete).not.toHaveBeenCalled()
    })

    it("should include prefers-reduced-motion CSS in badgeBounceStyles", () => {
      expect(badgeBounceStyles).toContain("prefers-reduced-motion: reduce")
      expect(badgeBounceStyles).toContain("animation: none")
    })
  })

  describe("GenieEffectOverlay rendering", () => {
    it("should return null when not animating", () => {
      const { container } = render(<GenieEffectOverlay />)
      // Quand pas d'animation, le composant ne rend rien
      expect(container.querySelector(".genie-effect-clone")).toBeNull()
    })

    it("should render overlay when animation is triggered", () => {
      const { container } = render(<GenieEffectOverlay />)

      const source = createMockElement()
      const target = createMockTarget()

      act(() => {
        triggerGenieEffect({
          interventionId: "test-render",
          sourceElement: source,
          targetElement: target,
        })
      })

      const overlay = container.querySelector(".genie-effect-clone")
      expect(overlay).not.toBeNull()
    })
  })

  describe("triggerGenieEffect / clearGenieEffect", () => {
    it("should trigger and clear state correctly", () => {
      const source = createMockElement()
      const target = createMockTarget()

      const { container, rerender } = render(<GenieEffectOverlay />)

      act(() => {
        triggerGenieEffect({
          interventionId: "test-state",
          sourceElement: source,
          targetElement: target,
        })
      })

      // Apres trigger, le composant devrait rendre l'overlay
      expect(container.querySelector(".genie-effect-clone")).not.toBeNull()

      act(() => {
        clearGenieEffect()
      })

      rerender(<GenieEffectOverlay />)

      // Apres clear, pas d'overlay
      expect(container.querySelector(".genie-effect-clone")).toBeNull()
    })
  })
})
