/**
 * Shared types and helpers for the Artisans page and its sub-components.
 * Accessible via @/types/artisan-page from any file.
 */

import type { Artisan as ApiArtisan } from "@/lib/api/v2"

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Contact = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  position: string
  status: "Disponible" | "En_intervention" | "Indisponible" | "En_congé" | "Inactif"
  avatar: string
  photoProfilUrl?: string | null
  photoProfilMetadata?: {
    hash: string | null
    sizes: Record<string, string>
    mime_preferred: string
    baseUrl: string | null
  } | null
  artisanInitials?: string
  lastContact: string
  createdAt: string
  notes: string
  siret?: string
  statutJuridique?: string
  statutArtisan?: string
  statutArtisanColor?: string | null
  zoneIntervention?: string | number
  adresse?: string
  adresseIntervention?: string
  metiers?: string[]
  statutDossier?: string
  statutInactif?: boolean
  attribueA?: string
  gestionnaireInitials?: string
  gestionnaireColor?: string | null
  gestionnaire_id?: string | null
  gestionnaireAvatarUrl?: string | null
  gestionnaireFirstname?: string | null
  gestionnaireLastname?: string | null
}

export type ReferenceUser = {
  id: string
  firstname: string | null
  lastname: string | null
  code_gestionnaire: string | null
  color?: string | null
  avatar_url?: string | null
}

export type ArtisanStatus = {
  id: string
  code: string
  label: string
  color: string | null
  is_active?: boolean
  is_virtual?: boolean
}

export type MetierRef = {
  id: string
  code: string
  label: string
  color: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Map an ApiArtisan to a Contact used by the UI */
export const mapArtisanToContact = (
  artisan: ApiArtisan,
  users: ReferenceUser[],
  artisanStatuses: ArtisanStatus[],
): Contact => {
  const raw = artisan as unknown as Record<string, unknown>
  const user = users.find((u) => u.id === artisan.gestionnaire_id)
  const artisanStatus = artisanStatuses.find((s) => s.id === artisan.statut_id)

  if (!artisanStatus && artisan.statut_id) {
    console.warn(`[mapArtisanToContact] Statut non trouve pour artisan ${artisan.id}:`, {
      artisanStatutId: artisan.statut_id,
      availableStatusIds: artisanStatuses.map((s) => s.id),
      availableStatusCodes: artisanStatuses.map((s) => s.code),
    })
  }

  const zones = raw.zones as string[] | undefined
  const zone = Array.isArray(zones) && zones.length > 0 ? zones[0] : (raw.zoneIntervention as string | number | undefined)

  const gestionnaireInitials = user
    ? ((user.firstname?.[0] || "") + (user.lastname?.[0] || "")).toUpperCase() ||
      user.code_gestionnaire?.substring(0, 2).toUpperCase() ||
      "??"
    : "\u2014"

  const photoProfilUrl = artisan.photoProfilBaseUrl || null
  const photoProfilMetadata = artisan.photoProfilMetadata || null

  const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
  const artisanInitials =
    artisanName
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??"

  const metiersRaw = raw.metiers as string | string[] | undefined

  return {
    id: artisan.id,
    name: artisanName,
    email: artisan.email || "",
    phone: artisan.telephone || "",
    company: artisan.raison_sociale || "",
    position: Array.isArray(metiersRaw) ? metiersRaw.join(", ") : (metiersRaw as string) || "",
    status: ((raw.statut_artisan as string) ?? (raw.status as string) ?? "Disponible") as Contact["status"],
    avatar: photoProfilUrl || "/placeholder.svg",
    photoProfilUrl,
    photoProfilMetadata,
    artisanInitials,
    lastContact: (raw.date_ajout as string) || artisan.updated_at || "",
    createdAt: artisan.created_at || (raw.date_ajout as string) || "",
    notes: (raw.commentaire as string) || "",
    siret: artisan.siret || "",
    statutJuridique: artisan.statut_juridique || "",
    statutArtisan: artisanStatus?.label || "",
    statutArtisanColor: artisanStatus?.color || null,
    zoneIntervention: (zone as string | number) ?? "",
    adresse: `${artisan.adresse_siege_social || ""}, ${artisan.code_postal_siege_social || ""} ${artisan.ville_siege_social || ""}`.trim(),
    adresseIntervention: `${artisan.adresse_intervention || ""}, ${artisan.code_postal_intervention || ""} ${artisan.ville_intervention || ""}`.trim(),
    metiers: Array.isArray(metiersRaw) ? metiersRaw : metiersRaw ? [metiersRaw] : [],
    statutDossier: artisan.statutDossier || "",
    statutInactif: Boolean(raw.statut_inactif),
    attribueA: user
      ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.code_gestionnaire || "Non assigne"
      : "Non assigne",
    gestionnaireInitials,
    gestionnaireColor: user?.color || null,
    gestionnaire_id: artisan.gestionnaire_id ?? null,
    gestionnaireAvatarUrl: user?.avatar_url || null,
    gestionnaireFirstname: user?.firstname || null,
    gestionnaireLastname: user?.lastname || null,
  }
}
