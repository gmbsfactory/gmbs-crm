/**
 * Journal des actions d'un artisan — **module pur** (spécification §4.3, lot L6).
 *
 * Le modal artisan doit répondre à une question simple : *qui a fait quoi, et
 * quand*. Les états (prix accepté, chantier démarré, rapport envoyé) vivent sur
 * `intervention_artisans` et `artisan_reports` ; la frise, elle, se lit dans
 * `artisan_portal_actions` (99079), append-only.
 *
 * **Deux sources, et c'est délibéré.** Le journal ne remonte qu'aux actions
 * postérieures à sa mise en service : les rapports envoyés avant lui n'y sont
 * pas, et la frise afficherait « prix accepté » sans jamais « rapport envoyé »
 * sur les dossiers existants. On dérive donc les envois de rapport d'
 * `artisan_reports.submitted_at`, en écartant ceux que le journal porte déjà
 * (déduplication par `report_id`). La dérivation est un **repli de lecture** :
 * elle n'écrit rien et ne remplace pas l'écriture du journal par les routes.
 */

export type TimelineSource = 'portal' | 'crm' | 'derived'

export interface ArtisanTimelineEvent {
  id: string
  action_type: string
  occurred_at: string
  recorded_at: string | null
  source: TimelineSource
  /** Identité lisible de l'auteur du geste ; jamais `null` en pratique. */
  actor: string | null
  intervention: { id: string | null; id_inter: string | null } | null
  report_id: string | null
  attachment_id: string | null
  payload: Record<string, unknown>
}

/** Libellés affichés dans la frise, alignés sur le CHECK fermé de 99079. */
export const TIMELINE_LABELS: Record<string, string> = {
  PRICE_ACCEPTED: 'Prix accepté',
  PRICE_REFUSED: 'Prix refusé',
  WORK_STARTED: 'Chantier démarré',
  REPORT_SUBMITTED: 'Rapport envoyé',
  REPORT_REPLACED: 'Rapport remplacé',
  REPORT_APPROVED: 'Rapport validé',
  REPORT_REJECTED: 'Rapport refusé',
  PHOTO_UPLOADED: 'Photo déposée',
  DOCUMENT_UPLOADED: 'Pièce déposée',
  DOCUMENT_APPROVED: 'Pièce validée',
  DOCUMENT_REJECTED: 'Pièce refusée',
  AVATAR_CHANGED: 'Photo de profil modifiée',
  DECHARGE_SIGNED: 'Décharge signée',
}

/** Origine du geste, telle qu'affichée en clair à côté de l'acteur. */
export const SOURCE_LABELS: Record<TimelineSource, string> = {
  portal: 'depuis l’application',
  crm: 'saisi au CRM',
  derived: 'depuis l’application',
}

/** Ligne brute d'`artisan_portal_actions`, jointures comprises. */
export interface TimelineJournalRow {
  id: string
  action_type: string
  source: string | null
  occurred_at: string
  recorded_at: string | null
  payload: Record<string, unknown> | null
  report_id: string | null
  attachment_id: string | null
  intervention?: { id: string; id_inter: string | null } | { id: string; id_inter: string | null }[] | null
  actor?:
    | { firstname: string | null; lastname: string | null; username: string | null; email: string | null }
    | { firstname: string | null; lastname: string | null; username: string | null; email: string | null }[]
    | null
}

/** Rapport lu pour le repli de dérivation. */
export interface TimelineReportRow {
  id: string
  intervention_id: string | null
  version: number | null
  status: string | null
  submitted_at: string | null
  intervention?: { id: string; id_inter: string | null } | { id: string; id_inter: string | null }[] | null
}

function un<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

/**
 * Identité de l'acteur, dans cet ordre : le compte joint, puis la copie
 * immuable `payload.actor`, puis un repli explicite.
 *
 * L'ordre compte : `actor_user_id` est `ON DELETE SET NULL`, donc la jointure
 * disparaît avec le compte — c'est exactement la dérive d'`artisan_audit_log`
 * (92 % de lignes sans acteur). `payload.actor` a été recopié à l'écriture
 * pour cela.
 */
export function resolveTimelineActor(row: TimelineJournalRow, artisanLabel: string): string {
  const user = un(row.actor)
  if (user) {
    const nom = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
    const identite = nom || user.username || user.email
    if (identite) return identite
  }
  const copie = row.payload?.actor
  if (typeof copie === 'string' && copie.trim()) return copie.trim()
  return row.source === 'crm' ? 'un gestionnaire' : artisanLabel
}

