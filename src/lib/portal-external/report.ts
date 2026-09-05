import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeOccurredAt,
  recordArtisanAction,
  validateEventEnvelope,
  type EventEnvelope,
} from './actions'
import { artisanDisplayName, type PortalArtisan } from './auth'
import { PORTAL_REPORT_COLUMNS, isReportAllowedStatus, type PortalReportFull } from './interventions'

/**
 * Rapports d'intervention envoyés depuis le portail — envoi, modification et
 * historique des versions (contrat §4.2, spécification §7.3, lot L3).
 *
 * Trois routes vivent ici :
 *  - `POST   /me/interventions/{id}/report`  : envoi d'une version, avec
 *    `replaces` pour remplacer celle qui est encore en attente ;
 *  - `PATCH  /me/interventions/{id}/report`  : correction **en place** d'un
 *    rapport encore `submitted`, sans nouveau numéro de version ;
 *  - `GET    /me/interventions/{id}/reports` : la liste des versions.
 *
 * **La règle de version (§7.3)**, qui remplace l'ancien « seul un rapport rejeté
 * ouvre une nouvelle version » :
 *
 * > Une nouvelle version est permise si aucun rapport `submitted` n'est en
 * > attente, **et** que le dernier rapport est `rejected`, **ou** que
 * > l'intervention est repassée par `INTER_EN_COURS` ou `SAV` depuis la
 * > validation.
 *
 * Un rapport `submitted` n'est jamais un cul-de-sac : il se corrige en place
 * (`PATCH`) ou se remplace (`POST` + `replaces`, la version précédente passant à
 * `superseded`). Un rapport `approved` se verrouille : seule une réouverture
 * décidée par le **CRM** — qui reste seul propriétaire du statut (§10.1) — rouvre
 * le droit d'écrire.
 *
 * Effets : ligne `artisan_reports`, `interventions.has_portal_report` (par
 * trigger, jamais écrit ici), reminder pour le gestionnaire assigné (ou repli),
 * commentaire système et journal `artisan_portal_actions`.
 * Idempotent sur `portal_report_id`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_TRAVAUX_LENGTH = 2000
const MAX_TEXT_LENGTH = 2000

/** Marqueur commun aux reminders de rapport (création ici, clôture à la revue). */
export const REPORT_REMINDER_MARKER = '📋 Rapport'

/**
 * Statuts dont le **repassage** après une validation rouvre le droit à une
 * nouvelle version (§7.3, seconde branche ; §7.5 pour le SAV). Lus dans
 * `intervention_status_transitions` (00010, alimentée par trigger depuis 99031),
 * jamais déduits d'un seuil d'ordre de statut.
 */
export const REPORT_REOPENING_STATUSES = ['INTER_EN_COURS', 'SAV'] as const

/** Colonnes de la liste des versions (`GET …/reports`) : `PORTAL_REPORT_COLUMNS` + le début de chantier. */
export const PORTAL_REPORT_LIST_COLUMNS =
  'id, status, version, submitted_at, started_at, reviewed_at, review_comment, superseded_at, attachment_ids'

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
  /** Identifiant du rapport en attente que cet envoi remplace (§7.3). */
  replaces: string | null
}

export type ReportValidation = { ok: true; value: SubmitReportInput } | { ok: false; error: string }

function optionalText(value: unknown, field: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: `${field} must be a string` }
  if (value.length > MAX_TEXT_LENGTH) return { ok: false, error: `${field} too long (max ${MAX_TEXT_LENGTH})` }
  return { ok: true, value: value.trim() }
}

function optionalUuid(value: unknown, field: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return { ok: false, error: `${field} must be a uuid` }
  return { ok: true, value: value.toLowerCase() }
}

function validateDuree(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60 * 7) return { ok: false, error: 'duree_minutes invalid' }
  return { ok: true, value: n }
}

