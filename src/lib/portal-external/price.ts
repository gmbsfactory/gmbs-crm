import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findRecordedAction,
  normalizeOccurredAt,
  recordArtisanAction,
  type EventEnvelope,
} from './actions'
import { isPriceAllowedStatus } from './interventions'
import { resolveReminderTarget, upsertPortalReminder } from './reminders'

/**
 * Réponse de l'artisan au prix proposé — `POST /me/interventions/{id}/price`
 * (spécification §4.2) et son repli gestionnaire
 * `PATCH /api/interventions/{id}/artisans/{artisanId}/price` (§4.3).
 *
 * Trois règles structurent ce module :
 *  - **verrou optimiste** : le corps porte le montant que l'artisan a sous les
 *    yeux (`amount_seen`). S'il ne correspond plus au coût SST courant, on
 *    répond `409 price_changed` avec le montant réel. L'artisan ne s'engage
 *    jamais sur un montant qu'il n'a pas vu ;
 *  - **montant gelé** : `price_accepted_amount` fige le prix au moment du oui.
 *    Sans ce gel, la modale e-mail peut modifier le coût SST a posteriori sans
 *    trace de ce qui a été accepté ;
 *  - **la réponse n'est jamais reprise par l'artisan** (§7.3) : seul le
 *    gestionnaire peut la réécrire, avec trace au journal.
 *
 * Cette route ne change **jamais** le statut de l'intervention : `ACCEPTE`
 * signifie « le **client** a accepté le devis GMBS », ce qui n'est pas le geste
 * de l'artisan.
 */

const MAX_REASON_LENGTH = 500

export type PriceResponse = 'accepted' | 'refused'

export interface PriceResponseInput {
  response: PriceResponse
  amount_seen: number
  reason: string | null
}

export type PriceBodyValidation =
  | { ok: true; value: PriceResponseInput }
  | { ok: false; error: string }

/** Valide et normalise le corps commun aux deux routes (portail et repli CRM). */
export function validatePriceBody(body: Record<string, unknown>): PriceBodyValidation {
  const response = body.response
  if (response !== 'accepted' && response !== 'refused') {
    return { ok: false, error: "response must be 'accepted' or 'refused'" }
  }

  const raw = body.amount_seen ?? body.amount
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, error: 'amount_seen required' }
  }
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'amount_seen invalid' }
  }

  const rawReason = body.reason
  if (rawReason !== undefined && rawReason !== null && typeof rawReason !== 'string') {
    return { ok: false, error: 'reason must be a string' }
  }
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, MAX_REASON_LENGTH) : ''

  return { ok: true, value: { response, amount_seen: round2(amount), reason: reason || null } }
}

/** Arrondi à deux décimales : `intervention_costs.amount` est un `NUMERIC(12,2)`. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export interface PricePayload {
  response: PriceResponse | null
  responded_at: string | null
  accepted_amount: number | null
  refused_reason: string | null
  source: 'portal' | 'crm' | null
}

export type PriceActionResult =
  | { status: 200; body: { price: PricePayload; replayed?: boolean } }
  | { status: 404 | 409 | 500; body: { error: string; current_amount?: number } }

interface AssignmentRow {
  id: string
  price_response: string | null
  price_responded_at: string | null
  price_accepted_amount: number | string | null
  price_refused_reason: string | null
  price_response_source: string | null
}

interface InterventionRow {
  id: string
  id_inter: string | null
  adresse: string | null
  assigned_user_id: string | null
  is_active: boolean | null
  statut: { code: string | null } | { code: string | null }[] | null
}

function statusCode(row: InterventionRow): string | null {
  const s = row.statut
  if (!s) return null
  return Array.isArray(s) ? s[0]?.code ?? null : s.code ?? null
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toPayload(row: AssignmentRow): PricePayload {
  const response = row.price_response === 'accepted' || row.price_response === 'refused' ? row.price_response : null
  const source = row.price_response_source === 'crm' || row.price_response_source === 'portal' ? row.price_response_source : null
  return {
    response,
    responded_at: row.price_responded_at,
    accepted_amount: toNumber(row.price_accepted_amount),
    refused_reason: row.price_refused_reason,
    source,
  }
}

/**
 * Coût SST de **cet** artisan, résolu par `artisan_order` : sur une intervention
 * à deux artisans, chacun ne voit que le sien (Q8 de la spécification).
 * `null` = aucun prix posé — il n'y a rien à accepter.
 */
