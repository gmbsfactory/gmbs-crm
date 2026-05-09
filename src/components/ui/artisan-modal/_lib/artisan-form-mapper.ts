import type { Artisan } from "@/lib/api/common/types"
import { normalizeIban } from "@/lib/iban-validation"
import { IBAN_LENGTH } from "./constants"

export type ArtisanWithRelations = Artisan & {
  artisan_metiers?: Array<{
    metier_id: string
    is_primary?: boolean | null
    metiers?: { id: string; code: string | null; label: string | null; color?: string | null } | null
  }>
  artisan_zones?: Array<{
    zone_id: string
    zones?: { id: string; code: string | null; label: string | null } | null
  }>
  artisan_attachments?: Array<{
    id: string
    kind: string
    url: string
    filename: string | null
    created_at?: string | null
    content_hash?: string | null
    derived_sizes?: Record<string, string> | null
    mime_preferred?: string | null
    mime_type?: string | null
  }>
  artisan_absences?: Array<{
    id: string
    start_date: string | null
    end_date: string | null
    reason: string | null
    is_confirmed?: boolean | null
  }>
  commentHistories?: Array<{
    id: string
    comment?: string | null
    modifiedAt?: string | null
    created_at?: string | null
    user?: {
      username?: string | null
      firstname?: string | null
      lastname?: string | null
    } | null
  }>
  statutDossier?: string | null
}

export type ArtisanFormValues = {
  raison_sociale: string
  prenom: string
  nom: string
  telephone: string
  telephone2: string
  email: string
  adresse_intervention: string
  code_postal_intervention: string
  ville_intervention: string
  adresse_siege_social: string
  code_postal_siege_social: string
  ville_siege_social: string
  statut_juridique: string
  siret: string
  iban: string
  metiers: string[]
  zone_intervention: string
  gestionnaire_id: string
  statut_id: string
  numero_associe: string
  intervention_latitude: number | null
  intervention_longitude: number | null
  // Create-only: initial comment captured during artisan creation. Empty string for edit form.
  commentaire_initial: string
}

export const buildDefaultFormValues = (): ArtisanFormValues => ({
  raison_sociale: "",
  prenom: "",
  nom: "",
  telephone: "",
  telephone2: "",
  email: "",
  adresse_intervention: "",
  code_postal_intervention: "",
  ville_intervention: "",
  adresse_siege_social: "",
  code_postal_siege_social: "",
  ville_siege_social: "",
  statut_juridique: "",
  siret: "",
  iban: "",
  metiers: [],
  zone_intervention: "",
  gestionnaire_id: "",
  statut_id: "",
  numero_associe: "",
  intervention_latitude: null,
  intervention_longitude: null,
  commentaire_initial: "",
})

export const mapArtisanToForm = (artisan: ArtisanWithRelations | any): ArtisanFormValues => {
  // Gérer les deux formats possibles : ArtisanWithRelations (avec relations) ou Artisan (format API)
  const artisanAny = artisan as any

  // Extraire les métiers - gérer plusieurs formats possibles
  const metierIds = (() => {
    // Format 1: artisan_metiers avec relations (format attendu par ArtisanWithRelations)
    if (Array.isArray(artisanAny.artisan_metiers)) {
      return artisanAny.artisan_metiers
        .map((item: any) => {
          if (item.metier_id) return item.metier_id
          if (item.metiers?.id) return item.metiers.id
          if (item.metiers?.code) return item.metiers.code
          if (item.metiers?.label) return item.metiers.label
          if (typeof item === "string") return item
          return null
        })
        .filter((value: any): value is string => Boolean(value))
    }

    // Format 2: metiers comme tableau de strings (format retourné par mapArtisanRecord)
    if (Array.isArray(artisanAny.metiers)) {
      return artisanAny.metiers.filter((value: any): value is string => Boolean(value))
    }

    return []
  })()

  // Extraire la zone d'intervention - utiliser zones.code en priorité car les options du Select
  // utilisent les codes ("20", "35", etc.) et non les UUIDs (zone_id)
  const zoneValue = (() => {
    if (Array.isArray(artisanAny.artisan_zones) && artisanAny.artisan_zones.length > 0) {
      const first = artisanAny.artisan_zones[0]
      if (first.zones?.code) return String(first.zones.code)
      if (first.zones?.label) return String(first.zones.label)
      if (first.zone_id) return String(first.zone_id)
    }

    if (Array.isArray(artisanAny.zones) && artisanAny.zones.length > 0) {
      return String(artisanAny.zones[0] ?? "")
    }

    if (artisanAny.zoneIntervention) {
      return String(artisanAny.zoneIntervention)
    }

    return ""
  })()

  return {
    raison_sociale: artisanAny.raison_sociale ?? "",
    prenom: artisanAny.prenom ?? "",
    nom: artisanAny.nom ?? "",
    telephone: artisanAny.telephone ?? "",
    telephone2: artisanAny.telephone2 ?? "",
    email: artisanAny.email ?? "",
    adresse_intervention: artisanAny.adresse_intervention ?? "",
    code_postal_intervention: artisanAny.code_postal_intervention ?? "",
    ville_intervention: artisanAny.ville_intervention ?? "",
    adresse_siege_social: artisanAny.adresse_siege_social ?? "",
    code_postal_siege_social: artisanAny.code_postal_siege_social ?? "",
    ville_siege_social: artisanAny.ville_siege_social ?? "",
    statut_juridique: artisanAny.statut_juridique ?? "",
    siret: artisanAny.siret ?? "",
    // Normaliser l'IBAN en majuscules dès le mapping pour éviter que le toUpperCase()
    // dans le onChange du InputOTP ne marque le champ comme modifié
    iban: (artisanAny.iban ?? "").toUpperCase(),
    metiers: metierIds,
    zone_intervention: zoneValue,
    gestionnaire_id: artisanAny.gestionnaire_id ?? "",
    statut_id: artisanAny.statut_id ?? "",
    numero_associe: artisanAny.numero_associe ?? "",
    intervention_latitude: artisanAny.intervention_latitude ?? null,
    intervention_longitude: artisanAny.intervention_longitude ?? null,
    commentaire_initial: "",
  }
}