function validateAttachmentIds(value: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  const raw = value ?? []
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'attachment_ids must be an array of uuid' }
  }
  return { ok: true, value: Array.from(new Set((raw as string[]).map((id) => id.toLowerCase()))) }
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

  const duree = validateDuree(b.duree_minutes)
  if (!duree.ok) return duree

  const materiel = optionalText(b.materiel_utilise, 'materiel_utilise')
  if (!materiel.ok) return materiel
  const resteDetail = optionalText(b.reste_a_faire_detail, 'reste_a_faire_detail')
  if (!resteDetail.ok) return resteDetail
  const anomalies = optionalText(b.anomalies, 'anomalies')
  if (!anomalies.ok) return anomalies

  if (typeof b.reste_a_faire !== 'boolean') return { ok: false, error: 'reste_a_faire must be a boolean' }
  if (typeof b.client_present !== 'boolean') return { ok: false, error: 'client_present must be a boolean' }

  const attachments = validateAttachmentIds(b.attachment_ids)
  if (!attachments.ok) return attachments

  const replaces = optionalUuid(b.replaces, 'replaces')
  if (!replaces.ok) return replaces

  return {
    ok: true,
    value: {
      portal_report_id: b.portal_report_id.toLowerCase(),
      travaux_realises: b.travaux_realises.trim(),
      duree_minutes: duree.value,
      materiel_utilise: materiel.value,
      reste_a_faire: b.reste_a_faire,
      reste_a_faire_detail: resteDetail.value,
      anomalies: anomalies.value,
      client_present: b.client_present,
      attachment_ids: attachments.value,
      replaces: replaces.value,
    },
  }
}

/**
 * Enveloppe d'idempotence **facultative** sur les routes de rapport.
 *
 * `portal_report_id` porte déjà l'idempotence de l'envoi depuis la première
 * version du portail : exiger `event_uid` casserait les téléphones qui n'ont pas
 * encore la mise à jour. Quand elle est fournie, l'enveloppe sert à horodater et
 * à journaliser le geste ; un rejeu ne crée pas de doublon de trace (index unique
 * `(artisan_id, event_uid)` de 99079).
 */
export function optionalEventEnvelope(
  body: Record<string, unknown>,
): { ok: true; value: EventEnvelope | null } | { ok: false; error: string } {
  if (body.event_uid === undefined || body.event_uid === null) return { ok: true, value: null }
  const parsed = validateEventEnvelope(body)
  return parsed.ok ? { ok: true, value: parsed.value } : parsed
}

export interface ReportPatchInput {
  /** Champs réellement transmis, déjà normalisés. */
  patch: Record<string, unknown>
  /** Noms des champs touchés, journalisés dans `payload.fields`. */
  fields: string[]
}

export type ReportPatchValidation = { ok: true; value: ReportPatchInput } | { ok: false; error: string }

/**
 * Valide le corps d'un `PATCH` : **tous les champs sont facultatifs**, mais au
 * moins un doit être présent — un `PATCH` vide serait une écriture sans objet,
 * qui bousculerait `updated_at` et le temps réel pour rien.
 */
