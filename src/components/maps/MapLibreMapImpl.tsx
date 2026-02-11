"use client"

import { useEffect, useRef, useState } from "react"
import { config as maptilerConfig } from "@maptiler/sdk"
import maplibregl from "maplibre-gl"
import "@maptiler/sdk/dist/maptiler-sdk.css"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection } from "geojson"

import { cn } from "@/lib/utils"

import type { MapLibreMapProps } from "./MapLibreMap"

export function MapLibreMapImpl({
  lat,
  lng,
  zoom = 14,
  enable3DBuildings = true,
  onLocationChange,
  height = "400px",
  className,
  markers = [],
  circleRadiusKm,
  selectedConnection,
  onMarkerClick,
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const artisanMarkersRef = useRef<maplibregl.Marker[]>([])
  const circleSourceIdRef = useRef(`intervention-circle-${Math.random().toString(36).slice(2)}`)
  const circleFillLayerIdRef = useRef(`${circleSourceIdRef.current}-fill`)
  const circleOutlineLayerIdRef = useRef(`${circleSourceIdRef.current}-outline`)
  const connectionSourceIdRef = useRef(`intervention-connection-${Math.random().toString(36).slice(2)}`)
  const connectionLineLayerIdRef = useRef(`${connectionSourceIdRef.current}-line`)
  const connectionLabelLayerIdRef = useRef(`${connectionSourceIdRef.current}-label`)
  const initialCenterRef = useRef<[number, number]>([lng, lat])
  const [error, setError] = useState<string | null>(null)
  const onLocationChangeRef = useRef<MapLibreMapProps["onLocationChange"]>(onLocationChange)
  const onMarkerClickRef = useRef<MapLibreMapProps["onMarkerClick"]>(onMarkerClick)

  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY

  useEffect(() => {
    if (!containerRef.current) return

    if (!maptilerKey) {
      setError("Clé MapTiler manquante")
      return
    }

    try {
      if (maptilerKey && maptilerConfig.apiKey !== maptilerKey) {
        maptilerConfig.apiKey = maptilerKey
      }

      const mapInstance = new maplibregl.Map({
        container: containerRef.current,
        style: `https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`,
        center: initialCenterRef.current,
        zoom,
        pitch: 50,
        bearing: -17.6,
        antialias: true,
      } as maplibregl.MapOptions)

      mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")

      const markerInstance = new maplibregl.Marker({
        color: "#d90429",
        draggable: Boolean(onLocationChangeRef.current),
      })
        .setLngLat(initialCenterRef.current)
        .addTo(mapInstance)

      markerInstance.getElement().style.cursor = onLocationChangeRef.current ? "grab" : "pointer"

      if (onLocationChangeRef.current) {
        markerInstance.on("dragend", () => {
          const position = markerInstance.getLngLat()
          const handler = onLocationChangeRef.current
          handler?.(position.lat, position.lng)
        })
      }

      const handleLoad = () => {
        if (
          ensureCircleLayers(
            mapInstance,
            circleSourceIdRef.current,
            circleFillLayerIdRef.current,
            circleOutlineLayerIdRef.current,
          )
        ) {
          const circleSource = mapInstance.getSource(circleSourceIdRef.current) as maplibregl.GeoJSONSource | undefined
          if (circleSource) {
            circleSource.setData(
              circleRadiusKm && circleRadiusKm > 0
                ? circleFeatureCollection(lat, lng, circleRadiusKm)
                : emptyCircleFeatureCollection(),
            )
          }
        }

        ensureConnectionLayers(
          mapInstance,
          connectionSourceIdRef.current,
          connectionLineLayerIdRef.current,
          connectionLabelLayerIdRef.current,
        )
        const connectionSource = mapInstance.getSource(connectionSourceIdRef.current) as maplibregl.GeoJSONSource | undefined
        if (connectionSource) {
          connectionSource.setData(emptyConnectionFeatureCollection())
        }

        if (enable3DBuildings) {
          add3DBuildingsLayer(mapInstance)
        }

        fitMapToCurrentExtent(mapInstance, lat, lng, circleRadiusKm, selectedConnection)
      }

      mapInstance.on("style.load", handleLoad)
      mapInstance.on("load", handleLoad)

      mapInstance.on("error", (event) => {
        console.error("[MapLibre] map error:", event?.error ?? event)
        setError("Impossible de charger la carte")
      })

      mapRef.current = mapInstance
      markerRef.current = markerInstance

      return () => {
        // Copier les valeurs des refs dans des variables locales pour le cleanup
        // Note: On copie les valeurs au moment du cleanup, pas au moment de l'exécution de l'effet
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const circleOutlineLayerId = circleOutlineLayerIdRef.current
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const circleFillLayerId = circleFillLayerIdRef.current
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const circleSourceId = circleSourceIdRef.current
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const connectionLabelLayerId = connectionLabelLayerIdRef.current
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const connectionLineLayerId = connectionLineLayerIdRef.current
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const connectionSourceId = connectionSourceIdRef.current
        
        if (mapInstance.isStyleLoaded()) {
          const existingOutlineLayer = mapInstance.getLayer(circleOutlineLayerId)
          if (existingOutlineLayer) {
            mapInstance.removeLayer(circleOutlineLayerId)
          }
          const existingFillLayer = mapInstance.getLayer(circleFillLayerId)
          if (existingFillLayer) {
            mapInstance.removeLayer(circleFillLayerId)
          }
          const existingCircleSource = mapInstance.getSource(circleSourceId)
          if (existingCircleSource) {
            mapInstance.removeSource(circleSourceId)
          }

          const existingConnectionLabelLayer = mapInstance.getLayer(connectionLabelLayerId)
          if (existingConnectionLabelLayer) {
            mapInstance.removeLayer(connectionLabelLayerId)
          }
          const existingConnectionLineLayer = mapInstance.getLayer(connectionLineLayerId)
          if (existingConnectionLineLayer) {
            mapInstance.removeLayer(connectionLineLayerId)
          }
          const existingConnectionSource = mapInstance.getSource(connectionSourceId)
          if (existingConnectionSource) {
            mapInstance.removeSource(connectionSourceId)
          }
        }
        markerInstance.remove()
        artisanMarkersRef.current.forEach((existingMarker) => existingMarker.remove())
        artisanMarkersRef.current = []
        mapInstance.remove()
      }
    } catch (err) {
      console.error("[MapLibre] Initialization error:", err)
      setError("Impossible de charger la carte")
    }
    // Note: Ce useEffect ne doit s'exécuter qu'une seule fois lors de l'initialisation de la carte
    // Les valeurs lat, lng, zoom, circleRadiusKm, enable3DBuildings, selectedConnection sont gérées
    // par des useEffect séparés pour éviter les réinitialisations inutiles de la carte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maptilerKey])

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
    const markerInstance = markerRef.current
    if (!markerInstance) return
    markerInstance.setDraggable(Boolean(onLocationChange))
  }, [onLocationChange])

  useEffect(() => {
    const mapInstance = mapRef.current
    const markerInstance = markerRef.current
    if (!mapInstance || !markerInstance) return

    const nextCenter: [number, number] = [lng, lat]
    markerInstance.setLngLat(nextCenter)
    mapInstance.easeTo({ center: nextCenter, zoom, duration: 500 })
  }, [lat, lng, zoom])

  useEffect(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    artisanMarkersRef.current.forEach((existingMarker) => existingMarker.remove())
    artisanMarkersRef.current = []

    if (!markers || markers.length === 0) {
      return
    }

    const createdMarkers: maplibregl.Marker[] = markers
      .filter(
        (markerCandidate) =>
          Number.isFinite(markerCandidate.lat) && Number.isFinite(markerCandidate.lng),
      )
      .map((markerCandidate) => {
        const markerOptions: maplibregl.MarkerOptions = {}
        if (markerCandidate.color) {
          markerOptions.color = markerCandidate.color
        }

        const marker = new maplibregl.Marker(markerOptions).setLngLat([markerCandidate.lng, markerCandidate.lat])

        if (!markerOptions.color && markerCandidate.color && typeof (marker as any).setColor === "function") {
          ;(marker as any).setColor(markerCandidate.color)
        }

        marker.getElement().style.cursor = "pointer"

        let hoverPopup: maplibregl.Popup | null = null
        if (markerCandidate.title) {
          hoverPopup = new maplibregl.Popup({
            offset: 18,
            closeButton: false,
            closeOnClick: false,
          }).setHTML(
            `<div style="font-size:12px;font-weight:600;color:#111827;">${markerCandidate.title}</div>`,
          )
        }

        marker.addTo(mapInstance)

        const el = marker.getElement()
        
        // Ajouter le gestionnaire de clic si onMarkerClick est fourni et que l'ID existe
        if (onMarkerClickRef.current && markerCandidate.id) {
          el.addEventListener("click", () => {
            onMarkerClickRef.current?.(markerCandidate.id!)
          })
        }

        if (hoverPopup) {
          const showPopup = () => {
            hoverPopup!.addTo(mapInstance)
            hoverPopup!.setLngLat([markerCandidate.lng, markerCandidate.lat])
          }
          const hidePopup = () => {
            hoverPopup!.remove()
          }

          el.addEventListener("mouseenter", showPopup)
          el.addEventListener("mouseleave", hidePopup)
        }

        return marker
      })

    artisanMarkersRef.current = createdMarkers
  }, [markers])

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
  }, [onMarkerClick])

  useEffect(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    // ⚠️ Attendre que le style soit chargé avant de manipuler les couches
    if (!mapInstance.isStyleLoaded()) {
      return
    }

    const hasLayer = Boolean(mapInstance.getLayer("3d-buildings"))
    if (enable3DBuildings && !hasLayer) {
      add3DBuildingsLayer(mapInstance)
    }

    if (!enable3DBuildings && hasLayer) {
      mapInstance.removeLayer("3d-buildings")
    }
  }, [enable3DBuildings])

  useEffect(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    runWhenStyleLoaded(mapInstance, () => {
      if (
        !ensureCircleLayers(
          mapInstance,
          circleSourceIdRef.current,
          circleFillLayerIdRef.current,
          circleOutlineLayerIdRef.current,
        )
      ) {
        return
      }

      const source = mapInstance.getSource(circleSourceIdRef.current) as maplibregl.GeoJSONSource | undefined
      if (!source) {
        return
      }

      if (!circleRadiusKm || circleRadiusKm <= 0) {
        source.setData(emptyCircleFeatureCollection())
        return
      }

      source.setData(circleFeatureCollection(lat, lng, circleRadiusKm))
    })
  }, [lat, lng, circleRadiusKm])

  useEffect(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    runWhenStyleLoaded(mapInstance, () => {
      if (
        !ensureConnectionLayers(
          mapInstance,
          connectionSourceIdRef.current,
          connectionLineLayerIdRef.current,
          connectionLabelLayerIdRef.current,
        )
      ) {
        return
      }

      const source = mapInstance.getSource(connectionSourceIdRef.current) as maplibregl.GeoJSONSource | undefined
      if (!source) return

      if (!selectedConnection) {
        source.setData(emptyConnectionFeatureCollection())
        return
      }

      source.setData(
        connectionFeatureCollection(
          lat,
          lng,
          selectedConnection.lat,
          selectedConnection.lng,
          selectedConnection.distanceLabel ?? "",
        ),
      )
    })
  }, [lat, lng, selectedConnection])

  useEffect(() => {
    const mapInstance = mapRef.current
    if (!mapInstance) return

    fitMapToCurrentExtent(mapInstance, lat, lng, circleRadiusKm, selectedConnection)
  }, [lat, lng, circleRadiusKm, selectedConnection])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded border border-destructive/30 bg-destructive/10 px-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return <div ref={containerRef} className={cn("w-full overflow-hidden rounded-lg", className)} style={{ height }} />
}

