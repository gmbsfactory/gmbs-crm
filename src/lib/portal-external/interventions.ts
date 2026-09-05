import type { SupabaseClient } from '@supabase/supabase-js'
import {
  describePaymentStatus,
  type PaymentStatus,
  type PaymentTone,
} from '@/lib/interventions/payment-status'

/**
 * Lecture des interventions d'un artisan pour le portail, avec minimisation
 * RGPD : jamais le téléphone du propriétaire, l'e-mail du gestionnaire,
 * le commentaire agent ni les factures GMBS ; le locataire n'est exposé que
 * pour les statuts où l'artisan doit le contacter (ACCEPTE, INTER_EN_COURS, SAV).
 */

/**
 * SIX LISTES LITTÉRALES, JAMAIS DES ALIAS (spécification §7.1).
 *
 * Avant ce découplage, `PORTAL_REPORT_STATUSES` et `PORTAL_ONGOING_STATUSES`
 * étaient deux alias de `PORTAL_TENANT_STATUSES` : élargir la visibilité à
 * `DEVIS_ENVOYE` en modifiant une seule ligne aurait mécaniquement autorisé
 * l'envoi d'un rapport dès le devis **et** communiqué le locataire à un artisan
 * qui n'a encore rien accepté. C'est le piège le plus facile du dossier, et il
 * est fatal côté RGPD : chaque usage a donc désormais sa propre liste, écrite en
 * toutes lettres.
 *
 * Aucune de ces listes ne doit jamais être exprimée comme un seuil d'ordre :
 * `intervention_statuses.sort_order` place `ACCEPTE` (2) **avant**
 * `DEVIS_ENVOYE` (3), et trois ordres de tri concurrents cohabitent déjà dans
 * le CRM. « À partir de devis envoyé » n'est pas un seuil, c'est une liste.
 */

/**
 * Statuts visibles par l'artisan dans le portail (§7.1).
 * `DEVIS_ENVOYE` n'est visible que si un coût SST lui a été posé :
 * voir `isMissionVisible`, la règle ne se lit pas sur cette seule liste.
 */
export const PORTAL_VISIBLE_STATUSES = [
  'DEVIS_ENVOYE',
  'ACCEPTE',
  'INTER_EN_COURS',
  'SAV',
  'INTER_TERMINEE',
] as const

/**
 * Statuts « en pause » (§7.6) : la mission reste dans l'onglet « En cours »
 * avec un bandeau, plutôt que de disparaître sans explication — une mission qui
 * s'évapore égale un appel téléphonique au gestionnaire.
 */
export const PORTAL_PAUSED_STATUSES = ['STAND_BY'] as const

/**
 * Statuts d'abandon (§7.6) : gardés dans l'onglet « Terminées » pendant
 * `PORTAL_CANCELLED_RETENTION_DAYS` jours après le passage au statut, puis
 * la mission disparaît. Même motif que ci-dessus.
 */
export const PORTAL_CANCELLED_STATUSES = ['REFUSE', 'ANNULE'] as const

/** Durée pendant laquelle une mission refusée ou annulée reste visible (§7.6). */
export const PORTAL_CANCELLED_RETENTION_DAYS = 7

/**
 * Statuts pour lesquels le locataire est communiqué.
 * **INCHANGÉ — RGPD** : strictement plus étroit que `PORTAL_VISIBLE_STATUSES`.
 * En `DEVIS_ENVOYE`, l'artisan n'a accepté aucune mission : ni nom ni téléphone.
 */
export const PORTAL_TENANT_STATUSES = ['ACCEPTE', 'INTER_EN_COURS', 'SAV'] as const

/** Statuts pour lesquels un rapport peut être envoyé (liste littérale, pas un alias). */
export const PORTAL_REPORT_STATUSES = ['ACCEPTE', 'INTER_EN_COURS', 'SAV'] as const

