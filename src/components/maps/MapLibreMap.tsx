"use client"

import dynamic from "next/dynamic"

export interface MapLibreMapProps {
  lat: number
  lng: number
  zoom?: number
  /** Inclinaison de la camera en degres. 0 (defaut) = vue a plat : une vue inclinee
   *  charge une empreinte de tuiles bien plus large. */
  pitch?: number
  /** Extrusion 3D des batiments. Desactivee par defaut : elle force le chargement
   *  des tuiles z>=15 sur toute la vue. */
  enable3DBuildings?: boolean
  /** Affiche le selecteur Plan / Relief et memorise le choix sous cette cle
   *  localStorage. Passer une cle portant l'id utilisateur pour que la preference
   *  soit propre a chaque compte. Omise, le selecteur n'est pas affiche et les
   *  props `pitch` / `enable3DBuildings` pilotent seules le rendu. */
  viewModeStorageKey?: string
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
