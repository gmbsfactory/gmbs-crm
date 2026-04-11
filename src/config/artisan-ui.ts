/**
 * UI configuration for artisan statuses.
 * Tailwind class maps for status badges and dossier statuses.
 */

import type { Contact } from "@/types/artisan-page"

/** Virtual status for "Dossier a completer" filter */
export const VIRTUAL_STATUS_DOSSIER_A_COMPLETER = "Dossier à compléter"

export const statusConfig = {
  Disponible: {
    label: "Disponible",
    color: "bg-green-100 text-green-700 border-green-200",
    activeColor: "bg-green-500 text-white",
  },
  En_intervention: {
    label: "En intervention",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    activeColor: "bg-yellow-500 text-white",
  },
  Indisponible: {
    label: "Indisponible",
    color: "bg-red-100 text-red-700 border-red-200",
    activeColor: "bg-red-500 text-white",
  },
  En_congé: {
    label: "En congé",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    activeColor: "bg-blue-500 text-white",
  },
  Inactif: {
    label: "Inactif",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    activeColor: "bg-gray-500 text-white",
  },
} as const

export const dossierStatusConfig = {
  Actif: {
    label: "Actif",
    color: "bg-green-100 text-green-800",
  },
  En_cours: {
    label: "En cours",
    color: "bg-yellow-100 text-yellow-800",
  },
  Archivé: {
    label: "Archivé",
    color: "bg-gray-100 text-gray-800",
  },
  Suspendu: {
    label: "Suspendu",
    color: "bg-red-100 text-red-800",
  },
} as const

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Compute badge style with custom color */
export function computeBadgeStyle(color?: string | null) {
  if (!color) {
    return {
      backgroundColor: "#f1f5f9",
      color: "#0f172a",
      borderColor: "#e2e8f0",
    }
  }
  return {
    backgroundColor: hexToRgba(color, 0.28) ?? "#f1f5f9",
    color,
    borderColor: color,
  }
}

export const getStatusColor = (status: Contact["status"]) => {
  const colors: Record<string, string> = {
    Disponible: "bg-green-100 text-green-800",
    En_intervention: "bg-yellow-100 text-yellow-800",
    Indisponible: "bg-red-100 text-red-800",
    En_congé: "bg-blue-100 text-blue-800",
    Inactif: "bg-gray-100 text-gray-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

export const getDossierStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    Actif: "bg-green-100 text-green-800",
    En_cours: "bg-yellow-100 text-yellow-800",
    Archivé: "bg-gray-100 text-gray-800",
    Suspendu: "bg-red-100 text-red-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}