/** Statuts comptés comme « en cours » dans les compteurs du profil (liste littérale). */
export const PORTAL_ONGOING_STATUSES = ['ACCEPTE', 'INTER_EN_COURS', 'SAV'] as const

/** Statuts où l'artisan peut accepter ou refuser le prix proposé (§4.2). */
export const PORTAL_PRICE_STATUSES = ['DEVIS_ENVOYE'] as const

/** Statuts où l'artisan peut déclarer le début du chantier (§4.2). */
export const PORTAL_START_STATUSES = ['ACCEPTE'] as const

export type PortalRole = 'primary' | 'secondary'

export interface PortalReportSummary {
  status: string
  version: number
}

export interface PortalReportFull {
  id: string
  status: string
  version: number
  travaux_realises: string | null
  duree_minutes: number | null
  materiel_utilise: string | null
  reste_a_faire: boolean | null
  reste_a_faire_detail: string | null
  anomalies: string | null
  client_present: boolean | null
  submitted_at: string | null
  review_comment: string | null
  reviewed_at: string | null
  attachment_ids: string[] | null
}

/** Groupe d'onglet de l'application artisan (§6.3), calculé côté CRM (P1). */
export type PortalMissionGroup = 'a_accepter' | 'en_cours' | 'terminee'

export interface PortalPriceProjection {
  /** Réponse de l'artisan : `null` tant qu'il n'a pas répondu. */
  response: 'accepted' | 'refused' | null
  responded_at: string | null
  /** Montant gelé au moment du oui — peut différer du coût SST courant (dérive). */
  accepted_amount: number | null
  /** Montant à afficher, et à renvoyer tel quel dans `amount_seen` (verrou optimiste). */
  amount: number | null
  can_accept: boolean
  refused_reason: string | null
}

export interface PortalWorkProjection {
  started_at: string | null
  can_start: boolean
}

export interface PortalPaymentProjection {
  state: PaymentStatus
  /** Libellé calculé côté CRM ; jamais recalculé par le portail (P1). */
  label: string | null
  tone: PaymentTone
  /** Son coût SST à lui, jamais un total GMBS ni une marge. */
  amount: number | null
  paid_at: string | null
}

export interface PortalInterventionListItem {
  id: string
  id_inter: string | null
  statut_code: string | null
  statut_label: string | null
  statut_color: string | null
  date_prevue: string | null
  date: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  latitude: number | null
  longitude: number | null
  metier: string | null
  contexte: string | null
  consigne: string | null
  consigne_second_artisan: string | null
  role: PortalRole
  tenant: { nom: string | null; telephone: string | null } | null
  cout_sst: number | null
  photos_count: number
  report: PortalReportSummary | null
  /** Onglet de destination dans l'application (§6.3). */
  groupe: PortalMissionGroup
  price: PortalPriceProjection
  work: PortalWorkProjection
  /** Renseigné uniquement sur une mission terminée ; `null` partout ailleurs. */
  payment: PortalPaymentProjection | null
}

export interface PortalInterventionDetail extends PortalInterventionListItem {
  agence: { nom: string | null } | null
}

export const PORTAL_REPORT_COLUMNS =
  'id, status, version, travaux_realises, duree_minutes, materiel_utilise, reste_a_faire, reste_a_faire_detail, anomalies, client_present, submitted_at, review_comment, reviewed_at, attachment_ids'

const INTERVENTION_SELECT = `
  id, id_inter, date, date_prevue, adresse, code_postal, ville, latitude, longitude,
  contexte_intervention, consigne_intervention, consigne_second_artisan, assigned_user_id, is_active,
  statut:intervention_statuses!statut_id ( code, label, color ),
  metier:metiers!metier_id ( label ),
  tenant:tenants!tenant_id ( firstname, lastname, plain_nom_client, telephone ),
  agence:agencies!agence_id ( label )
`

type Rel<T> = T | T[] | null

