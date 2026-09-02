import type { SupabaseClient } from '@supabase/supabase-js'
import { artisanDisplayName, type PortalArtisan } from './auth'
import { PORTAL_REPORT_COLUMNS, isReportAllowedStatus, type PortalReportFull } from './interventions'

/**
 * Réception d'un rapport d'intervention envoyé depuis le portail
 * (contrat §2, `POST /api/portal-external/me/interventions/{id}/report`).
 *
 * Effets : ligne `artisan_reports` (nouvelle version si un rapport rejeté existe),
 * `interventions.has_portal_report` (par trigger, jamais écrit ici), reminder
 * pour le gestionnaire assigné (ou repli) et commentaire système.
 * Idempotent sur `portal_report_id`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_TRAVAUX_LENGTH = 2000
const MAX_TEXT_LENGTH = 2000

/** Marqueur commun aux reminders de rapport (création ici, clôture à la revue). */
export const REPORT_REMINDER_MARKER = '📋 Rapport'

export interface SubmitReportInput {
  portal_report_id: string
  travaux_realises: string
  duree_minutes: number | null
  materiel_utilise: string | null
  reste_a_faire: boolean
  reste_a_faire_detail: string | null
  anomalies: string | null
  client_present: boolean
  attachment_ids: string[]
}

export type ReportValidation = { ok: true; value: SubmitReportInput } | { ok: false; error: string }

function optionalText(value: unknown, field: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${field} must be a string` }
  if (value.length > MAX_TEXT_LENGTH) return { ok: false, error: `${field} too long (max ${MAX_TEXT_LENGTH})` }
  return { ok: true, value: value.trim() }
}

/** Valide et normalise le corps JSON du rapport. */
export function validateReportBody(body: unknown): ReportValidation {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' }
  const b = body as Record<string, unknown>

  if (typeof b.portal_report_id !== 'string' || !UUID_PATTERN.test(b.portal_report_id)) {
    return { ok: false, error: 'portal_report_id must be a uuid' }
  }
  if (typeof b.travaux_realises !== 'string' || b.travaux_realises.trim().length === 0) {
    return { ok: false, error: 'travaux_realises required' }
  }
  if (b.travaux_realises.length > MAX_TRAVAUX_LENGTH) {
    return { ok: false, error: `travaux_realises too long (max ${MAX_TRAVAUX_LENGTH})` }
  }

  let duree: number | null = null
  if (b.duree_minutes !== undefined && b.duree_minutes !== null && b.duree_minutes !== '') {
    const n = Number(b.duree_minutes)
    if (!Number.isInteger(n) || n < 0 || n > 24 * 60 * 7) return { ok: false, error: 'duree_minutes invalid' }
    duree = n
  }

  const materiel = optionalText(b.materiel_utilise, 'materiel_utilise')
  if (!materiel.ok) return materiel
  const resteDetail = optionalText(b.reste_a_faire_detail, 'reste_a_faire_detail')
  if (!resteDetail.ok) return resteDetail
  const anomalies = optionalText(b.anomalies, 'anomalies')
  if (!anomalies.ok) return anomalies

  if (typeof b.reste_a_faire !== 'boolean') return { ok: false, error: 'reste_a_faire must be a boolean' }
  if (typeof b.client_present !== 'boolean') return { ok: false, error: 'client_present must be a boolean' }

  const rawIds = b.attachment_ids ?? []
  if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'attachment_ids must be an array of uuid' }
  }

  return {
    ok: true,
    value: {
      portal_report_id: b.portal_report_id.toLowerCase(),
      travaux_realises: b.travaux_realises.trim(),
      duree_minutes: duree,
      materiel_utilise: materiel.value,
      reste_a_faire: b.reste_a_faire,
      reste_a_faire_detail: resteDetail.value,
      anomalies: anomalies.value,
      client_present: b.client_present,
      attachment_ids: Array.from(new Set((rawIds as string[]).map((id) => id.toLowerCase()))),
    },
  }
}

export interface SubmitReportResult {
  status: 200 | 201 | 404 | 409 | 500
  body: { report: PortalReportFull } | { error: string }
}

interface ReminderTarget {
  id: string
  username: string | null
}

/**
 * Gestionnaire à notifier : `assigned_user_id`, sinon `PORTAL_FALLBACK_USER_ID`,
 * sinon le premier utilisateur ayant le rôle admin.
 */
export async function resolveReminderTarget(
  supabase: SupabaseClient,
  assignedUserId: string | null,
): Promise<ReminderTarget | null> {
  const candidates = [assignedUserId, process.env.PORTAL_FALLBACK_USER_ID?.trim() || null].filter(
    (id): id is string => !!id && UUID_PATTERN.test(id),
  )

  for (const id of candidates) {
    const { data } = await supabase.from('users').select('id, username').eq('id', id).maybeSingle()
    if (data?.id) return { id: data.id, username: data.username ?? null }
  }

  const { data: adminRole } = await supabase.from('roles').select('id').eq('name', 'admin').maybeSingle()
  if (!adminRole?.id) return null
  const { data: membership } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_id', adminRole.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!membership?.user_id) return null
  const { data: adminUser } = await supabase.from('users').select('id, username').eq('id', membership.user_id).maybeSingle()
  return adminUser?.id ? { id: adminUser.id, username: adminUser.username ?? null } : null
}

/** Texte du reminder (mention `@username` = notification realtime dans le CRM). */
export function buildReminderNote(username: string | null, idInter: string, artisanName: string, photoCount: number): string {
  const mention = username || 'gestionnaire'
  const photos = photoCount > 0 ? ` ${photoCount} photo(s) jointe(s).` : ''
  return `@${mention} ${REPORT_REMINDER_MARKER} de l'inter #${idInter} à vérifier - soumis par ${artisanName}.${photos}`
}