/** Projette une ligne de journal en événement de frise. */
export function mapJournalRow(row: TimelineJournalRow, artisanLabel: string): ArtisanTimelineEvent {
  const intervention = un(row.intervention)
  const payload = row.payload ?? {}
  const denormalisee = payload.intervention as { id?: string; id_inter?: string | null } | undefined

  return {
    id: row.id,
    action_type: row.action_type,
    occurred_at: row.occurred_at,
    recorded_at: row.recorded_at,
    source: row.source === 'crm' ? 'crm' : 'portal',
    actor: resolveTimelineActor(row, artisanLabel),
    // L'intervention peut avoir été supprimée (`ON DELETE SET NULL`) : la
    // référence dénormalisée dans `payload` reste alors la seule lisible.
    intervention: intervention
      ? { id: intervention.id, id_inter: intervention.id_inter }
      : denormalisee
        ? { id: denormalisee.id ?? null, id_inter: denormalisee.id_inter ?? null }
        : null,
    report_id: row.report_id,
    attachment_id: row.attachment_id,
    payload,
  }
}

/**
 * Envois de rapport dérivés d'`artisan_reports`, pour les rapports que le
 * journal ne porte pas (antérieurs à sa mise en service).
 */
export function deriveReportEvents(
  reports: readonly TimelineReportRow[],
  dejaJournalises: ReadonlySet<string>,
  artisanLabel: string,
): ArtisanTimelineEvent[] {
  const events: ArtisanTimelineEvent[] = []
  for (const report of reports) {
    if (!report.submitted_at || dejaJournalises.has(report.id)) continue
    const intervention = un(report.intervention)
    events.push({
      id: `report:${report.id}`,
      action_type: 'REPORT_SUBMITTED',
      occurred_at: report.submitted_at,
      recorded_at: report.submitted_at,
      source: 'derived',
      actor: artisanLabel,
      intervention: intervention ? { id: intervention.id, id_inter: intervention.id_inter } : null,
      report_id: report.id,
      attachment_id: null,
      payload: { version: report.version, status: report.status },
    })
  }
  return events
}

/** Fusionne journal et dérivations, du plus récent au plus ancien. */
export function mergeTimelineEvents(
  journal: readonly ArtisanTimelineEvent[],
  derived: readonly ArtisanTimelineEvent[],
  limit: number,
): ArtisanTimelineEvent[] {
  return [...journal, ...derived]
    .sort((a, b) => {
      const parOccurrence = (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '')
      if (parOccurrence !== 0) return parOccurrence
      // À occurrence égale, l'horodatage serveur tranche : c'est lui qui fait
      // foi pour l'audit (une horloge de téléphone peut être fausse).
      return (b.recorded_at ?? '').localeCompare(a.recorded_at ?? '')
    })
    .slice(0, limit)
}

export const TIMELINE_DEFAULT_LIMIT = 50
export const TIMELINE_MAX_LIMIT = 200

/** Lit `?limit=` en le bornant : une frise n'est pas un export. */
export function parseTimelineLimit(raw: string | null | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return TIMELINE_DEFAULT_LIMIT
  return Math.min(Math.floor(n), TIMELINE_MAX_LIMIT)
}

/** Détail lisible d'un événement (montant accepté, motif de refus, nom de pièce…). */
export function timelineDetail(event: ArtisanTimelineEvent): string | null {
  const p = event.payload ?? {}
  switch (event.action_type) {
    case 'PRICE_ACCEPTED': {
      const montant = typeof p.amount === 'number' ? p.amount : typeof p.accepted_amount === 'number' ? p.accepted_amount : null
      return montant === null ? null : `${montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT`
    }
    case 'PRICE_REFUSED':
      return typeof p.reason === 'string' && p.reason.trim() ? p.reason.trim() : null
    case 'REPORT_SUBMITTED':
    case 'REPORT_REPLACED':
      return typeof p.version === 'number' ? `version ${p.version}` : null
    case 'DOCUMENT_UPLOADED':
    case 'DOCUMENT_APPROVED':
    case 'DOCUMENT_REJECTED': {
      const kind = typeof p.kind === 'string' ? p.kind : null
      const motif = typeof p.comment === 'string' && p.comment.trim() ? p.comment.trim() : null
      return [kind, motif].filter(Boolean).join(' — ') || null
    }
    default:
      return null
  }
}

/** Libellé d'un type d'action, avec repli sur le code brut. */
export function timelineLabel(actionType: string): string {
  return TIMELINE_LABELS[actionType] ?? actionType
}