interface InterventionRow {
  id: string
  id_inter: string | null
  date: string | null
  date_prevue: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  latitude: number | string | null
  longitude: number | string | null
  contexte_intervention: string | null
  consigne_intervention: string | null
  consigne_second_artisan: string | null
  assigned_user_id: string | null
  is_active: boolean | null
  statut: Rel<{ code: string | null; label: string | null; color: string | null }>
  metier: Rel<{ label: string | null }>
  tenant: Rel<{ firstname: string | null; lastname: string | null; plain_nom_client: string | null; telephone: string | null }>
  agence: Rel<{ label: string | null }>
}

/**
 * Colonnes lues sur `intervention_artisans` : tout ce qui est **par artisan**
 * y vit (prix, démarrage, paiement). Sur une intervention à deux artisans, l'un
 * peut avoir accepté et l'autre pas — d'où la lecture systématique de la ligne
 * d'affectation, jamais d'un champ de l'intervention.
 */
const ASSIGNMENT_SELECT = `
  role, is_primary,
  price_response, price_responded_at, price_accepted_amount, price_refused_reason,
  work_started_at,
  payment_status, paid_at
`

interface AssignmentRow {
  role: string | null
  is_primary: boolean | null
  price_response: string | null
  price_responded_at: string | null
  price_accepted_amount: number | string | null
  price_refused_reason: string | null
  work_started_at: string | null
  payment_status: string | null
  paid_at: string | null
  intervention: Rel<InterventionRow>
}

function one<T>(rel: Rel<T>): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function roleOf(row: AssignmentRow): PortalRole {
  return row.role === 'secondary' || row.is_primary === false ? 'secondary' : 'primary'
}

/** Vrai si le statut fait partie de la liste principale des statuts visibles (§7.1). */
export function isPortalVisibleStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_VISIBLE_STATUSES as readonly string[]).includes(code)
}

/** Vrai si le statut met la mission en pause sans la faire disparaître (§7.6). */
export function isPortalPausedStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_PAUSED_STATUSES as readonly string[]).includes(code)
}

/** Vrai si le statut est un abandon (refus ou annulation) — visible 7 jours (§7.6). */
export function isPortalCancelledStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_CANCELLED_STATUSES as readonly string[]).includes(code)
}

/**
 * Statuts pour lesquels une mission peut apparaître dans l'application, avant
 * application des gardes de coût SST (`DEVIS_ENVOYE`) et d'ancienneté
 * (`REFUSE` / `ANNULE`) — voir `isMissionVisible`.
 */
export function isPortalListedStatus(code: string | null | undefined): boolean {
  return isPortalVisibleStatus(code) || isPortalPausedStatus(code) || isPortalCancelledStatus(code)
}

/**
 * **La règle de visibilité complète** (§7.1 et §7.6) :
 *
 * > Une intervention est visible par l'artisan si son statut est listé **et**
 * > (`statut ≠ 'DEVIS_ENVOYE'` **ou** un coût SST lui a été posé), une mission
 * > refusée ou annulée disparaissant au bout de sept jours.
 *
 * Masquer une mission `DEVIS_ENVOYE` sans prix est plus juste que d'afficher un
 * bouton désactivé : cela fait du « poser le coût SST » le geste qui déclenche
 * l'apparition de la mission chez l'artisan. Il n'y a rien à accepter sans prix.
 */
export function isMissionVisible(params: {
  statutCode: string | null | undefined
  coutSst: number | null
  /** Date de passage au statut d'abandon, si connue. */
  cancelledAt?: string | null
  now?: Date
}): boolean {
  const { statutCode, coutSst } = params
  if (!isPortalListedStatus(statutCode)) return false

  if (isPriceAllowedStatus(statutCode)) {
    // Q1 de la spécification : (a) invisible. Un écran sans action possible
    // génère des appels. `cout_sst = 0` (travaux offerts) reste une proposition
    // valable ; seule l'absence de coût masque la mission.
    if (coutSst === null) return false
  }

  if (isPortalCancelledStatus(statutCode)) {
    // Sans date de passage au statut, on garde la mission : mieux vaut une ligne
    // « Annulée » de trop qu'une mission qui s'évapore sans explication.
    if (!params.cancelledAt) return true
    const cancelled = new Date(params.cancelledAt).getTime()
    if (Number.isNaN(cancelled)) return true
    const limite = PORTAL_CANCELLED_RETENTION_DAYS * 24 * 60 * 60 * 1000
    return (params.now ?? new Date()).getTime() - cancelled <= limite
  }

  return true
}