// Create payload: looser SIRET handling and always-include metiers/zones arrays
// so the API can clear them. Matches the historical NewArtisanModalContent behavior.
export const buildCreatePayload = (values: ArtisanFormValues) => {
  const metiers = (values.metiers ?? []).filter(Boolean)
  const zones = values.zone_intervention ? [values.zone_intervention] : []

  return {
    prenom: values.prenom || undefined,
    nom: values.nom || undefined,
    raison_sociale: values.raison_sociale || undefined,
    telephone: values.telephone || undefined,
    telephone2: values.telephone2 || undefined,
    email: values.email || undefined,
    adresse_siege_social: values.adresse_siege_social || undefined,
    code_postal_siege_social: values.code_postal_siege_social || undefined,
    ville_siege_social: values.ville_siege_social || undefined,
    statut_juridique: values.statut_juridique || undefined,
    siret: values.siret || undefined,
    iban: normalizeIban(values.iban),
    metiers,
    zones,
    gestionnaire_id: values.gestionnaire_id || undefined,
    statut_id: values.statut_id || undefined,
    numero_associe: values.numero_associe || undefined,
    intervention_latitude: values.intervention_latitude ?? undefined,
    intervention_longitude: values.intervention_longitude ?? undefined,
  }
}

export const buildUpdatePayload = (values: ArtisanFormValues) => {
  // Normaliser le SIRET : soit vide, soit exactement 14 chiffres
  const normalizedSiret = (() => {
    const siret = values.siret?.trim() || ""
    if (siret.length === 0) return undefined
    if (siret.length === 14 && /^\d+$/.test(siret)) return siret
    return undefined
  })()

  const normalizedIban = (() => {
    const iban = values.iban?.replace(/\s/g, "").toUpperCase() || ""
    if (iban.length === 0) return undefined
    if (iban.length !== IBAN_LENGTH) return undefined
    if (!/^[A-Z0-9]+$/.test(iban)) return undefined
    return iban
  })()

  return {
    raison_sociale: values.raison_sociale || undefined,
    prenom: values.prenom || undefined,
    nom: values.nom || undefined,
    telephone: values.telephone || undefined,
    telephone2: values.telephone2 || undefined,
    email: values.email || undefined,
    adresse_intervention: values.adresse_intervention || undefined,
    code_postal_intervention: values.code_postal_intervention || undefined,
    ville_intervention: values.ville_intervention || undefined,
    adresse_siege_social: values.adresse_siege_social || undefined,
    code_postal_siege_social: values.code_postal_siege_social || undefined,
    ville_siege_social: values.ville_siege_social || undefined,
    statut_juridique: values.statut_juridique || undefined,
    siret: normalizedSiret,
    iban: normalizedIban,
    zones: values.zone_intervention ? [values.zone_intervention] : [],
    metiers: values.metiers ?? [],
    gestionnaire_id: values.gestionnaire_id || undefined,
    statut_id: values.statut_id || undefined,
    numero_associe: values.numero_associe || undefined,
    intervention_latitude: values.intervention_latitude ?? undefined,
    intervention_longitude: values.intervention_longitude ?? undefined,
  }
}
