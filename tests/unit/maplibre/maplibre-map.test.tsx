import "@testing-library/jest-dom/vitest"
import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

// Vitest environment requires React on the global scope for legacy JSX runtime
globalThis.React = React
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MapLibreMapImpl } from "@/components/maps/MapLibreMapImpl"

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
  setPitch: vi.fn(),
  setLayoutProperty: vi.fn(),
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

const LngLatBoundsMock = vi.hoisted(() =>
  vi.fn(function (this: any) {
    this.extend = vi.fn().mockReturnThis()
  }),
)
const MapMock = vi.hoisted(() => vi.fn())
const MarkerMock = vi.hoisted(() => vi.fn())
const NavigationControlMock = vi.hoisted(() => vi.fn())

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true })
vi.mock("maplibre-gl", () => ({
  default: {
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: NavigationControlMock,
    LngLatBounds: LngLatBoundsMock,
  },
}))

describe("MapLibreMapImpl", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    MapMock.mockReset()
    MarkerMock.mockReset()
    NavigationControlMock.mockReset()

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
      setPitch: vi.fn(),
      setLayoutProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
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
    window.localStorage.clear()
  })

  it("should render map container and instantiate MapLibre", () => {
    const { container } = render(<MapLibreMapImpl lat={48.8566} lng={2.3522} height="220px" />)

    expect(container.querySelector("div")).toBeTruthy()
    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [2.3522, 48.8566],
        style: "https://tiles.openfreemap.org/styles/liberty",
        pitch: 0,
        bearing: 0,
      }),
    )
    expect(markerInstanceBase.setLngLat).toHaveBeenCalledWith([2.3522, 48.8566])
  })

  it("should use the keyless OpenFreeMap style so no API quota applies", () => {
    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} />)

    const options = MapMock.mock.calls[0][0]
    expect(options.style).toBe("https://tiles.openfreemap.org/styles/liberty")
    expect(String(options.style)).not.toContain("key=")
  })

  it("should render flat and hide the style's 3D buildings by default", () => {
    // Le style Liberty embarque une couche `building-3d` visible par defaut.
    mapInstanceBase.getLayer = vi.fn((id: string) => (id === "building-3d" ? { id } : undefined))

    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} />)

    expect(MapMock.mock.calls[0][0].pitch).toBe(0)
    expect(mapInstanceBase.setLayoutProperty).toHaveBeenCalledWith("building-3d", "visibility", "none")
  })

  it("should toggle the style's own extrusion layer rather than stacking a second one", () => {
    mapInstanceBase.getLayer = vi.fn((id: string) => (id === "building-3d" ? { id } : undefined))

    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} enable3DBuildings />)

    expect(mapInstanceBase.setLayoutProperty).toHaveBeenCalledWith("building-3d", "visibility", "visible")
    const addedLayerIds = mapInstanceBase.addLayer.mock.calls.map((call) => call[0].id)
    expect(addedLayerIds).not.toContain("3d-buildings")
  })

  it("should fall back to its own extrusion layer for styles without one", () => {
    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} enable3DBuildings />)

    const addedLayerIds = mapInstanceBase.addLayer.mock.calls.map((call) => call[0].id)
    expect(addedLayerIds).toContain("3d-buildings")
  })

  it("should bind the load handler only once", () => {
    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} />)

    const loadSubscriptions = mapInstanceBase.on.mock.calls.filter((call) => call[0] === "load" || call[0] === "style.load")
    expect(loadSubscriptions).toHaveLength(0)
    expect(mapInstanceBase.once.mock.calls.filter((call) => call[0] === "load")).toHaveLength(1)
  })

  it("should trigger a single camera animation on mount", () => {
    // Avant correctif, handleLoad et l'effet [lat, lng, zoom, ...] cadraient tous deux
    // la carte : deux animations concurrentes vers la meme cible a chaque montage.
    render(<MapLibreMapImpl lat={48.8566} lng={2.3522} circleRadiusKm={10} />)

    expect(mapInstanceBase.fitBounds).toHaveBeenCalledTimes(1)

    // handleLoad, mis en file sur `load`, ne doit plus recadrer de son cote.
    const handleLoad = mapInstanceBase.once.mock.calls.find((call) => call[0] === "load")?.[1]
    expect(typeof handleLoad).toBe("function")
    handleLoad()

    expect(mapInstanceBase.fitBounds).toHaveBeenCalledTimes(1)
  })

  describe("selecteur Plan / Relief", () => {
    const STORAGE_KEY = "gmbs:intervention-form:map-view-mode:user-1"

    it("should not render the toggle when no storage key is provided", () => {
      render(<MapLibreMapImpl lat={48.8566} lng={2.3522} />)

      expect(screen.queryByRole("button", { name: /plan|relief/i })).toBeNull()
    })

    it("should start in flat mode and expose the toggle", () => {
      render(<MapLibreMapImpl lat={48.8566} lng={2.3522} viewModeStorageKey={STORAGE_KEY} />)

      const toggle = screen.getByRole("button", { name: /plan/i })
      expect(toggle).toHaveAttribute("aria-pressed", "false")
      expect(MapMock.mock.calls[0][0].pitch).toBe(0)
    })

    it("should tilt the map and persist the choice when switching to relief", () => {
      render(<MapLibreMapImpl lat={48.8566} lng={2.3522} viewModeStorageKey={STORAGE_KEY} />)

      fireEvent.click(screen.getByRole("button", { name: /plan/i }))

      expect(screen.getByRole("button", { name: /relief/i })).toHaveAttribute("aria-pressed", "true")
      expect(mapInstanceBase.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 50 }))
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("relief")
    })

    it("should restore the stored mode on the next mount", () => {
      window.localStorage.setItem(STORAGE_KEY, "relief")

      render(<MapLibreMapImpl lat={48.8566} lng={2.3522} viewModeStorageKey={STORAGE_KEY} />)

      expect(screen.getByRole("button", { name: /relief/i })).toHaveAttribute("aria-pressed", "true")
    })

    it("should let the user go back to flat mode", () => {
      window.localStorage.setItem(STORAGE_KEY, "relief")
      render(<MapLibreMapImpl lat={48.8566} lng={2.3522} viewModeStorageKey={STORAGE_KEY} />)

      fireEvent.click(screen.getByRole("button", { name: /relief/i }))

      expect(screen.getByRole("button", { name: /plan/i })).toHaveAttribute("aria-pressed", "false")
      expect(mapInstanceBase.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 0 }))
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("flat")
    })
  })
})