export default MapLibreMapImpl

function add3DBuildingsLayer(map: maplibregl.Map) {
  if (map.getLayer("3d-buildings")) {
    return
  }

  // ⚠️ Vérifier que le style est chargé avant de continuer
  if (!map.isStyleLoaded()) {
    console.warn("[MapLibre] Style not loaded yet, cannot add 3D buildings")
    return
  }

  const style = map.getStyle()
  
  // ⚠️ Double vérification que le style existe (sécurité)
  if (!style || !style.layers) {
    console.warn("[MapLibre] Style is undefined or has no layers")
    return
  }

  const firstSymbolLayerId = style.layers?.find((layer) => layer.type === "symbol")?.id

  const sourceId = "openmaptiles"
  const sourceLayer = "building"

  const hasSource = Boolean(style.sources?.[sourceId])
  if (!hasSource) {
    console.warn("[MapLibre] 3D building source not found in style")
    return
  }

  map.addLayer(
    {
      id: "3d-buildings",
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": sourceLayer,
      minzoom: 15,
      filter: ["==", ["get", "extrude"], "true"],
      paint: {
        "fill-extrusion-color": "#aaa",
        "fill-extrusion-height": [
          "case",
          ["has", "height"],
          ["to-number", ["get", "height"]],
          ["has", "levels"],
          ["*", ["to-number", ["get", "levels"]], 3],
          10,
        ],
        "fill-extrusion-base": [
          "case",
          ["has", "min_height"],
          ["to-number", ["get", "min_height"]],
          0,
        ],
        "fill-extrusion-opacity": 0.8,
      },
    },
    firstSymbolLayerId,
  )
}

function emptyCircleFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  }
}

function circleFeatureCollection(lat: number, lng: number, radiusKm: number, steps = 128): FeatureCollection {
  const coordinates: [number, number][] = []
  const earthRadiusKm = 6371
  const angularDistance = radiusKm / earthRadiusKm
  const latitudeRad = (lat * Math.PI) / 180
  const longitudeRad = (lng * Math.PI) / 180

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI

    const pointLatRad = Math.asin(
      Math.sin(latitudeRad) * Math.cos(angularDistance) +
        Math.cos(latitudeRad) * Math.sin(angularDistance) * Math.cos(bearing),
    )

    const pointLngRad =
      longitudeRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRad),
        Math.cos(angularDistance) - Math.sin(latitudeRad) * Math.sin(pointLatRad),
      )

    coordinates.push([(pointLngRad * 180) / Math.PI, (pointLatRad * 180) / Math.PI])
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
        properties: {},
      },
    ],
  }
}

function ensureCircleLayers(
  map: maplibregl.Map,
  sourceId: string,
  fillLayerId: string,
  outlineLayerId: string,
): boolean {
  if (!map.isStyleLoaded()) {
    return false
  }

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: emptyCircleFeatureCollection(),
    })
  }

  if (!map.getLayer(fillLayerId)) {
    map.addLayer({
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#2563eb",
        "fill-opacity": 0.08,
      },
    })
  }

  if (!map.getLayer(outlineLayerId)) {
    map.addLayer({
      id: outlineLayerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#2563eb",
        "line-opacity": 0.4,
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    })
  }

  return true
}