export async function readSstCost(
  supabase: SupabaseClient,
  interventionId: string,
  order: number,
): Promise<number | null> {
  const { data } = await supabase
    .from('intervention_costs')
    .select('amount, artisan_order')
    .eq('intervention_id', interventionId)
    .eq('cost_type', 'sst')
  const rows = (data ?? []) as { amount: number | string; artisan_order: number | null }[]
  const exact = rows.find((r) => (r.artisan_order ?? 1) === order)
  const chosen = exact ?? (rows.length === 1 ? rows[0] : undefined)
  const amount = chosen ? toNumber(chosen.amount) : null
  return amount === null ? null : round2(amount)
}

export interface RespondToPriceParams {
  supabase: SupabaseClient
  artisanId: string
  interventionId: string
  input: PriceResponseInput
  source: 'portal' | 'crm'
  /** Acteur, requis côté CRM (contrainte `artisan_portal_actions_acteur_check`). */
  actor?: { userId: string | null; label: string | null }
  /** Enveloppe d'idempotence — absente pour une saisie au CRM. */
  envelope?: EventEnvelope | null
  /**
   * Autorise la réécriture d'une réponse déjà donnée. Faux pour l'artisan
   * (§7.3 : il ne reprend jamais sa réponse), vrai pour le gestionnaire
   * (Q5 : (b) le gestionnaire corrige, avec trace).
   */
  allowOverwrite?: boolean
}