/** Onglet de destination de la mission dans l'application (§6.3). */
export function missionGroup(code: string | null | undefined): PortalMissionGroup {
  if (isPriceAllowedStatus(code)) return 'a_accepter'
  if (code === 'INTER_TERMINEE' || isPortalCancelledStatus(code)) return 'terminee'
  return 'en_cours'
}

/** Vrai si le locataire doit être communiqué pour ce statut. */
export function isTenantVisibleStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_TENANT_STATUSES as readonly string[]).includes(code)
}

/** Vrai si un rapport peut être envoyé pour ce statut. */
export function isReportAllowedStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_REPORT_STATUSES as readonly string[]).includes(code)
}

/** Vrai si l'artisan peut répondre au prix proposé pour ce statut. */
export function isPriceAllowedStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_PRICE_STATUSES as readonly string[]).includes(code)
}

/** Vrai si l'artisan peut déclarer le début du chantier pour ce statut. */
export function isStartAllowedStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_START_STATUSES as readonly string[]).includes(code)
}

/**
 * Rapport à présenter au gestionnaire parmi ceux d'une intervention (tous
 * artisans confondus), la liste étant déjà triée par version puis date
 * d'envoi décroissantes : le rapport **en attente** (`submitted`) prime,
 * sinon le plus récent. Sur une intervention à deux artisans, le rapport du
 * second artisan reste ainsi traitable après validation de celui du premier.
 */
export function pickPortalReport<T extends { status: string }>(reports: readonly T[]): T | null {
  return reports.find((r) => r.status === 'submitted') ?? reports[0] ?? null
}

interface Enrichment {
  photosCount: Map<string, number>
  sstCosts: Map<string, Map<number, number>>
  reports: Map<string, PortalReportFull>
  /** Date de passage à REFUSE / ANNULE, pour la rétention de sept jours (§7.6). */
  cancelledAt: Map<string, string>
}

async function loadEnrichment(
  supabase: SupabaseClient,
  artisanId: string,
  interventionIds: string[],
): Promise<Enrichment> {
  const enrichment: Enrichment = {
    photosCount: new Map(),
    sstCosts: new Map(),
    reports: new Map(),
    cancelledAt: new Map(),
  }
  if (interventionIds.length === 0) return enrichment

  const [photosRes, costsRes, reportsRes, cancelledRes] = await Promise.all([
    supabase
      .from('intervention_attachments')
      .select('intervention_id')
      .eq('kind', 'photos')
      .in('intervention_id', interventionIds),
    supabase
      .from('intervention_costs')
      .select('intervention_id, amount, artisan_order')
      .eq('cost_type', 'sst')
      .in('intervention_id', interventionIds),
    supabase
      .from('artisan_reports')
      .select(`intervention_id, ${PORTAL_REPORT_COLUMNS}`)
      .eq('artisan_id', artisanId)
      .in('intervention_id', interventionIds)
      .order('version', { ascending: false }),
    // Date d'abandon : lue dans le journal des transitions (00010, alimentée par
    // trigger depuis 99031) plutôt que sur `interventions.updated_at`, qui est
    // bousculé par le moindre commentaire (trigger 00082) et prolongerait la
    // rétention de sept jours sans raison.
    supabase
      .from('intervention_status_transitions')
      .select('intervention_id, to_status_code, transition_date')
      .in('intervention_id', interventionIds)
      .in('to_status_code', PORTAL_CANCELLED_STATUSES as unknown as string[])
      .order('transition_date', { ascending: false }),
  ])

  for (const row of (photosRes.data ?? []) as { intervention_id: string }[]) {
    enrichment.photosCount.set(row.intervention_id, (enrichment.photosCount.get(row.intervention_id) ?? 0) + 1)
  }
  for (const row of (costsRes.data ?? []) as { intervention_id: string; amount: number | string; artisan_order: number | null }[]) {
    const byOrder = enrichment.sstCosts.get(row.intervention_id) ?? new Map<number, number>()
    const amount = toNumber(row.amount)
    if (amount !== null) byOrder.set(row.artisan_order ?? 1, amount)
    enrichment.sstCosts.set(row.intervention_id, byOrder)
  }
  // Trié par date décroissante : la première ligne rencontrée est le dernier abandon.
  for (const row of (cancelledRes.data ?? []) as { intervention_id: string; transition_date: string | null }[]) {
    if (row.transition_date && !enrichment.cancelledAt.has(row.intervention_id)) {
      enrichment.cancelledAt.set(row.intervention_id, row.transition_date)
    }
  }
  // Trié par version décroissante : la première ligne rencontrée est la plus récente.
  for (const row of (reportsRes.data ?? []) as (PortalReportFull & { intervention_id: string })[]) {
    if (!enrichment.reports.has(row.intervention_id)) {
      const { intervention_id: _ignored, ...report } = row
      void _ignored
      enrichment.reports.set(row.intervention_id, report)
    }
  }
  return enrichment
}

