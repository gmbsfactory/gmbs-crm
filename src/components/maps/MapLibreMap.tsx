"use client"

import dynamic from "next/dynamic"

export interface MapLibreMapProps {
  lat: number
  lng: number
  zoom?: number
  enable3DBuildings?: boolean
  onLocationChange?: (lat: number, lng: number) => void
  height?: string
  className?: string
  markers?: Array<{
    id?: string
    lat: number
    lng: number
    color?: string
    title?: string
  }>
  circleRadiusKm?: number
  selectedConnection?: {
    lat: number
    lng: number
    distanceLabel?: string
  }
  onMarkerClick?: (id: string) => void
}

const MapLibreMapImpl = dynamic(() => import("./MapLibreMapImpl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded border border-muted-foreground/10 bg-muted text-sm text-muted-foreground">
      Chargement de la carte...
    </div>
  ),
})

export function MapLibreMap(props: MapLibreMapProps) {
  return <MapLibreMapImpl {...props} />
}