/** Traite une réponse au prix ; renvoie le code HTTP et le corps à retourner. */
export async function respondToPrice(params: RespondToPriceParams): Promise<PriceActionResult> {
  const { supabase, artisanId, interventionId, input, source } = params
  const envelope = params.envelope ?? null

  // 1. Rejeu hors ligne : même (artisan, event_uid) ⇒ 200 avec l'état enregistré,
  //    jamais 409. Le téléphone renvoie sa file d'attente sans rien dupliquer.
  if (envelope) {
    const deja = await findRecordedAction(supabase, artisanId, envelope.event_uid)
    if (deja) {
      const current = await loadAssignment(supabase, interventionId, artisanId)
      if (!current) return { status: 404, body: { error: 'Intervention not found' } }
      return { status: 200, body: { price: toPayload(current), replayed: true } }
    }
  }

  // 2. Affectation : 404 uniforme, jamais 403 révélateur.
  const assignment = await loadAssignment(supabase, interventionId, artisanId)
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const { data: interventionRow } = await supabase
    .from('interventions')
    .select('id, id_inter, adresse, assigned_user_id, is_active, statut:intervention_statuses!statut_id ( code )')
    .eq('id', interventionId)
    .maybeSingle()
  const intervention = interventionRow as unknown as InterventionRow | null
  if (!intervention || intervention.is_active === false) {
    return { status: 404, body: { error: 'Intervention not found' } }
  }

  // 3. Le prix ne se négocie qu'en DEVIS_ENVOYE.
  if (!isPriceAllowedStatus(statusCode(intervention))) {
    return { status: 409, body: { error: 'status_not_allowed' } }
  }

  // 4. Une réponse déjà donnée n'est reprise que par le gestionnaire.
  if (assignment.price_response && !params.allowOverwrite) {
    return { status: 409, body: { error: 'price_already_answered' } }
  }

  // 5. Coût SST posé pour cet artisan.
  const order = await resolveArtisanOrder(supabase, interventionId, artisanId)
  const current = await readSstCost(supabase, interventionId, order)
  if (current === null) {
    return { status: 409, body: { error: 'price_unavailable' } }
  }

  // 6. Verrou optimiste : l'artisan ne s'engage jamais sur un montant qu'il n'a
  //    pas vu. Vaut aussi pour un refus : si le prix a bougé, il doit revoir le
  //    nouveau montant avant de le refuser.
  if (round2(input.amount_seen) !== current) {
    return { status: 409, body: { error: 'price_changed', current_amount: current } }
  }

  const respondedAt = new Date().toISOString()
  const accepted = input.response === 'accepted'
  const { data: updated, error } = await supabase
    .from('intervention_artisans')
    .update({
      price_response: input.response,
      price_responded_at: respondedAt,
      // Montant GELÉ au moment du oui ; effacé sur un refus, il n'y a rien à geler.
      price_accepted_amount: accepted ? current : null,
      price_refused_reason: accepted ? null : input.reason,
      price_response_source: source,
      price_response_by: params.actor?.userId ?? null,
    })
    .eq('id', assignment.id)
    .select('id, price_response, price_responded_at, price_accepted_amount, price_refused_reason, price_response_source')
    .single()

  if (error || !updated) {
    console.error('[portal-external] Réponse au prix non enregistrée :', error?.message)
    return { status: 500, body: { error: 'Failed to save price response' } }
  }

  const clock = normalizeOccurredAt(envelope?.occurred_at_declared ?? null)
  await recordArtisanAction(supabase, {
    artisanId,
    actionType: accepted ? 'PRICE_ACCEPTED' : 'PRICE_REFUSED',
    source,
    interventionId,
    actorUserId: params.actor?.userId ?? null,
    actorLabel: params.actor?.label ?? null,
    intervention: { id: intervention.id, id_inter: intervention.id_inter, adresse: intervention.adresse },
    payload: { amount: current, reason: accepted ? null : input.reason },
    envelope,
    clock,
  })

  // 7. Un refus est une file de travail pour le gestionnaire : il faut proposer
  //    la mission à un autre artisan (§7.2). Une acceptation ne crée rien.
  if (!accepted) {
    const target = await resolveReminderTarget(supabase, intervention.assigned_user_id)
    if (target) {
      const idInter = intervention.id_inter || `INT-${interventionId.slice(0, 8)}`
      const motif = input.reason ? ` — ${input.reason}` : ''
      await upsertPortalReminder(supabase, {
        interventionId,
        target,
        marker: PRICE_REMINDER_MARKER,
        note: `@${target.username || 'gestionnaire'} ${PRICE_REMINDER_MARKER} de l'inter #${idInter} refusé par l'artisan${motif}. À proposer à un autre artisan.`,
      })
    }
  }

  return { status: 200, body: { price: toPayload(updated as AssignmentRow) } }
}

/** Marqueur commun aux reminders de refus de prix. */
export const PRICE_REMINDER_MARKER = '💶 Prix'

async function loadAssignment(
  supabase: SupabaseClient,
  interventionId: string,
  artisanId: string,
): Promise<AssignmentRow | null> {
  const { data } = await supabase
    .from('intervention_artisans')
    .select('id, price_response, price_responded_at, price_accepted_amount, price_refused_reason, price_response_source')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .maybeSingle()
  return (data as AssignmentRow | null) ?? null
}

/**
 * Rang de l'artisan sur l'intervention (1 ou 2), qui résout son coût SST.
 * `intervention_artisans` ne porte pas d'`artisan_order` : le rang se déduit du
 * rôle, comme partout ailleurs dans le portail.
 */
export async function resolveArtisanOrder(
  supabase: SupabaseClient,
  interventionId: string,
  artisanId: string,
): Promise<number> {
  const { data } = await supabase
    .from('intervention_artisans')
    .select('role, is_primary')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .maybeSingle()
  const row = data as { role: string | null; is_primary: boolean | null } | null
  return row && (row.role === 'secondary' || row.is_primary === false) ? 2 : 1
}