export function validateReportPatchBody(body: unknown): ReportPatchValidation {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' }
  const b = body as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  const fields: string[] = []

  if (b.travaux_realises !== undefined) {
    if (typeof b.travaux_realises !== 'string' || b.travaux_realises.trim().length === 0) {
      return { ok: false, error: 'travaux_realises required' }
    }
    if (b.travaux_realises.length > MAX_TRAVAUX_LENGTH) {
      return { ok: false, error: `travaux_realises too long (max ${MAX_TRAVAUX_LENGTH})` }
    }
    const travaux = b.travaux_realises.trim()
    patch.travaux_realises = travaux
    // `content` est la colonne historique du CRM : elle suit `travaux_realises`,
    // comme à l'insertion. Deux colonnes qui divergent, c'est un rapport qui
    // s'affiche différemment selon l'écran.
    patch.content = travaux
    fields.push('travaux_realises')
  }

  if (b.duree_minutes !== undefined) {
    const duree = validateDuree(b.duree_minutes)
    if (!duree.ok) return duree
    patch.duree_minutes = duree.value
    fields.push('duree_minutes')
  }

  for (const field of ['materiel_utilise', 'reste_a_faire_detail', 'anomalies'] as const) {
    if (b[field] === undefined) continue
    const parsed = optionalText(b[field], field)
    if (!parsed.ok) return parsed
    patch[field] = parsed.value
    fields.push(field)
  }

  for (const field of ['reste_a_faire', 'client_present'] as const) {
    if (b[field] === undefined) continue
    if (typeof b[field] !== 'boolean') return { ok: false, error: `${field} must be a boolean` }
    patch[field] = b[field]
    fields.push(field)
  }

  if (b.attachment_ids !== undefined) {
    const attachments = validateAttachmentIds(b.attachment_ids)
    if (!attachments.ok) return attachments
    patch.attachment_ids = attachments.value
    fields.push('attachment_ids')
  }

  if (fields.length === 0) return { ok: false, error: 'no field to update' }
  return { ok: true, value: { patch, fields } }
}

export interface SubmitReportResult {
  status: 200 | 201 | 404 | 409 | 500
  body: { report: PortalReportFull } | { error: string }
}

export interface PatchReportResult {
  status: 200 | 400 | 404 | 409 | 500
  body: { report: PortalReportFull } | { error: string }
}

/** Une version, telle que l'artisan la voit dans l'historique (§6.5). */
export interface PortalReportVersion {
  id: string
  version: number
  status: string
  submitted_at: string | null
  started_at: string | null
  reviewed_at: string | null
  review_comment: string | null
  superseded_at: string | null
  photos_count: number
  /** La version qui fait foi aujourd'hui : celle en attente, sinon la plus récente. */
  is_current: boolean
}

export interface ListReportsResult {
  status: 200 | 404 | 500
  body: { reports: PortalReportVersion[]; current_report_id: string | null } | { error: string }
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
  adresse?: string | null
  assigned_user_id: string | null
  is_active: boolean | null
  statut: { code: string | null } | { code: string | null }[] | null
}

function statusCode(row: InterventionForReport): string | null {
  const s = row.statut
  if (!s) return null
  return Array.isArray(s) ? s[0]?.code ?? null : s.code ?? null
}

/** Ligne de version telle qu'elle est lue pour décider du droit d'écrire. */
export interface ReportVersionRow {
  id: string
  status: string
  version: number | null
  submitted_at?: string | null
  reviewed_at?: string | null
}

export type NewVersionDecision =
  | { ok: true; version: number; replacesId: string | null }
  | { ok: false; error: 'report_pending' | 'report_not_replaceable' | 'report_already_approved' }

/**
 * Décide si une nouvelle version peut naître, et sous quel numéro (§7.3).
 *
 * Fonction **pure** : toute la règle métier de versionnage tient ici, la couche
 * d'accès aux données ne fournissant que les faits (les versions existantes, et
 * le fait que l'intervention soit repassée en cours depuis la validation).
 *
 * @param reports  Versions du couple (intervention, artisan), triées par version décroissante.
 * @param replaces Identifiant du rapport en attente que l'envoi remplace, ou `null`.
 * @param reopened Vrai si l'intervention est repassée par `INTER_EN_COURS` / `SAV` depuis la validation.
 */
