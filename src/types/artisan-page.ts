/**
 * Shared types for the Artisans page and its sub-components.
 * Accessible via @/types/artisan-page from any file.
 *
 * Runtime code (configs, helpers, mappers) has been moved to:
 * - @/config/artisan-ui (statusConfig, dossierStatusConfig, color helpers)
 * - @/lib/artisan/mappers (mapArtisanToContact)
 */

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
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export {
  VIRTUAL_STATUS_DOSSIER_A_COMPLETER,
  statusConfig,
  dossierStatusConfig,
  hexToRgba,
  computeBadgeStyle,
  getStatusColor,
  getDossierStatusColor,
} from "@/config/artisan-ui"

export { mapArtisanToContact } from "@/lib/artisan/mappers"
