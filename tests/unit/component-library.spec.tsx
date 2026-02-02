import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeAll } from "vitest"

// Inject React globally for components that don't import it
beforeAll(() => {
  globalThis.React = React
})

// Mock next/image
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: { src: string; alt?: string }) => {
    const resolvedSrc = typeof src === "string" ? src : ""
    return <img src={resolvedSrc} alt={alt ?? ""} {...props} />
  },
}))

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(function MotionDiv(
      { children, whileHover, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<HTMLDivElement>
    ) {
      return <div ref={ref} {...props}>{children}</div>
    }),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// Mock Skeleton component
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}))

// Mock BadgeComponents
vi.mock("@/components/ui/BadgeComponents", () => ({
  StatusBadge: ({ label }: { label: string }) => <span data-testid="status-badge">{label}</span>,
  MetierBadge: ({ metier }: { metier: string }) => <span data-testid="metier-badge">{metier}</span>,
  AgenceBadge: ({ agence }: { agence: string }) => <span data-testid="agence-badge">{agence}</span>,
}))

// Mock ArtisanStatusBadge
vi.mock("@/components/ui/ArtisanStatusBadge", () => ({
  ArtisanStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="artisan-status-badge">{status}</span>
  ),
}))

// Mock Pagination
vi.mock("@/components/ui/pagination", () => ({
  Pagination: () => <div data-testid="pagination">Pagination</div>,
}))

// Import after mocks
import ComponentLibraryPage from "../../app/component/page"

describe("ComponentLibraryPage", () => {
  it("renders the page with header", () => {
    render(<ComponentLibraryPage />)

    expect(
      screen.getByRole("heading", { name: /Design System/i })
    ).toBeInTheDocument()
  })

  it("renders category filter buttons", { timeout: 10000 }, () => {
    render(<ComponentLibraryPage />)

    // Check that category filter buttons exist
    expect(screen.getByRole("button", { name: /Tous/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Boutons/i })).toBeInTheDocument()
  })

  it("has a search input", () => {
    render(<ComponentLibraryPage />)

    const searchInput = screen.getByPlaceholderText("Rechercher un composant...")
    expect(searchInput).toBeInTheDocument()
  })

  it("filters by search query", () => {
    render(<ComponentLibraryPage />)

    const searchInput = screen.getByPlaceholderText("Rechercher un composant...")
    fireEvent.change(searchInput, { target: { value: "avatar" } })

    // Avatar section should be visible (matches search) - appears in filter and section
    expect(screen.getAllByText("Avatars & Users").length).toBeGreaterThan(0)
  })

  it("filters by category when button clicked", () => {
    render(<ComponentLibraryPage />)

    // Click on "Boutons" category filter
    const buttonsFilter = screen.getByRole("button", { name: /Boutons/i })
    fireEvent.click(buttonsFilter)

    // Buttons section header should be visible
    expect(screen.getByText("Actions principales et secondaires")).toBeInTheDocument()
  })

  it("resets filters when 'Tous' is clicked", () => {
    render(<ComponentLibraryPage />)

    // First filter by category
    const buttonsFilter = screen.getByRole("button", { name: /Boutons/i })
    fireEvent.click(buttonsFilter)

    // Then click "Tous" to reset
    const allFilter = screen.getByRole("button", { name: /Tous/i })
    fireEvent.click(allFilter)

    // Multiple sections should be visible now - use getAllByText since "Boutons" appears in filter and section
    expect(screen.getAllByText("Boutons").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Avatars & Users").length).toBeGreaterThan(0)
  })

  it("shows empty state when no results match search", () => {
    render(<ComponentLibraryPage />)

    const searchInput = screen.getByPlaceholderText("Rechercher un composant...")
    fireEvent.change(searchInput, { target: { value: "xyznonexistent" } })

    // Empty state should be shown
    expect(screen.getByText("Aucun resultat")).toBeInTheDocument()
  })

  it("displays component count badge", () => {
    render(<ComponentLibraryPage />)

    // Component count badge should show number of components
    expect(screen.getByText(/\d+ composants/i)).toBeInTheDocument()
  })

  it("renders Documents category with variants", () => {
    render(<ComponentLibraryPage />)

    // Documents category should be visible
    expect(screen.getAllByText("Documents").length).toBeGreaterThan(0)

    // GMBS variant should be present
    expect(screen.getByText("Document Manager - GMBS")).toBeInTheDocument()

    // Legacy variant should be present
    expect(screen.getByText("Document Manager - Legacy")).toBeInTheDocument()
  })

  it("renders GenericModal showcase with display modes", () => {
    render(<ComponentLibraryPage />)

    // GenericModal component should be present
    expect(screen.getByText("GenericModal")).toBeInTheDocument()

    // Display modes should be shown
    expect(screen.getByText("Centerpage")).toBeInTheDocument()
    expect(screen.getByText("Halfpage")).toBeInTheDocument()
    expect(screen.getByText("Fullpage")).toBeInTheDocument()
  })

  it("renders Toast showcase with variants", () => {
    render(<ComponentLibraryPage />)

    // Toast component should be present
    expect(screen.getByText("Toast Notifications")).toBeInTheDocument()

    // Toast variants should be shown (multiple "Default" elements exist on page)
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Destructive").length).toBeGreaterThan(0)
  })
})
