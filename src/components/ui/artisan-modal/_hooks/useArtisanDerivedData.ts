"use client"

import { useMemo } from "react"
import type { ArtisanWithRelations } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type MetierRef = {
  id: string
  code: string | null
  label: string | null
  color?: string | null
}

type ReferenceData = {
  metiers?: MetierRef[]
}

type MetierOption = { id: string; label: string; color: string | null }

/**
 * Pure transformations derived from an artisan + reference data.
 * Kept in a hook (rather than inline memos) so the modal component
 * stays focused on layout and lifecycle wiring.
 */
export function useArtisanDerivedData(
  artisan: ArtisanWithRelations | undefined,
  referenceData: ReferenceData | null | undefined,
) {
  const displayName = useMemo(() => {
    if (!artisan) return "Artisan"
    const fromName = [artisan.prenom, artisan.nom].filter(Boolean).join(" ").trim()
    return fromName || (artisan as any)?.plain_nom || artisan.raison_sociale || "Artisan"
  }, [artisan])

  const photoProfilMetadata = useMemo(() => {
    if (!artisan?.artisan_attachments) return null
    const photoProfilAttachment = artisan.artisan_attachments.find(
      (att) => att.kind === "photo_profil",
    )
    if (!photoProfilAttachment) return null

    return {
      hash: photoProfilAttachment.content_hash || null,
      sizes: photoProfilAttachment.derived_sizes || {},
      mime_preferred:
        photoProfilAttachment.mime_preferred || photoProfilAttachment.mime_type || "image/jpeg",
      baseUrl: photoProfilAttachment.url || null,
    }
  }, [artisan])

  const avatarInitials = useMemo(() => {
    if (!artisan) return "??"
    const prenom = artisan.prenom?.trim() || ""
    const nom = artisan.nom?.trim() || ""
    if (prenom && nom) {
      return `${prenom[0]}${nom[0]}`.toUpperCase()
    }
    if (prenom) return prenom.substring(0, 2).toUpperCase()
    if (nom) return nom.substring(0, 2).toUpperCase()
    if (artisan.raison_sociale) return artisan.raison_sociale.substring(0, 2).toUpperCase()
    return "??"
  }, [artisan])

  const attachmentCount = useMemo(() => {
    const raw = artisan?.artisan_attachments
    if (!Array.isArray(raw)) return 0
    return raw.filter((attachment) => Boolean(attachment?.url)).length
  }, [artisan?.artisan_attachments])

  const metierOptions = useMemo<MetierOption[]>(() => {
    const base: MetierOption[] = (referenceData?.metiers ?? []).map((metier) => ({
      id: metier.id,
      label: metier.label ?? metier.code ?? metier.id,
      color: metier.color ?? null,
    }))

    const extraFromArtisan: MetierOption[] = (() => {
      if (Array.isArray(artisan?.artisan_metiers)) {
        return artisan.artisan_metiers
          .map((item) => {
            const id =
              item.metier_id || item.metiers?.id || item.metiers?.code || item.metiers?.label
            const label = item.metiers?.label || item.metiers?.code || item.metier_id
            const color = item.metiers?.color ?? null
            if (!id) return null
            return { id, label: label ?? id, color }
          })
          .filter((value): value is MetierOption => Boolean(value))
      }
      if (Array.isArray((artisan as any)?.metiers)) {
        return ((artisan as any).metiers as unknown[])
          .filter((value): value is string => Boolean(value))
          .map((value) => ({ id: value, label: value, color: null }))
      }
      return []
    })()

    const merged = [...base]
    extraFromArtisan.forEach((item) => {
      if (!merged.some((existing) => existing.id === item.id)) {
        merged.push(item)
      }
    })
    return merged
  }, [artisan, referenceData])

  const fullArtisanAddress = useMemo(() => {
    if (!artisan) return ""
    const a = artisan as any
    return [a.adresse_siege_social, a.code_postal_siege_social, a.ville_siege_social]
      .filter(Boolean)
      .join(", ")
  }, [artisan])

  const companyName = artisan?.raison_sociale ?? null

  return {
    displayName,
    photoProfilMetadata,
    avatarInitials,
    attachmentCount,
    metierOptions,
    fullArtisanAddress,
    companyName,
  }
}