export function decideNewVersion(params: {
  reports: readonly ReportVersionRow[]
  replaces: string | null
  reopened: boolean
}): NewVersionDecision {
  const { reports, replaces, reopened } = params
  const maxVersion = reports.reduce((max, r) => Math.max(max, r.version ?? 1), 0)
  const pending = reports.find((r) => r.status === 'submitted') ?? null

  if (pending) {
    // Un rapport en attente ne se double jamais : l'index partiel
    // `ux_artisan_reports_one_open` n'admet qu'un seul `submitted` par couple.
    if (!replaces) return { ok: false, error: 'report_pending' }
    if (replaces !== pending.id) return { ok: false, error: 'report_not_replaceable' }
    return { ok: true, version: maxVersion + 1, replacesId: pending.id }
  }

  // `replaces` sans rapport en attente : le téléphone rejoue une intention
  // périmée (le gestionnaire a tranché entre-temps). On refuse plutôt que
  // d'écrire une version en ignorant silencieusement le remplacement demandé.
  if (replaces) return { ok: false, error: 'report_not_replaceable' }

  const last = reports[0] ?? null
  if (!last) return { ok: true, version: 1, replacesId: null }

  if (last.status === 'approved' && !reopened) {
    return { ok: false, error: 'report_already_approved' }
  }
  // `rejected` ouvre une version ; `approved` + réouverture aussi (§7.3, §7.5).
  // `superseded` en dernière position sans rapport en attente n'existe qu'après
  // une supersession interrompue : l'artisan ne doit pas y rester coincé.
  return { ok: true, version: maxVersion + 1, replacesId: null }
}

/**
 * L'intervention est-elle repassée par `INTER_EN_COURS` ou `SAV` depuis `since` ?
 *
 * Lu dans `intervention_status_transitions` plutôt que sur `interventions.updated_at`,
 * que le moindre commentaire bouscule (trigger 00082). Sans date de référence
 * lisible, on répond `false` : mieux vaut un `409` que l'ouverture d'une version
 * sur un rapport validé que personne n'a rouvert.
 */
