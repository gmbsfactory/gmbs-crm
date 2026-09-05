import type { SupabaseClient } from '@supabase/supabase-js'
import {
  listPortalInterventions,
  type PortalInterventionListItem,
  type PortalPaymentProjection,
} from '@/lib/portal-external/interventions'

/**
 * Espace documentaire de l'artisan — `GET /me/library` (spécification §4.2, lot L6).
 *
 * **Pourquoi une route dédiée, et pas une agrégation côté écran** : le portail
 * ne reçoit `documents` que dans la réponse *détail* d'une mission, et
 * `usePortalQuery` n'a ni cache ni déduplication. Reconstituer « tous mes
 * devis et toutes mes factures » depuis l'application coûterait une requête par
 * mission, rejouée à chaque événement temps réel.
 *
 * **La règle de confidentialité tient dans une liste blanche** : l'artisan voit
 * les devis qui lui ont été envoyés et **ses** factures d'artisan. Jamais les
 * factures GMBS (le prix payé par le client, donc la marge), jamais les
 * factures de matériel. La liste ci-dessous est donc fermée, et le filtre est
 * appliqué **deux fois** : dans la requête SQL et à la projection — une requête
 * modifiée par mégarde ne doit pas suffire à faire fuiter une facture GMBS.
 */

/** Seuls types de pièce d'intervention exposables à l'artisan. */
export const PORTAL_LIBRARY_KINDS = ['devis', 'facturesArtisans'] as const

export type PortalLibraryKind = (typeof PORTAL_LIBRARY_KINDS)[number]

/** Vrai si ce type de pièce peut être remis à l'artisan. */
export function isPortalLibraryKind(kind: string | null | undefined): kind is PortalLibraryKind {
  return !!kind && (PORTAL_LIBRARY_KINDS as readonly string[]).includes(kind)
}

export interface PortalLibraryDocument {
  id: string
  kind: PortalLibraryKind
  filename: string | null
  mime_type: string | null
  file_size: number | null
  created_at: string | null
  url: string
}

export interface PortalLibraryGroup {
  intervention: {
    id: string
    id_inter: string | null
    adresse: string | null
    ville: string | null
    statut_code: string | null
    date: string | null
  }
  documents: PortalLibraryDocument[]
  /** Paiement de CET artisan ; `null` hors mission terminée (§4.2.1). */
  payment: PortalPaymentProjection | null
}

export interface PortalLibraryResponse {
  groups: PortalLibraryGroup[]
  counts: { devis: number; factures: number }
}

/** Ligne brute d'`intervention_attachments` telle que lue par la route. */
export interface LibraryAttachmentRow {
  id: string
  intervention_id: string
  kind: string | null
  filename: string | null
  mime_type: string | null
  file_size: number | null
  created_at: string | null
  url: string
}

const SELECT = 'id, intervention_id, kind, filename, mime_type, file_size, created_at, url'

/**
 * Regroupe les pièces par mission — **fonction pure**, testable sans base.
 *
 * Une mission sans pièce ne produit aucun groupe : un écran « Mes documents »
 * rempli de missions vides n'apprend rien à l'artisan. Les missions sont déjà
 * filtrées par la règle de visibilité (§7.1) puisqu'elles viennent de
 * `listPortalInterventions` : une mission qu'il ne peut pas voir ne peut pas
 * rendre ses pièces par ce biais.
 */
export function groupLibraryDocuments(
  missions: readonly PortalInterventionListItem[],
  rows: readonly LibraryAttachmentRow[],
): PortalLibraryResponse {
  const parMission = new Map<string, PortalLibraryDocument[]>()
  let devis = 0
  let factures = 0

  for (const row of rows) {
    // Second filtre, volontairement redondant avec le `.in()` de la requête.
    if (!isPortalLibraryKind(row.kind)) continue
    const liste = parMission.get(row.intervention_id) ?? []
    liste.push({
      id: row.id,
      kind: row.kind,
      filename: row.filename,
      mime_type: row.mime_type,
      file_size: row.file_size,
      created_at: row.created_at,
      url: row.url,
    })
    parMission.set(row.intervention_id, liste)
    if (row.kind === 'devis') devis += 1
    else factures += 1
  }

  const groups: PortalLibraryGroup[] = []
  for (const mission of missions) {
    const documents = parMission.get(mission.id)
    if (!documents || documents.length === 0) continue
    // Le devis d'abord, puis la facture ; à type égal, la plus récente en tête.
    documents.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'devis' ? -1 : 1
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
    groups.push({
      intervention: {
        id: mission.id,
        id_inter: mission.id_inter,
        adresse: mission.adresse,
        ville: mission.ville,
        statut_code: mission.statut_code,
        date: mission.date_prevue ?? mission.date,
      },
      documents,
      payment: mission.payment,
    })
  }

  // De la mission la plus récente à la plus ancienne : l'artisan cherche
  // d'abord la dernière facture qu'il a déposée.
  groups.sort((a, b) => (b.intervention.date ?? '').localeCompare(a.intervention.date ?? ''))
  return { groups, counts: { devis, factures } }
}

/**
 * Devis reçus et factures déposées par l'artisan, toutes missions confondues.
 * Les missions sont relues par `listPortalInterventions` pour hériter **sans
 * duplication** de la règle de visibilité et de la projection de paiement.
 */
export async function listPortalLibrary(
  supabase: SupabaseClient,
  artisanId: string,
): Promise<PortalLibraryResponse> {
  const missions = await listPortalInterventions(supabase, artisanId)
  const ids = missions.map((m) => m.id)
  if (ids.length === 0) return { groups: [], counts: { devis: 0, factures: 0 } }

  const { data, error } = await supabase
    .from('intervention_attachments')
    .select(SELECT)
    .in('intervention_id', ids)
    .in('kind', PORTAL_LIBRARY_KINDS as unknown as string[])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Lecture des documents impossible : ${error.message}`)
  }
  return groupLibraryDocuments(missions, (data ?? []) as LibraryAttachmentRow[])
}
