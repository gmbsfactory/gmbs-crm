"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Mode de rendu de la carte.
 *
 * - `flat`   : vue a plat, sans extrusion des batiments. Le moins couteux en tuiles
 *              et en GPU, et le defaut pour toute carte affichee en permanence.
 * - `relief` : camera inclinee + batiments 3D. Plus lisible pour situer une adresse
 *              dans son bati, mais charge une empreinte de tuiles nettement plus large
 *              (champ proche haute resolution + trainee vers l'horizon, plus les
 *              tuiles z>=15 imposees par l'extrusion).
 */
export type MapViewMode = "flat" | "relief"

const VALID_MODES: readonly MapViewMode[] = ["flat", "relief"]

/** Inclinaison appliquee en mode relief, en degres. */
export const RELIEF_PITCH_DEGREES = 50

export function isMapViewMode(value: unknown): value is MapViewMode {
  return typeof value === "string" && VALID_MODES.includes(value as MapViewMode)
}

function readStoredMode(storageKey: string | undefined): MapViewMode | null {
  if (!storageKey || typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(storageKey)
    return isMapViewMode(stored) ? stored : null
  } catch {
    // localStorage indisponible (SSR, mode prive, cookies bloques) : on retombe
    // simplement sur le mode par defaut plutot que de casser le rendu de la carte.
    return null
  }
}

/**
 * Mode de rendu de la carte, memorise entre deux ouvertures.
 *
 * @param storageKey Cle localStorage. Passer une cle portant l'id utilisateur pour
 *                   que la preference soit propre a chaque compte. Si elle est
 *                   `undefined`, le mode reste en memoire sans etre persiste.
 * @param defaultMode Mode utilise tant qu'aucune preference n'a ete enregistree.
 */
export function useMapViewMode(
  storageKey: string | undefined,
  defaultMode: MapViewMode = "flat",
): [MapViewMode, (mode: MapViewMode) => void] {
  // Lecture des le premier rendu : sans cela, un utilisateur ayant choisi "relief"
  // verrait la carte se monter a plat puis basculer. `readStoredMode` renvoie null
  // hors navigateur, donc un consommateur rendu cote serveur retombe sur le defaut.
  const [mode, setMode] = useState<MapViewMode>(() => readStoredMode(storageKey) ?? defaultMode)

  useEffect(() => {
    const stored = readStoredMode(storageKey)
    setMode(stored ?? defaultMode)
  }, [storageKey, defaultMode])

  const updateMode = useCallback(
    (nextMode: MapViewMode) => {
      setMode(nextMode)
      if (!storageKey || typeof window === "undefined") return
      try {
        window.localStorage.setItem(storageKey, nextMode)
      } catch {
        // Preference non persistee : le mode reste actif pour la session en cours.
      }
    },
    [storageKey],
  )

  return [mode, updateMode]
}