export async function hasReopenedSince(
  supabase: SupabaseClient,
  interventionId: string,
  since: string | null,
): Promise<boolean> {
  if (!since) return false
  const { data } = await supabase
    .from('intervention_status_transitions')
    .select('id, transition_date')
    .eq('intervention_id', interventionId)
    .in('to_status_code', REPORT_REOPENING_STATUSES as unknown as string[])
    .gt('transition_date', since)
    .order('transition_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return !!data
}

/** Versions du couple (intervention, artisan), triées par version décroissante. */
async function loadReportVersions(
  supabase: SupabaseClient,
  interventionId: string,
  artisanId: string,
): Promise<ReportVersionRow[]> {
  const { data } = await supabase
    .from('artisan_reports')
    .select('id, status, version, submitted_at, reviewed_at')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .order('version', { ascending: false })
  return ((data ?? []) as ReportVersionRow[]).filter((r) => !!r && typeof r.status === 'string')
}

/** Affectation de l'artisan : 404 uniforme sinon, jamais un 403 révélateur. */
async function loadAssignment(
  supabase: SupabaseClient,
  interventionId: string,
  artisanId: string,
): Promise<{ id: string; work_started_at: string | null } | null> {
  const { data } = await supabase
    .from('intervention_artisans')
    .select('id, work_started_at')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .maybeSingle()
  const row = data as { id: string; work_started_at?: string | null } | null
  if (!row) return null
  return { id: row.id, work_started_at: row.work_started_at ?? null }
}

async function loadIntervention(
  supabase: SupabaseClient,
  interventionId: string,
): Promise<InterventionForReport | null> {
  const { data } = await supabase
    .from('interventions')
    .select('id, id_inter, adresse, assigned_user_id, is_active, statut:intervention_statuses!statut_id ( code )')
    .eq('id', interventionId)
    .maybeSingle()
  const row = data as unknown as InterventionForReport | null
  if (!row || row.is_active === false) return null
  return row
}

/** Pièces jointes retenues : uniquement celles qui appartiennent à l'intervention. */
async function keepOwnAttachments(
  supabase: SupabaseClient,
  interventionId: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('intervention_attachments')
    .select('id')
    .eq('intervention_id', interventionId)
    .in('id', ids)
  return ((data ?? []) as { id: string }[]).map((a) => a.id)
}

/** Traite l'envoi d'un rapport ; renvoie le code HTTP et le corps à retourner. */
export async function submitPortalReport(params: {
  supabase: SupabaseClient
  artisan: PortalArtisan
  interventionId: string
  input: SubmitReportInput
  envelope?: EventEnvelope | null
}): Promise<SubmitReportResult> {
  const { supabase, artisan, interventionId, input } = params
  const envelope = params.envelope ?? null

  // 1. L'artisan doit être affecté (404 uniforme sinon).
  const assignment = await loadAssignment(supabase, interventionId, artisan.id)
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const intervention = await loadIntervention(supabase, interventionId)
  if (!intervention) return { status: 404, body: { error: 'Intervention not found' } }

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

  // 4. Droit d'écrire une version (§7.3). Les versions sont lues par couple
  //    (intervention, artisan) : sur une intervention à deux artisans, le
  //    rapport de l'autre ne bloque jamais celui-ci.
  const reports = await loadReportVersions(supabase, interventionId, artisan.id)
  const last = reports[0] ?? null
  const reopened =
    last && last.status === 'approved' && !input.replaces
      ? await hasReopenedSince(supabase, interventionId, last.reviewed_at ?? last.submitted_at ?? null)
      : false
  const decision = decideNewVersion({ reports, replaces: input.replaces, reopened })
  if (!decision.ok) return { status: 409, body: { error: decision.error } }

  // 5. Pièces jointes : on ne garde que celles qui appartiennent à l'intervention.
  const attachmentIds = await keepOwnAttachments(supabase, interventionId, input.attachment_ids)

  // 6. Supersession, dans l'ORDRE IMPOSÉ par l'index partiel `ux_artisan_reports_one_open`
  //    (99078:109-125) : v(n) passe à `superseded` AVANT l'insertion de v(n+1),
  //    sinon 23505. PostgREST n'ouvre pas de transaction multi-requêtes : le
  //    filet est la **compensation** de l'étape 7 en cas d'échec de l'insertion.
  const supersededAt = new Date().toISOString()
  if (decision.replacesId) {
    const { data: locked } = await supabase
      .from('artisan_reports')
      .update({ status: 'superseded', superseded_at: supersededAt })
      .eq('id', decision.replacesId)
      .eq('status', 'submitted')
      .select('id')
      .maybeSingle()
    // Aucune ligne : le gestionnaire a tranché entre l'affichage et l'envoi.
    if (!locked) return { status: 409, body: { error: 'report_not_replaceable' } }
  }

  // 7. Insertion (has_portal_report est posé par le trigger trg_artisan_reports_sync_flag).
  const submittedAt = new Date().toISOString()
  const { data: inserted, error: insertError } = await supabase
    .from('artisan_reports')
    .insert({
      intervention_id: interventionId,
      artisan_id: artisan.id,
      portal_report_id: input.portal_report_id,
      version: decision.version,
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
      // Début de chantier déclaré, recopié à l'envoi : il fige la durée réelle
      // (`submitted_at − started_at`) même si le gestionnaire corrige ensuite
      // `work_started_at` sur l'affectation.
      started_at: assignment.work_started_at,
    })
    .select(PORTAL_REPORT_COLUMNS)
    .single()

  if (insertError || !inserted) {
    // Compensation : sans transaction, une v(n) laissée `superseded` sans
    // successeur ferait disparaître le rapport en attente de l'artisan.
    if (decision.replacesId) {
      const { error: rollbackError } = await supabase
        .from('artisan_reports')
        .update({ status: 'submitted', superseded_at: null })
        .eq('id', decision.replacesId)
        .eq('status', 'superseded')
      if (rollbackError) {
        console.error('[portal-external] Supersession non annulée :', rollbackError.message)
      }
    }

    if (insertError?.code === '23505') {
      // Course entre deux envois identiques (même portal_report_id) : renvoyer le rapport enregistré.
      const { data: raced } = await supabase
        .from('artisan_reports')
        .select(PORTAL_REPORT_COLUMNS)
        .eq('portal_report_id', input.portal_report_id)
        .maybeSingle()
      if (raced) return { status: 200, body: { report: raced as unknown as PortalReportFull } }

      // Course entre deux envois différents (double clic, retry réseau) : l'autre a pris
      // le numéro de version ou la place du rapport en attente. On répond avec
      // l'état réel plutôt que 500.
      const current = (await loadReportVersions(supabase, interventionId, artisan.id))[0] ?? null
      if (current && current.status !== 'rejected') {
        return {
          status: 409,
          body: { error: current.status === 'approved' ? 'report_already_approved' : 'report_pending' },
        }
      }
    }
    console.error('[portal-external] Insertion du rapport échouée :', insertError?.message)
    return { status: 500, body: { error: 'Failed to save report' } }
  }

  const report = inserted as unknown as PortalReportFull
  const artisanName = artisanDisplayName(artisan)
  const idInter = intervention.id_inter || `INT-${interventionId.slice(0, 8)}`

  // 8. Chaînage de la version remplacée : `superseded_by` est une clé étrangère
  //    vers `artisan_reports`, elle ne peut donc être posée qu'APRÈS l'insertion.
  if (decision.replacesId) {
    const { error: linkError } = await supabase
      .from('artisan_reports')
      .update({ superseded_by: report.id })
      .eq('id', decision.replacesId)
    if (linkError) console.error('[portal-external] Chaînage de la version remplacée échoué :', linkError.message)
  }

  // 9. Journal (append-only) : le geste de l'artisan est tracé même si la suite échoue.
  const clock = normalizeOccurredAt(envelope?.occurred_at_declared ?? null)
  await recordArtisanAction(supabase, {
    artisanId: artisan.id,
    actionType: decision.replacesId ? 'REPORT_REPLACED' : 'REPORT_SUBMITTED',
    source: 'portal',
    interventionId,
    reportId: report.id,
    intervention: { id: intervention.id, id_inter: intervention.id_inter, adresse: intervention.adresse ?? null },
    payload: {
      version: decision.version,
      replaces: decision.replacesId,
      photos: attachmentIds.length,
    },
    envelope,
    clock,
  })

  // 10. Reminder pour le gestionnaire (assigné → repli env → premier admin).
  const target = await resolveReminderTarget(supabase, intervention.assigned_user_id)
  if (target) {
    await upsertReminder(supabase, interventionId, target, buildReminderNote(target.username, idInter, artisanName, attachmentIds.length))
  } else {
    console.warn('[portal-external] Aucun gestionnaire à notifier pour', interventionId)
  }

  // 11. Commentaire système sur l'intervention.
  const versionSuffix = decision.version > 1 ? ` (version ${decision.version})` : ''
  const remplacement = decision.replacesId ? ' Il remplace la version précédente, encore en attente.' : ''
  const { error: commentError } = await supabase.from('comments').insert({
    entity_type: 'intervention',
    entity_id: interventionId,
    content: `Rapport d'intervention reçu de ${artisanName}${versionSuffix}. En attente de validation.${remplacement}`,
    comment_type: 'system',
    is_internal: true,
  })
  if (commentError) console.error('[portal-external] Commentaire système non créé :', commentError.message)

  return { status: 201, body: { report } }
}

/**
 * Corrige **en place** le rapport encore en attente (`PATCH …/report`, §7.3).
 *
 * Aucun nouveau numéro de version : le gestionnaire n'a encore rien tranché, et
 * numéroter une faute de frappe transformerait l'historique en journal de
 * frappe. La garde est le **statut du rapport**, jamais celui de l'intervention :
 * si le CRM fait avancer le statut pendant qu'un rapport attend, l'artisan doit
 * encore pouvoir corriger ce qu'il a écrit (§10.1 — le statut appartient au CRM,
 * et n'enlève rien aux faits déjà déclarés).
 */
export async function patchPortalReport(params: {
  supabase: SupabaseClient
  artisan: PortalArtisan
  interventionId: string
  input: ReportPatchInput
  envelope?: EventEnvelope | null
}): Promise<PatchReportResult> {
  const { supabase, artisan, interventionId, input } = params
  const envelope = params.envelope ?? null

  const assignment = await loadAssignment(supabase, interventionId, artisan.id)
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const intervention = await loadIntervention(supabase, interventionId)
  if (!intervention) return { status: 404, body: { error: 'Intervention not found' } }

  const reports = await loadReportVersions(supabase, interventionId, artisan.id)
  const pending = reports.find((r) => r.status === 'submitted') ?? null
  if (!pending) {
    const last = reports[0] ?? null
    if (!last) return { status: 404, body: { error: 'Report not found' } }
    if (last.status === 'approved') return { status: 409, body: { error: 'report_already_approved' } }
    // Un rapport refusé ne se réécrit pas : le refus et son motif appartiennent
    // à l'historique, la correction passe par une nouvelle version (POST).
    return { status: 409, body: { error: 'report_not_editable' } }
  }

  const patch = { ...input.patch }
  if (Array.isArray(patch.attachment_ids)) {
    const kept = await keepOwnAttachments(supabase, interventionId, patch.attachment_ids as string[])
    patch.attachment_ids = kept
    patch.photo_ids = kept
  }

  const { data: updated, error } = await supabase
    .from('artisan_reports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', pending.id)
    // Course : si le gestionnaire vient de trancher, l'écriture ne touche rien.
    .eq('status', 'submitted')
    .select(PORTAL_REPORT_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error('[portal-external] Modification du rapport échouée :', error.message)
    return { status: 500, body: { error: 'Failed to update report' } }
  }
  if (!updated) return { status: 409, body: { error: 'report_not_editable' } }

  const report = updated as unknown as PortalReportFull
  const clock = normalizeOccurredAt(envelope?.occurred_at_declared ?? null)
  await recordArtisanAction(supabase, {
    artisanId: artisan.id,
    actionType: 'REPORT_REPLACED',
    source: 'portal',
    interventionId,
    reportId: report.id,
    intervention: { id: intervention.id, id_inter: intervention.id_inter, adresse: intervention.adresse ?? null },
    // §1.3 : on n'enregistre pas l'historique champ à champ, mais l'événement
    // « rapport modifié » porte la liste des champs touchés.
    payload: { mode: 'patch', version: report.version, fields: input.fields },
    envelope,
    clock,
  })

  return { status: 200, body: { report } }
}

/** Historique des versions du rapport de CET artisan (`GET …/reports`, §6.5). */
export async function listPortalReports(params: {
  supabase: SupabaseClient
  artisanId: string
  interventionId: string
}): Promise<ListReportsResult> {
  const { supabase, artisanId, interventionId } = params

  const assignment = await loadAssignment(supabase, interventionId, artisanId)
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const { data } = await supabase
    .from('artisan_reports')
    .select(PORTAL_REPORT_LIST_COLUMNS)
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .order('version', { ascending: false })

  const rows = (data ?? []) as unknown as Array<{
    id: string
    status: string
    version: number | null
    submitted_at: string | null
    started_at: string | null
    reviewed_at: string | null
    review_comment: string | null
    superseded_at: string | null
    attachment_ids: string[] | null
  }>

  // La version qui fait foi : celle en attente, sinon la plus récente — même
  // règle que `pickPortalReport` côté CRM, pour que les deux applications
  // désignent le même rapport.
  const current = rows.find((r) => r.status === 'submitted') ?? rows[0] ?? null

  const reports: PortalReportVersion[] = rows.map((row) => ({
    id: row.id,
    version: row.version ?? 1,
    status: row.status,
    submitted_at: row.submitted_at,
    started_at: row.started_at,
    reviewed_at: row.reviewed_at,
    review_comment: row.review_comment,
    superseded_at: row.superseded_at,
    photos_count: (row.attachment_ids ?? []).length,
    is_current: !!current && row.id === current.id,
  }))

  return { status: 200, body: { reports, current_report_id: current?.id ?? null } }
}
