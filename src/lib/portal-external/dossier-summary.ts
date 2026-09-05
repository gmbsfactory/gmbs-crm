import { REQUIRED_DOCUMENT_KINDS, countRequiredDocuments } from '@/lib/artisans/dossierStatus'

/**
 * Compteurs du dossier et avatar renvoyés par `GET /me` — **module pur**
 * (spécification §4.2 et §6.2, complété au lot L6).
 *
 * `present` ne suffit pas à l'application : le bouton Profil porte une pastille
 * dès qu'une pièce **manque**, est **en attente de vérification** ou a été
 * **refusée**, et l'écran Profil distingue « déposée » de « validée ». C'est
 * exactement la demande D16 : sans `pending` ni `rejected`, l'artisan relance
 * le gestionnaire pour rien.
 *
 * Le comptage porte sur **la pièce la plus récente de chaque type requis**, et
 * non sur toutes les lignes : chaque dépôt crée une ligne (jamais d'écrasement),
 * un Kbis refusé puis redéposé compterait sinon à la fois en « refusée » et en
 * « en attente ». La photo de profil n'est pas une pièce du dossier et n'entre
 * dans aucun compteur.
 */

/** Pièces du dossier, hors `photo_profil`. */
export const DOSSIER_KINDS: readonly string[] = [...REQUIRED_DOCUMENT_KINDS, 'autre']

export interface DossierAttachmentRow {
  id: string
  artisan_id?: string | null
  kind: string | null
  url?: string | null
  review_status?: string | null
  created_at?: string | null
  derived_sizes?: Record<string, string> | null
}

export interface DossierCounters {
  required: number
  present: number
  pending: number
  rejected: number
}

export interface PortalAvatar {
  url: string
  sizes: Record<string, string>
}

function normalizeKind(kind: string | null | undefined): string {
  return (kind ?? '').toLowerCase().trim()
}

/** Pièce la plus récente pour chaque type requis (une ligne par dépôt). */
function derniereParKind(rows: readonly DossierAttachmentRow[]): Map<string, DossierAttachmentRow> {
  const derniere = new Map<string, DossierAttachmentRow>()
  for (const row of rows) {
    const kind = normalizeKind(row.kind)
    if (!REQUIRED_DOCUMENT_KINDS.map((k) => k.toLowerCase()).includes(kind)) continue
    const connue = derniere.get(kind)
    if (!connue || (row.created_at ?? '') > (connue.created_at ?? '')) derniere.set(kind, row)
  }
  return derniere
}

/**
 * Compteurs `{ required, present, pending, rejected }` du dossier.
 * `present` reste calculé par `countRequiredDocuments` — la règle « une pièce
 * est présente » appartient au CRM et ne doit pas être réécrite ici.
 */
export function summarizeDossier(rows: readonly DossierAttachmentRow[] | null | undefined): DossierCounters {
  const liste = rows ?? []
  const derniere = derniereParKind(liste)
  let pending = 0
  let rejected = 0
  for (const row of derniere.values()) {
    if (row.review_status === 'pending') pending += 1
    else if (row.review_status === 'rejected') rejected += 1
  }
  return {
    required: REQUIRED_DOCUMENT_KINDS.length,
    present: countRequiredDocuments(
      liste.map((r) => ({ id: r.id, artisan_id: r.artisan_id ?? '', kind: r.kind ?? '', url: r.url ?? '' })),
    ),
    pending,
    rejected,
  }
}

/**
 * Avatar de l'artisan : la ligne `photo_profil` **la plus récente**.
 *
 * Le tri est explicite parce que deux lignes peuvent coexister sur une base
 * antérieure au correctif de la route `POST /me/profile-photo` — et
 * `useArtisanDerivedData` prend, lui, la première venue : c'est l'origine de
 * l'« avatar aléatoire ». Ici, la plus récente gagne toujours.
 */
export function pickAvatar(rows: readonly DossierAttachmentRow[] | null | undefined): PortalAvatar | null {
  let choisie: DossierAttachmentRow | null = null
  for (const row of rows ?? []) {
    if (normalizeKind(row.kind) !== 'photo_profil' || !row.url) continue
    if (!choisie || (row.created_at ?? '') > (choisie.created_at ?? '')) choisie = row
  }
  if (!choisie?.url) return null
  return { url: choisie.url, sizes: choisie.derived_sizes ?? {} }
}