async function upsertReminder(
  supabase: SupabaseClient,
  interventionId: string,
  target: ReminderTarget,
  note: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('intervention_reminders')
    .select('id, note')
    .eq('intervention_id', interventionId)
    .eq('user_id', target.id)
    .eq('is_active', true)
    .ilike('note', `%${REPORT_REMINDER_MARKER}%`)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('intervention_reminders')
      .update({ note, is_completed: false, updated_at: new Date().toISOString(), mentioned_user_ids: [target.id] })
      .eq('id', existing.id)
    if (error) console.error('[portal-external] Mise à jour du reminder échouée :', error.message)
    return
  }

  const { error } = await supabase.from('intervention_reminders').insert({
    intervention_id: interventionId,
    user_id: target.id,
    note,
    is_active: true,
    is_completed: false,
    mentioned_user_ids: [target.id],
  })
  if (error) console.error('[portal-external] Création du reminder échouée :', error.message)
}

interface InterventionForReport {
  id: string
  id_inter: string | null
  assigned_user_id: string | null
  is_active: boolean | null
  statut: { code: string | null } | { code: string | null }[] | null
}

function statusCode(row: InterventionForReport): string | null {
  const s = row.statut
  if (!s) return null
  return Array.isArray(s) ? s[0]?.code ?? null : s.code ?? null
}

