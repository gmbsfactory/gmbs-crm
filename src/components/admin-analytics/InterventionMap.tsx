"use client"

import { useMemo, useCallback } from "react"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import { useInterventionModal } from "@/hooks/useInterventionModal"

interface InterventionMapProps {
    interventions: {
        id: string
        address: string
        status: string
        metier: string
        lat?: number
        lng?: number
    }[] | undefined
    isLoading: boolean
}

interface GeocodedMarker {
    id: string
    lat: number
    lng: number
    color: string
    title: string
}

export function InterventionMap({ interventions, isLoading }: InterventionMapProps) {
    const { open: openInterventionModal } = useInterventionModal()

    // Gestionnaire de clic sur les marqueurs pour ouvrir le modal en vue latérale
    const handleMarkerClick = useCallback((interventionId: string) => {
        openInterventionModal(interventionId, {
            modeOverride: "halfpage", // Vue latérale uniquement
            layoutId: `map-marker-${interventionId}`,
        })
    }, [openInterventionModal])

    // Utiliser directement les données de géocodage depuis la base de données
    const markers = useMemo<GeocodedMarker[]>(() => {
        if (!interventions || interventions.length === 0) return []

        return interventions
            .filter((intervention) => 
                intervention.lat != null && 
                intervention.lng != null &&
                Number.isFinite(intervention.lat) && 
                Number.isFinite(intervention.lng)
            )
            .map((intervention) => ({
                id: intervention.id,
                lat: intervention.lat!,
                lng: intervention.lng!,
                color: getColorForStatus(intervention.status),
                title: `${intervention.metier} - ${intervention.status}`
            }))
    }, [interventions])

    // Calculer le centre de la carte basé sur les marqueurs
    const mapCenter = useMemo(() => {
        if (markers.length === 0) {
            return { lat: 46.603354, lng: 1.888334, zoom: 5 } // Centre de la France par défaut
        }

        const avgLat = markers.reduce((sum, m) => sum + m.lat, 0) / markers.length
        const avgLng = markers.reduce((sum, m) => sum + m.lng, 0) / markers.length

        // Calculer le zoom adaptatif basé sur la dispersion des points
        const latRange = Math.max(...markers.map(m => m.lat)) - Math.min(...markers.map(m => m.lat))
        const lngRange = Math.max(...markers.map(m => m.lng)) - Math.min(...markers.map(m => m.lng))
        const maxRange = Math.max(latRange, lngRange)
        
        let zoom = 5
        if (maxRange > 10) zoom = 4
        else if (maxRange > 5) zoom = 5
        else if (maxRange > 2) zoom = 6
        else if (maxRange > 1) zoom = 7
        else if (maxRange > 0.5) zoom = 8
        else zoom = 9

        return { lat: avgLat, lng: avgLng, zoom }
    }, [markers])

    if (isLoading) {
        return <div className="h-[400px] w-full animate-pulse bg-muted rounded-xl" />
    }

    const interventionsWithCoords = interventions?.filter(i => i.lat != null && i.lng != null).length || 0
    const totalInterventions = interventions?.length || 0

    return (
        <Card className="col-span-7">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    Carte des Interventions
                </CardTitle>
                <CardDescription>
                    {interventionsWithCoords} interventions géolocalisées sur {totalInterventions}
                    {interventionsWithCoords < totalInterventions && (
                        <span className="text-muted-foreground ml-1">
                            ({totalInterventions - interventionsWithCoords} sans coordonnées)
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="h-[500px] w-full relative">
                    <MapLibreMap
                        lat={mapCenter.lat}
                        lng={mapCenter.lng}
                        zoom={mapCenter.zoom}
                        markers={markers}
                        className="rounded-b-xl"
                        onMarkerClick={handleMarkerClick}
                    />
                </div>
            </CardContent>
        </Card>
    )
}

function getColorForStatus(status: string): string {
    switch (status) {
        case 'TERMINE': return '#22c55e' // Green
        case 'EN_COURS': return '#3b82f6' // Blue
        case 'ACCEPTE': return '#8b5cf6' // Purple
        case 'DEVIS_ENVOYE': return '#f59e0b' // Amber
        case 'DEMANDE': return '#64748b' // Slate
        default: return '#ef4444' // Red
    }
}