function mapIntervention(
  row: InterventionRow,
  assignment: AssignmentRow,
  role: PortalRole,
  enrichment: Enrichment,
): PortalInterventionDetail {
  const statut = one(row.statut)
  const metier = one(row.metier)
  const tenant = one(row.tenant)
  const agence = one(row.agence)
  const code = statut?.code ?? null

  const tenantName = tenant
    ? (tenant.plain_nom_client || [tenant.firstname, tenant.lastname].filter(Boolean).join(' ') || null)
    : null

  const costs = enrichment.sstCosts.get(row.id)
  const order = role === 'secondary' ? 2 : 1
  const cost = costs?.get(order) ?? costs?.values().next().value ?? null
  const report = enrichment.reports.get(row.id) ?? null

  return {
    id: row.id,
    id_inter: row.id_inter,
    statut_code: code,
    statut_label: statut?.label ?? null,
    statut_color: statut?.color ?? null,
    date_prevue: row.date_prevue,
    date: row.date,
    adresse: row.adresse,
    code_postal: row.code_postal,
    ville: row.ville,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    metier: metier?.label ?? null,
    contexte: row.contexte_intervention,
    consigne: row.consigne_intervention,
    consigne_second_artisan: row.consigne_second_artisan,
    role,
    // RGPD (principe P4) : `PORTAL_TENANT_STATUSES` est strictement plus étroit
    // que `PORTAL_VISIBLE_STATUSES`. En `DEVIS_ENVOYE`, ni nom ni téléphone.
    tenant: tenant && isTenantVisibleStatus(code) ? { nom: tenantName, telephone: tenant.telephone } : null,
    cout_sst: cost,
    photos_count: enrichment.photosCount.get(row.id) ?? 0,
    report: report ? { status: report.status, version: report.version } : null,
    groupe: missionGroup(code),
    price: projectPrice(assignment, code, cost),
    work: projectWork(assignment, code),
    payment: projectPayment(assignment, code, cost),
    agence: agence ? { nom: agence.label } : null,
  }
}

/** Réponse au prix telle que l'application doit l'afficher (§4.2.1). */
function projectPrice(
  assignment: AssignmentRow,
  code: string | null,
  coutSst: number | null,
): PortalPriceProjection {
  const response =
    assignment.price_response === 'accepted' || assignment.price_response === 'refused'
      ? assignment.price_response
      : null
  return {
    response,
    responded_at: assignment.price_responded_at,
    accepted_amount: toNumber(assignment.price_accepted_amount),
    amount: coutSst,
    // La réponse au prix n'est jamais reprise par l'artisan (§7.3) : seul le
    // gestionnaire peut la réécrire, avec trace au journal.
    can_accept: isPriceAllowedStatus(code) && response === null && coutSst !== null,
    refused_reason: assignment.price_refused_reason,
  }
}

