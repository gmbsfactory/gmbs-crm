import { vi } from "vitest"
import "@testing-library/jest-dom"
import { cleanup } from "@testing-library/react"

// Mock global fetch
global.fetch = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Reset mocks and cleanup after each test
// NOTE: ne PAS utiliser vi.restoreAllMocks() ici — il supprime les .mockImplementation()
// définies au scope module dans les fichiers de test (ex: ResizeObserver stubs)
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