/** Traite l'envoi d'un rapport ; renvoie le code HTTP et le corps à retourner. */
export async function submitPortalReport(params: {
  supabase: SupabaseClient
  artisan: PortalArtisan
  interventionId: string
  input: SubmitReportInput
}): Promise<SubmitReportResult> {
  const { supabase, artisan, interventionId, input } = params

  // 1. L'artisan doit être affecté (404 uniforme sinon).
  const { data: assignment } = await supabase
    .from('intervention_artisans')
    .select('id')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisan.id)
    .maybeSingle()
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const { data: interventionRow } = await supabase
    .from('interventions')
    .select('id, id_inter, assigned_user_id, is_active, statut:intervention_statuses!statut_id ( code )')
    .eq('id', interventionId)
    .maybeSingle()
  const intervention = interventionRow as unknown as InterventionForReport | null
  if (!intervention || intervention.is_active === false) {
    return { status: 404, body: { error: 'Intervention not found' } }
  }

  // 2. Idempotence : même portal_report_id → même rapport, 200.
  const { data: existingByPortalId } = await supabase
    .from('artisan_reports')
    .select(`intervention_id, artisan_id, ${PORTAL_REPORT_COLUMNS}`)
    .eq('portal_report_id', input.portal_report_id)
    .maybeSingle()
  if (existingByPortalId) {
    const existing = existingByPortalId as unknown as PortalReportFull & { intervention_id: string; artisan_id: string }
    if (existing.intervention_id !== interventionId || existing.artisan_id !== artisan.id) {
      return { status: 409, body: { error: 'portal_report_id already used' } }
    }
    const { intervention_id: _i, artisan_id: _a, ...report } = existing
    void _i
    void _a
    return { status: 200, body: { report } }
  }

  // 3. Statut de l'intervention.
  if (!isReportAllowedStatus(statusCode(intervention))) {
    return { status: 409, body: { error: 'Intervention status does not allow a report' } }
  }

  // 4. Version : un rapport soumis ou validé bloque ; un rapport rejeté ouvre une nouvelle version.
  const { data: previous } = await supabase
    .from('artisan_reports')
    .select('status, version')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisan.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const prev = previous as { status: string; version: number } | null
  if (prev && prev.status !== 'rejected') {
    return { status: 409, body: { error: prev.status === 'approved' ? 'Report already approved' : 'Report already submitted' } }
  }
  const version = prev ? (prev.version ?? 1) + 1 : 1

  // 5. Pièces jointes : on ne garde que celles qui appartiennent à l'intervention.
  let attachmentIds: string[] = []
  if (input.attachment_ids.length > 0) {
    const { data: attachments } = await supabase
      .from('intervention_attachments')
      .select('id')
      .eq('intervention_id', interventionId)
      .in('id', input.attachment_ids)
    attachmentIds = ((attachments ?? []) as { id: string }[]).map((a) => a.id)
  }

  // 6. Insertion (has_portal_report est posé par le trigger trg_artisan_reports_sync_flag).
  const submittedAt = new Date().toISOString()
  const { data: inserted, error: insertError } = await supabase
    .from('artisan_reports')
    .insert({
      intervention_id: interventionId,
      artisan_id: artisan.id,
      portal_report_id: input.portal_report_id,
      version,
      status: 'submitted',
      travaux_realises: input.travaux_realises,
      content: input.travaux_realises,
      duree_minutes: input.duree_minutes,
      materiel_utilise: input.materiel_utilise,
      reste_a_faire: input.reste_a_faire,
      reste_a_faire_detail: input.reste_a_faire_detail,
      anomalies: input.anomalies,
      client_present: input.client_present,
      attachment_ids: attachmentIds,
      photo_ids: attachmentIds,
      submitted_from: 'portal',
      synced_from_portal: true,
      submitted_at: submittedAt,
    })
    .select(PORTAL_REPORT_COLUMNS)
    .single()

  if (insertError || !inserted) {
    if (insertError?.code === '23505') {
      // Course entre deux envois identiques (même portal_report_id) : renvoyer le rapport enregistré.
      const { data: raced } = await supabase
        .from('artisan_reports')
        .select(PORTAL_REPORT_COLUMNS)
        .eq('portal_report_id', input.portal_report_id)
        .maybeSingle()
      if (raced) return { status: 200, body: { report: raced as unknown as PortalReportFull } }

      // Course entre deux envois différents (double clic, retry réseau) : l'autre a pris
      // le numéro de version (ux_artisan_reports_intervention_artisan_version). On
      // répond avec l'état réel plutôt que 500.
      const { data: latest } = await supabase
        .from('artisan_reports')
        .select('status, version')
        .eq('intervention_id', interventionId)
        .eq('artisan_id', artisan.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      const current = latest as { status: string; version: number } | null
      if (current && current.status !== 'rejected') {
        return {
          status: 409,
          body: { error: current.status === 'approved' ? 'Report already approved' : 'Report already submitted' },
        }
      }
    }
    console.error('[portal-external] Insertion du rapport échouée :', insertError?.message)
    return { status: 500, body: { error: 'Failed to save report' } }
  }

  const report = inserted as unknown as PortalReportFull
  const artisanName = artisanDisplayName(artisan)
  const idInter = intervention.id_inter || `INT-${interventionId.slice(0, 8)}`

  // 7. Reminder pour le gestionnaire (assigné → repli env → premier admin).
  const target = await resolveReminderTarget(supabase, intervention.assigned_user_id)
  if (target) {
    await upsertReminder(supabase, interventionId, target, buildReminderNote(target.username, idInter, artisanName, attachmentIds.length))
  } else {
    console.warn('[portal-external] Aucun gestionnaire à notifier pour', interventionId)
  }

  // 8. Commentaire système sur l'intervention.
  const versionSuffix = version > 1 ? ` (version ${version})` : ''
  const { error: commentError } = await supabase.from('comments').insert({
    entity_type: 'intervention',
    entity_id: interventionId,
    content: `Rapport d'intervention reçu de ${artisanName}${versionSuffix}. En attente de validation.`,
    comment_type: 'system',
    is_internal: true,
  })
  if (commentError) console.error('[portal-external] Commentaire système non créé :', commentError.message)

  return { status: 201, body: { report } }
}
