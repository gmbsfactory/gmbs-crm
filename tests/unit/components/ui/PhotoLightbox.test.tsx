import React from "react"
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { PhotoLightbox } from "@/components/ui/PhotoLightbox"
import { Z_CLASS, Z_INDEX } from "@/lib/ui/z-index"

const photos = [
  { id: "p1", url: "http://127.0.0.1:54321/storage/avant.jpg", filename: "avant.jpg", metadata: { phase: "avant", comment: "Avant travaux" } },
  { id: "p2", url: "http://127.0.0.1:54321/storage/apres.jpg", filename: "apres.jpg", metadata: { phase: "apres", comment: null } },
  { id: "p3", url: "http://127.0.0.1:54321/storage/autre.jpg", filename: "autre.jpg", metadata: null },
]

function renderLightbox(props: Partial<React.ComponentProps<typeof PhotoLightbox>> = {}) {
  const onClose = vi.fn()
  const utils = render(<PhotoLightbox photos={photos} index={0} onClose={onClose} {...props} />)
  return { ...utils, onClose }
}

describe("PhotoLightbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should render nothing when index is null", () => {
    const { container } = render(<PhotoLightbox photos={photos} index={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("should show the photo at the given index, its caption and the counter", () => {
    renderLightbox({ index: 1, caption: "v3 · Karim B." })

    const dialog = screen.getByRole("dialog", { name: /Photo agrandie/i })
    expect(dialog.querySelector("img")).toHaveAttribute("src", photos[1].url)
    expect(screen.getByText("2 / 3")).toBeInTheDocument()
    // Bandeau de contexte : version, artisan, phase avant/après.
    expect(screen.getByText("v3 · Karim B. · après")).toBeInTheDocument()
  })

  it("passe au-dessus des dialogues et des confirmations (étage « visionneuse »)", () => {
    renderLightbox()
    const dialog = screen.getByRole("dialog", { name: /Photo agrandie/i })
    expect(dialog.className).toContain(Z_CLASS.visionneuse)
    expect(Z_INDEX.visionneuse).toBeGreaterThan(Z_INDEX.confirmation)
  })

  it("should close on Escape", () => {
    const { onClose } = renderLightbox()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("should close when the backdrop is clicked but not the photo itself", () => {
    const { onClose } = renderLightbox()
    const dialog = screen.getByRole("dialog", { name: /Photo agrandie/i })

    fireEvent.click(dialog.querySelector("img") as HTMLImageElement)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("should navigate with the arrow keys and wrap around", () => {
    renderLightbox()
    const dialog = screen.getByRole("dialog", { name: /Photo agrandie/i })

    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(dialog.querySelector("img")).toHaveAttribute("src", photos[1].url)
    expect(screen.getByText("2 / 3")).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    // On repart de la première vers la dernière.
    expect(dialog.querySelector("img")).toHaveAttribute("src", photos[2].url)
    expect(screen.getByText("3 / 3")).toBeInTheDocument()
  })

  it("should navigate with the on-screen buttons and report the new index", () => {
    const onIndexChange = vi.fn()
    renderLightbox({ onIndexChange })

    fireEvent.click(screen.getByRole("button", { name: /Photo suivante/i }))
    expect(onIndexChange).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole("button", { name: /Photo précédente/i }))
    expect(onIndexChange).toHaveBeenLastCalledWith(0)
  })

  it("should navigate on a horizontal swipe", () => {
    renderLightbox()
    const dialog = screen.getByRole("dialog", { name: /Photo agrandie/i })

    fireEvent.touchStart(dialog, { touches: [{ clientX: 300 }] })
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 100 }] })
    expect(dialog.querySelector("img")).toHaveAttribute("src", photos[1].url)
  })

  it("should hide navigation and counter for a single photo", () => {
    render(<PhotoLightbox photos={[photos[0]]} index={0} onClose={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /Photo suivante/i })).not.toBeInTheDocument()
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument()
  })
})
