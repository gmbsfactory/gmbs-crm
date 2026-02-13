# Utiliser la carte

Guide pour integrer la cartographie et le geocodage dans GMBS-CRM : MapLibre GL, providers de geocodage et composants carte.

---

## Table des matieres

1. [Architecture cartographique](#1-architecture-cartographique)
2. [Composant MapLibreMap](#2-composant-maplibremap)
3. [Service de geocodage](#3-service-de-geocodage)
4. [Hooks geographiques](#4-hooks-geographiques)
5. [Providers de geocodage](#5-providers-de-geocodage)
6. [Integration dans un formulaire](#6-integration-dans-un-formulaire)
7. [Tests](#7-tests)

---

## 1. Architecture cartographique

```
src/
  components/maps/
    MapLibreMap.tsx           # Wrapper avec dynamic import (SSR-safe)
    MapLibreMapImpl.tsx       # Implementation MapLibre GL
  hooks/
    useGeocodeSearch.ts       # Autocompletion d'adresse
    useNearbyArtisans.ts      # Artisans proches par coordonnees
    useAgencyMap.ts           # Carte des agences
  lib/geocode/
    geocode-service.ts        # Service singleton (Strategy Pattern)
    types.ts                  # Types et interfaces
    providers/
      french-address.ts       # API Adresse (BAN) - Priorite 0
      opencage.ts             # OpenCage - Priorite 10
      nominatim.ts            # Nominatim (OSM) - Priorite 20
    utils/
      france-bounds.ts        # Detection adresses francaises
      normalize.ts            # Normalisation et cles de cache
```

**Technologies :**
- MapLibre GL 5.9 pour le rendu cartographique
- MapTiler SDK 3.8 pour les tuiles
- 3 providers de geocodage avec fallback automatique

---

## 2. Composant MapLibreMap

### Import et utilisation

Le composant est charge dynamiquement (pas de SSR) car MapLibre utilise le canvas WebGL :

```typescript
// src/components/maps/MapLibreMap.tsx
"use client"

import dynamic from "next/dynamic"

const MapLibreMapImpl = dynamic(() => import("./MapLibreMapImpl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded border bg-muted">
      Chargement de la carte...
    </div>
  ),
})

export function MapLibreMap(props: MapLibreMapProps) {
  return <MapLibreMapImpl {...props} />
}
```

### Props

```typescript
interface MapLibreMapProps {
  lat: number                  // Latitude du centre
  lng: number                  // Longitude du centre
  zoom?: number                // Niveau de zoom (defaut: 13)
  enable3DBuildings?: boolean  // Batiments 3D
  height?: string              // Hauteur CSS (defaut: "100%")
  className?: string           // Classes CSS additionnelles
  onLocationChange?: (lat: number, lng: number) => void  // Callback au deplacement
  markers?: Array<{            // Marqueurs a afficher
    id?: string
    lat: number
    lng: number
    color?: string
    title?: string
  }>
  circleRadiusKm?: number     // Rayon du cercle (perimetre d'intervention)
  selectedConnection?: {       // Ligne de connexion artisan <-> intervention
    lat: number
    lng: number
    distanceLabel?: string
  }
  onMarkerClick?: (id: string) => void  // Callback au clic sur un marqueur
}
```

### Exemple basique

```tsx
import { MapLibreMap } from "@/components/maps/MapLibreMap"

function InterventionLocation({ lat, lng }) {
  return (
    <div className="h-[300px] w-full rounded-lg overflow-hidden">
      <MapLibreMap
        lat={lat}
        lng={lng}
        zoom={15}
        markers={[{ lat, lng, color: "#3B82F6", title: "Intervention" }]}
      />
    </div>
  )
}
```

### Avec artisans proches et rayon

```tsx
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { useNearbyArtisans } from "@/hooks/useNearbyArtisans"

function InterventionMapWithArtisans({ lat, lng }) {
  const { artisans } = useNearbyArtisans({ lat, lng, radiusKm: 50 })

  const markers = [
    { id: "intervention", lat, lng, color: "#3B82F6", title: "Intervention" },
    ...artisans.map((a) => ({
      id: a.id,
      lat: a.latitude,
      lng: a.longitude,
      color: "#10B981",
      title: a.displayName,
    })),
  ]

  return (
    <div className="h-[400px]">
      <MapLibreMap
        lat={lat}
        lng={lng}
        zoom={11}
        markers={markers}
        circleRadiusKm={50}
        onMarkerClick={(id) => console.log("Clicked:", id)}
      />
    </div>
  )
}
```

---

## 3. Service de geocodage

Le service de geocodage utilise le **Strategy Pattern** pour orchestrer plusieurs providers.

### Architecture

```typescript
// src/lib/geocode/geocode-service.ts
class GeocodeService {
  private static instance: GeocodeService | null = null
  private providers: GeocodeProvider[] = []
  private cache = new Map<string, GeocodeCacheEntry>()

  static getInstance(): GeocodeService { /* ... */ }

  async geocode(query: string, options?): Promise<GeocodeResult[]> {
    // 1. Verifier le cache (TTL: 1 minute)
    // 2. Executer selon le mode (cascade, parallel, first_success)
    // 3. Mettre en cache les resultats
  }
}
```

### Modes d'execution

| Mode | Comportement |
|------|-------------|
| `cascade` (defaut) | Essayer les providers dans l'ordre de priorite, s'arreter au premier succes |
| `parallel` | Lancer tous les providers en parallele, fusionner et dedupliquer les resultats |
| `first_success` | Lancer tous en parallele, retourner le premier resultat non-vide |

### Utilisation directe

```typescript
import { geocodeService } from "@/lib/geocode"

// Geocodage simple
const results = await geocodeService.geocode("12 rue de Rivoli Paris", {
  limit: 5,
})

// Resultat
[{
  lat: 48.8566,
  lng: 2.3522,
  label: "12 Rue de Rivoli, 75001 Paris",
  score: 0.95,
  precision: "housenumber",
  provider: "french-address",
  postcode: "75001",
  city: "Paris",
}]
```

### Type de resultat

```typescript
type GeocodeResult = {
  lat: number
  lng: number
  label: string          // Adresse formatee
  score?: number         // Score de confiance (0-1)
  precision?: string     // Niveau de precision
  provider: string       // Nom du provider
  postcode?: string      // Code postal
  city?: string          // Ville
}
```

---

## 4. Hooks geographiques

### `useGeocodeSearch` - Autocompletion d'adresse

Hook client-side pour la recherche d'adresse avec debounce et suggestions :

```typescript
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"

function AddressInput() {
  const {
    query,           // Valeur courante du champ
    setQuery,        // Setter
    suggestions,     // GeocodeSuggestion[]
    isSuggesting,    // Boolean loading
    clearSuggestions, // Reset
    geocode,         // Geocoder une adresse specifique
  } = useGeocodeSearch({
    minQueryLength: 3,  // Minimum de caracteres avant recherche
    debounceMs: 300,    // Delai anti-rebond
  })

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Saisir une adresse..."
      />
      {isSuggesting && <p>Recherche...</p>}
      <ul>
        {suggestions.map((s, i) => (
          <li key={i} onClick={() => {
            setQuery(s.label)
            clearSuggestions()
            // Utiliser s.lat, s.lng
          }}>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Fonctionnement interne :**
1. L'utilisateur tape dans le champ
2. Apres 300ms de debounce, appel a `/api/geocode?q=...&suggest=1`
3. Les resultats sont affiches en suggestions
4. A la selection, les coordonnees lat/lng sont disponibles
5. L'AbortController annule les requetes obsoletes

### `useNearbyArtisans` - Artisans proches

Retourne les artisans dans un rayon donne autour de coordonnees :

```typescript
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"

const { artisans, isLoading } = useNearbyArtisans({
  lat: 48.8566,
  lng: 2.3522,
  radiusKm: 50,      // Rayon en km (max: defini par MAX_RADIUS_KM)
  metierIds: ["uuid-plomberie"], // Filtrer par metier (optionnel)
})
```

### `useAgencyMap` - Carte des agences

Hook specialise pour la visualisation des agences sur une carte :

```typescript
import { useAgencyMap } from "@/hooks/useAgencyMap"

const { agencies, markers, center, zoom } = useAgencyMap()
```

---

## 5. Providers de geocodage

### API Adresse (BAN) - Priorite 0

- Provider principal pour les adresses francaises
- Gratuit, sans cle API
- Endpoint : `https://api-adresse.data.gouv.fr/search/`
- Autocompletion native

```typescript
// src/lib/geocode/providers/french-address.ts
class FrenchAddressProvider implements GeocodeProvider {
  readonly name = "french-address"
  readonly priority = 0

  isAvailable(): boolean { return true }  // Toujours disponible

  supportsQuery(query: string, options: GeocodeOptions): boolean {
    // Prefere les adresses francaises
    return !options.countryCode || options.countryCode === "fr"
  }
}
```

### OpenCage - Priorite 10

- Provider secondaire, couverture mondiale
- Necessite une cle API (`NEXT_PUBLIC_OPENCAGE_KEY`)
- Utilise si configure et si l'API Adresse ne retourne pas de resultats

```typescript
// src/lib/geocode/providers/opencage.ts
class OpenCageProvider implements GeocodeProvider {
  readonly name = "opencage"
  readonly priority = 10

  isAvailable(): boolean {
    return !!process.env.NEXT_PUBLIC_OPENCAGE_KEY
  }
}
```

### Nominatim (OSM) - Priorite 20

- Fallback universel, toujours disponible
- Base sur OpenStreetMap
- Rate limiting a respecter

```typescript
// src/lib/geocode/providers/nominatim.ts
class NominatimProvider implements GeocodeProvider {
  readonly name = "nominatim"
  readonly priority = 20

  isAvailable(): boolean { return true }
  supportsQuery(): boolean { return true }  // Accepte tout
}
```

### Ajouter un nouveau provider

Implementer l'interface `GeocodeProvider` :

```typescript
// src/lib/geocode/providers/my-provider.ts
import type { GeocodeProvider, GeocodeOptions, GeocodeResult } from "../types"

export class MyProvider implements GeocodeProvider {
  readonly name = "my-provider"
  readonly priority = 15  // Entre OpenCage (10) et Nominatim (20)

  isAvailable(): boolean {
    return !!process.env.NEXT_PUBLIC_MY_GEOCODE_KEY
  }

  supportsQuery(query: string, options: GeocodeOptions): boolean {
    return true
  }

  async geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
    const response = await fetch(`https://api.my-provider.com/geocode?q=${query}`)
    const data = await response.json()

    return data.results.map((r) => ({
      lat: r.lat,
      lng: r.lng,
      label: r.formatted,
      score: r.confidence,
      provider: this.name,
    }))
  }
}
```

Puis l'enregistrer :

```typescript
// src/lib/geocode/geocode-service.ts
import { MyProvider } from "./providers/my-provider"

private initializeDefaultProviders(): void {
  this.registerProvider(new FrenchAddressProvider())
  this.registerProvider(new MyProvider())  // Ajouter ici
  this.registerProvider(new NominatimProvider())
}
```

---

## 6. Integration dans un formulaire

Le formulaire d'intervention utilise le geocodage pour l'autocompletion d'adresse et l'affichage des artisans proches. Voici le flux complet :

```
Saisie adresse -> useGeocodeSearch (debounce 300ms)
  -> Suggestions affichees
    -> Selection d'une suggestion
      -> Coordonnees lat/lng stockees dans le formulaire
        -> useNearbyArtisans(lat, lng, radius)
          -> Liste d'artisans proches affichee
            -> Selection d'un artisan
              -> MapLibreMap mise a jour avec marqueurs + ligne de connexion
```

Ce flux est orchestre par `useInterventionFormState` dans `src/hooks/useInterventionFormState.ts`.

---

## 7. Tests

### Tester le service de geocodage

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GeocodeService } from "@/lib/geocode/geocode-service"

describe("GeocodeService", () => {
  beforeEach(() => {
    GeocodeService.resetInstance() // Reset le singleton
    vi.clearAllMocks()
  })

  it("should return cached results within TTL", async () => {
    const service = GeocodeService.getInstance()
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [{
          properties: { label: "Test", score: 0.9 },
          geometry: { coordinates: [2.35, 48.85] },
        }],
      }),
    })
    global.fetch = mockFetch

    // Premier appel : fetch
    await service.geocode("test")
    // Deuxieme appel : cache
    await service.geocode("test")

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
```

### Tester le hook useGeocodeSearch

```typescript
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"

describe("useGeocodeSearch", () => {
  it("should not search with query shorter than minQueryLength", () => {
    const { result } = renderHook(() =>
      useGeocodeSearch({ minQueryLength: 3 })
    )

    act(() => result.current.setQuery("ab"))

    expect(result.current.suggestions).toEqual([])
  })
})
```