function ensureConnectionLayers(
  map: maplibregl.Map,
  sourceId: string,
  lineLayerId: string,
  labelLayerId: string,
): boolean {
  if (!map.isStyleLoaded()) {
    return false
  }

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data: emptyConnectionFeatureCollection(),
    })
  }

  if (!map.getLayer(lineLayerId)) {
    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      filter: ["==", ["get", "featureType"], "connection-line"],
      paint: {
        "line-color": "#f97316",
        "line-width": 2,
        "line-dasharray": [1.5, 1.5],
      },
    })
  }

  if (!map.getLayer(labelLayerId)) {
    map.addLayer({
      id: labelLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["==", ["get", "featureType"], "connection-label"],
      layout: {
        "text-field": ["get", "labelText"],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": 12,
        "text-offset": [0, -1],
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "rgba(255,255,255,0.85)",
        "text-halo-width": 1,
      },
    })
  }

  return true
}

function connectionFeatureCollection(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  distanceLabel: string,
): FeatureCollection {
  const midpoint = midpointCoordinates(lat1, lng1, lat2, lng2)

  const features: FeatureCollection["features"] = [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [lng1, lat1],
          [lng2, lat2],
        ],
      },
      properties: {
        featureType: "connection-line",
      },
    },
  ]

  if (distanceLabel) {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [midpoint.lng, midpoint.lat],
      },
      properties: {
        featureType: "connection-label",
        labelText: distanceLabel,
      },
    })
  }

  return {
    type: "FeatureCollection",
    features,
  }
}

function emptyConnectionFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  }
}

function midpointCoordinates(lat1: number, lng1: number, lat2: number, lng2: number) {
  const lat1Rad = toRadians(lat1)
  const lat2Rad = toRadians(lat2)
  const lngDiffRad = toRadians(lng2 - lng1)

  const bx = Math.cos(lat2Rad) * Math.cos(lngDiffRad)
  const by = Math.cos(lat2Rad) * Math.sin(lngDiffRad)

  const latMidRad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) ** 2 + by ** 2),
  )
  const lngMidRad = toRadians(lng1) + Math.atan2(by, Math.cos(lat1Rad) + bx)

  return {
    lat: toDegrees(latMidRad),
    lng: toDegrees(lngMidRad),
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI
}

function fitMapToCurrentExtent(
  map: maplibregl.Map,
  lat: number,
  lng: number,
  circleRadiusKm?: number,
  selectedConnection?: { lat: number; lng: number },
) {
  const targetLat = selectedConnection?.lat
  const targetLng = selectedConnection?.lng
  const hasTarget = Number.isFinite(targetLat) && Number.isFinite(targetLng)
  const hasCircle = !hasTarget && circleRadiusKm != null && circleRadiusKm > 0

  runWhenStyleLoaded(map, () => {
    if (hasTarget && targetLat != null && targetLng != null) {
      const bounds = new maplibregl.LngLatBounds([lng, lat], [lng, lat])
      bounds.extend([targetLng, targetLat])
      map.fitBounds(bounds, {
        padding: 600,
        duration: 600,
        maxZoom: 24,
      })
    } else if (hasCircle && circleRadiusKm) {
      const bounds = boundsFromCircle(lat, lng, circleRadiusKm)
      map.fitBounds(bounds, {
        padding: 20,
        duration: 600,
      })
    }
  })
}

function boundsFromCircle(lat: number, lng: number, radiusKm: number) {
  const earthRadiusKm = 6371
  const angularDistance = radiusKm / earthRadiusKm
  const latRad = toRadians(lat)

  const minLat = Math.max(latRad - angularDistance, -Math.PI / 2)
  const maxLat = Math.min(latRad + angularDistance, Math.PI / 2)

  const cosLat = Math.cos(latRad)
  const safeCosLat = Math.abs(cosLat) < 1e-6 ? 1e-6 * Math.sign(cosLat || 1) : cosLat
  const sinDistance = Math.sin(Math.min(angularDistance, Math.PI - 1e-6))
  const ratio = sinDistance / safeCosLat
  const clampedRatio = Math.min(1, Math.max(-1, ratio))
  const deltaLng = Math.asin(clampedRatio)

  const minLng = toRadians(lng) - deltaLng
  const maxLng = toRadians(lng) + deltaLng

  return new maplibregl.LngLatBounds(
    [toDegrees(minLng), toDegrees(minLat)],
    [toDegrees(maxLng), toDegrees(maxLat)],
  )
}

function runWhenStyleLoaded(map: maplibregl.Map, callback: () => void) {
  if (map.isStyleLoaded()) {
    callback()
  } else {
    map.once("load", callback)
  }
}