/** Déclaration de début de chantier (§4.2.1). */
function projectWork(assignment: AssignmentRow, code: string | null): PortalWorkProjection {
  return {
    started_at: assignment.work_started_at,
    can_start:
      isStartAllowedStatus(code) &&
      assignment.price_response === 'accepted' &&
      assignment.work_started_at === null,
  }
}

/**
 * Paiement de CET artisan, présent seulement sur une mission terminée.
 * Le montant est **son** coût SST : jamais un total GMBS, jamais une marge,
 * jamais `intervention_costs_cache`.
 */
function projectPayment(
  assignment: AssignmentRow,
  code: string | null,
  coutSst: number | null,
): PortalPaymentProjection | null {
  if (code !== 'INTER_TERMINEE') return null
  const display = describePaymentStatus(assignment.payment_status, assignment.paid_at)
  return {
    state: display.state,
    label: display.label,
    tone: display.tone,
    amount: coutSst,
    paid_at: assignment.paid_at,
  }
}

/** Liste des interventions visibles de l'artisan, triées par `date_prevue`. */
export async function listPortalInterventions(
  supabase: SupabaseClient,
  artisanId: string,
): Promise<PortalInterventionListItem[]> {
  const { data, error } = await supabase
    .from('intervention_artisans')
    .select(`${ASSIGNMENT_SELECT}, intervention:interventions!intervention_id ( ${INTERVENTION_SELECT} )`)
    .eq('artisan_id', artisanId)

  if (error) {
    throw new Error(`Lecture des affectations impossible : ${error.message}`)
  }

  // Premier tamis : le statut seul. Le coût SST et la date d'abandon ne sont
  // connus qu'après l'enrichissement, la règle complète (§7.1) est donc
  // appliquée au second tamis, après projection. Le filtrage reste applicatif,
  // jamais SQL : à surveiller si d'autres statuts venaient s'ajouter.
  const assignments = ((data ?? []) as unknown as AssignmentRow[])
    .map((row) => ({ row, intervention: one(row.intervention) }))
    .filter((entry): entry is { row: AssignmentRow; intervention: InterventionRow } => {
      const i = entry.intervention
      return !!i && i.is_active !== false && isPortalListedStatus(one(i.statut)?.code)
    })

  const ids = assignments.map((a) => a.intervention.id)
  const enrichment = await loadEnrichment(supabase, artisanId, ids)
  const maintenant = new Date()

  const mapped = assignments
    .map(({ row, intervention }) => {
      const { agence: _agence, ...item } = mapIntervention(intervention, row, roleOf(row), enrichment)
      void _agence
      return item
    })
    .filter((item) =>
      isMissionVisible({
        statutCode: item.statut_code,
        coutSst: item.cout_sst,
        cancelledAt: enrichment.cancelledAt.get(item.id) ?? null,
        now: maintenant,
      }),
    )

  mapped.sort((a, b) => {
    const da = a.date_prevue ?? a.date ?? ''
    const db = b.date_prevue ?? b.date ?? ''
    return da.localeCompare(db)
  })
  return mapped
}

/**
 * Détail d'une intervention si (et seulement si) l'artisan y est affecté et
 * que son statut est visible ; `null` sinon (la route répond 404 uniforme).
 */
