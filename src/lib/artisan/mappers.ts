/**
 * Mapping functions for artisan data transformations.
 */

import type { Artisan as ApiArtisan } from "@/lib/api/v2"
import type { Contact, ReferenceUser, ArtisanStatus } from "@/types/artisan-page"

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
