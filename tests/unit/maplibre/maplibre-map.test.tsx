import "@testing-library/jest-dom/vitest"
import React from "react"
import { render, screen } from "@testing-library/react"

// Vitest environment requires React on the global scope for legacy JSX runtime
globalThis.React = React
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MapLibreMapImpl } from "@/components/maps/MapLibreMapImpl"

const maptilerConfig = vi.hoisted(() => ({ apiKey: "" }))

const mockGeoJSONSource = {
  setData: vi.fn(),
}

const mapInstanceBase = {
  addControl: vi.fn(),
  on: vi.fn().mockReturnThis(),
  once: vi.fn(),
  remove: vi.fn(),
  easeTo: vi.fn(),
  fitBounds: vi.fn(),
  getStyle: vi.fn(() => ({
    layers: [{ id: "label-layer", type: "symbol" }],
    sources: { openmaptiles: {} },
  })),
  getLayer: vi.fn(() => undefined),
  removeLayer: vi.fn(),
  addLayer: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  getSource: vi.fn(() => mockGeoJSONSource),
  addSource: vi.fn(),
  removeSource: vi.fn(),
}

const mockMarkerElement = {
  style: { cursor: "" },
  addEventListener: vi.fn(),
}

const markerInstanceBase = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  setDraggable: vi.fn(),
  getLngLat: vi.fn(() => ({ lat: 48.85, lng: 2.35 })),
  getElement: vi.fn(() => mockMarkerElement),
}

const MapMock = vi.hoisted(() => vi.fn())
const MarkerMock = vi.hoisted(() => vi.fn())
const NavigationControlMock = vi.hoisted(() => vi.fn())

vi.mock("@maptiler/sdk", () => ({ config: maptilerConfig }))
vi.mock("@maptiler/sdk/dist/maptiler-sdk.css", () => ({}), { virtual: true })
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true })
vi.mock("maplibre-gl", () => ({
  default: {
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: NavigationControlMock,
  },
}))

describe("MapLibreMapImpl", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    MapMock.mockReset()
    MarkerMock.mockReset()
    NavigationControlMock.mockReset()
    maptilerConfig.apiKey = ""

    // Reset mockMarkerElement
    mockMarkerElement.style = { cursor: "" }
    mockMarkerElement.addEventListener = vi.fn()

    // Reset mockGeoJSONSource
    mockGeoJSONSource.setData = vi.fn()

    Object.assign(mapInstanceBase, {
      addControl: vi.fn(),
      on: vi.fn().mockReturnThis(),
      once: vi.fn(),
      remove: vi.fn(),
      easeTo: vi.fn(),
      fitBounds: vi.fn(),
      getStyle: vi.fn(() => ({
        layers: [{ id: "label-layer", type: "symbol" }],
        sources: { openmaptiles: {} },
      })),
      getLayer: vi.fn(() => undefined),
      removeLayer: vi.fn(),
      addLayer: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
      getSource: vi.fn(() => mockGeoJSONSource),
      addSource: vi.fn(),
      removeSource: vi.fn(),
    })
    Object.assign(markerInstanceBase, {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      setDraggable: vi.fn(),
      getLngLat: vi.fn(() => ({ lat: 48.85, lng: 2.35 })),
      getElement: vi.fn(() => mockMarkerElement),
    })

    MapMock.mockImplementation(() => mapInstanceBase)
    MarkerMock.mockImplementation(() => markerInstanceBase)
    NavigationControlMock.mockImplementation(() => ({}))

    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-maptiler-key"
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY
  })

  it("should render map container and instantiate MapLibre", () => {
    const { container } = render(<MapLibreMapImpl lat={48.8566} lng={2.3522} height="220px" />)

    expect(container.querySelector("div")).toBeTruthy()
    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [2.3522, 48.8566],
        pitch: 50,
        bearing: -17.6,
      }),
    )
    expect(markerInstanceBase.setLngLat).toHaveBeenCalledWith([2.3522, 48.8566])
  })

  it("should display an error message when MapTiler key is missing", () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY
    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} />)

    expect(screen.getByText(/Clé MapTiler manquante/i)).toBeInTheDocument()
    expect(MapMock).not.toHaveBeenCalled()
  })

  it("should trigger onLocationChange when marker is dragged", () => {
    const onLocationChange = vi.fn()
    let dragHandler: (() => void) | undefined

    markerInstanceBase.on = vi.fn((event, handler) => {
      if (event === "dragend") {
        dragHandler = handler
      }
      return markerInstanceBase
    })

    markerInstanceBase.getLngLat = vi.fn(() => ({ lat: 43.6047, lng: 1.4442 }))

    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} onLocationChange={onLocationChange} />)

    expect(markerInstanceBase.on).toHaveBeenCalledWith("dragend", expect.any(Function))
    expect(typeof dragHandler).toBe("function")

    dragHandler?.()

    expect(onLocationChange).toHaveBeenCalledWith(43.6047, 1.4442)
  })
})