export async function getPortalIntervention(
  supabase: SupabaseClient,
  artisanId: string,
  interventionId: string,
): Promise<{ intervention: PortalInterventionDetail; report: PortalReportFull | null } | null> {
  const { data, error } = await supabase
    .from('intervention_artisans')
    .select(`${ASSIGNMENT_SELECT}, intervention:interventions!intervention_id ( ${INTERVENTION_SELECT} )`)
    .eq('artisan_id', artisanId)
    .eq('intervention_id', interventionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Lecture de l'intervention impossible : ${error.message}`)
  }
  const row = data as unknown as AssignmentRow | null
  const intervention = row ? one(row.intervention) : null
  if (!row || !intervention || intervention.is_active === false) return null
  if (!isPortalListedStatus(one(intervention.statut)?.code)) return null

  const enrichment = await loadEnrichment(supabase, artisanId, [intervention.id])
  const mapped = mapIntervention(intervention, row, roleOf(row), enrichment)
  // Même règle qu'en liste : une mission masquée en liste doit répondre 404 en
  // détail, sans quoi son adresse et ses pièces resteraient accessibles par URL.
  if (
    !isMissionVisible({
      statutCode: mapped.statut_code,
      coutSst: mapped.cout_sst,
      cancelledAt: enrichment.cancelledAt.get(intervention.id) ?? null,
    })
  ) {
    return null
  }
  return { intervention: mapped, report: enrichment.reports.get(intervention.id) ?? null }
}

export interface PortalPhoto {
  id: string
  url: string
  filename: string | null
  created_at: string | null
  created_by_display: string | null
  metadata: Record<string, unknown> | null
}

export interface PortalDevis {
  id: string
  url: string
  filename: string | null
  /** `devis` ou `facturesArtisans` — jamais `facturesGMBS` (lot L6). */
  kind: string
  mime_type: string | null
  file_size: number | null
  created_at: string | null
}

/**
 * Pièces d'intervention exposables à l'artisan (lot L6) : le devis qu'on lui a
 * envoyé et **sa** facture. `facturesGMBS` porte le prix payé par le client,
 * donc la marge : cette liste est fermée, jamais un préfixe « factures ».
 */
export const PORTAL_INTERVENTION_DOCUMENT_KINDS = ['devis', 'facturesArtisans'] as const

/**
 * Photos, devis et factures d'artisan d'une intervention (jamais les factures
 * GMBS ni celles de matériel).
 *
 * `devis[]` porte désormais `kind`, `mime_type`, `file_size` et `created_at` :
 * sans le type MIME, l'application ne sait pas si elle ouvre un PDF ou une
 * image, et sans la date elle ne sait pas laquelle de deux versions est la
 * bonne. `factures[]` est le pendant côté artisan, alimenté par ses dépôts.
 */
export async function listPortalInterventionDocuments(
  supabase: SupabaseClient,
  interventionId: string,
): Promise<{ photos: PortalPhoto[]; devis: PortalDevis[]; factures: PortalDevis[] }> {
  const { data, error } = await supabase
    .from('intervention_attachments')
    .select('id, kind, url, filename, mime_type, file_size, created_at, created_by_display, metadata')
    .eq('intervention_id', interventionId)
    .in('kind', ['photos', ...PORTAL_INTERVENTION_DOCUMENT_KINDS])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Lecture des pièces impossible : ${error.message}`)
  }

  const rows = (data ?? []) as (PortalPhoto & {
    kind: string
    mime_type: string | null
    file_size: number | null
  })[]
  const asDocument = (r: (typeof rows)[number]): PortalDevis => ({
    id: r.id,
    url: r.url,
    filename: r.filename,
    kind: r.kind,
    mime_type: r.mime_type ?? null,
    file_size: r.file_size ?? null,
    created_at: r.created_at,
  })

  return {
    photos: rows
      .filter((r) => r.kind === 'photos')
      .map(({ id, url, filename, created_at, created_by_display, metadata }) => ({
        id, url, filename, created_at, created_by_display, metadata: metadata ?? {},
      })),
    devis: rows.filter((r) => r.kind === 'devis').map(asDocument),
    factures: rows.filter((r) => r.kind === 'facturesArtisans').map(asDocument),
  }
}
