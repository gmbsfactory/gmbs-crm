import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lecture des interventions d'un artisan pour le portail, avec minimisation
 * RGPD : jamais le téléphone du propriétaire, l'e-mail du gestionnaire,
 * le commentaire agent ni les factures GMBS ; le locataire n'est exposé que
 * pour les statuts où l'artisan doit le contacter (ACCEPTE, INTER_EN_COURS, SAV).
 */

/** Statuts visibles par l'artisan dans le portail. */
export const PORTAL_VISIBLE_STATUSES = ['ACCEPTE', 'INTER_EN_COURS', 'SAV', 'INTER_TERMINEE'] as const

/** Statuts pour lesquels le locataire est communiqué. */
export const PORTAL_TENANT_STATUSES = ['ACCEPTE', 'INTER_EN_COURS', 'SAV'] as const

/** Statuts pour lesquels un rapport peut être envoyé. */
export const PORTAL_REPORT_STATUSES = PORTAL_TENANT_STATUSES

/** Statuts comptés comme « en cours » dans les compteurs du profil. */
export const PORTAL_ONGOING_STATUSES = PORTAL_TENANT_STATUSES

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

interface AssignmentRow {
  role: string | null
  is_primary: boolean | null
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

/** Vrai si le statut fait partie de ceux visibles par l'artisan. */
export function isPortalVisibleStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_VISIBLE_STATUSES as readonly string[]).includes(code)
}

/** Vrai si le locataire doit être communiqué pour ce statut. */
export function isTenantVisibleStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_TENANT_STATUSES as readonly string[]).includes(code)
}

/** Vrai si un rapport peut être envoyé pour ce statut. */
export function isReportAllowedStatus(code: string | null | undefined): boolean {
  return !!code && (PORTAL_REPORT_STATUSES as readonly string[]).includes(code)
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
}

async function loadEnrichment(
  supabase: SupabaseClient,
  artisanId: string,
  interventionIds: string[],
): Promise<Enrichment> {
  const enrichment: Enrichment = { photosCount: new Map(), sstCosts: new Map(), reports: new Map() }
  if (interventionIds.length === 0) return enrichment

  const [photosRes, costsRes, reportsRes] = await Promise.all([
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

function mapIntervention(row: InterventionRow, role: PortalRole, enrichment: Enrichment): PortalInterventionDetail {
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
    tenant: tenant && isTenantVisibleStatus(code) ? { nom: tenantName, telephone: tenant.telephone } : null,
    cout_sst: cost,
    photos_count: enrichment.photosCount.get(row.id) ?? 0,
    report: report ? { status: report.status, version: report.version } : null,
    agence: agence ? { nom: agence.label } : null,
  }
}

/** Liste des interventions visibles de l'artisan, triées par `date_prevue`. */
export async function listPortalInterventions(
  supabase: SupabaseClient,
  artisanId: string,
): Promise<PortalInterventionListItem[]> {
  const { data, error } = await supabase
    .from('intervention_artisans')
    .select(`role, is_primary, intervention:interventions!intervention_id ( ${INTERVENTION_SELECT} )`)
    .eq('artisan_id', artisanId)

  if (error) {
    throw new Error(`Lecture des affectations impossible : ${error.message}`)
  }

  const assignments = ((data ?? []) as unknown as AssignmentRow[])
    .map((row) => ({ row, intervention: one(row.intervention) }))
    .filter((entry): entry is { row: AssignmentRow; intervention: InterventionRow } => {
      const i = entry.intervention
      return !!i && i.is_active !== false && isPortalVisibleStatus(one(i.statut)?.code)
    })

  const ids = assignments.map((a) => a.intervention.id)
  const enrichment = await loadEnrichment(supabase, artisanId, ids)

  const mapped = assignments.map(({ row, intervention }) => {
    const { agence: _agence, ...item } = mapIntervention(intervention, roleOf(row), enrichment)
    void _agence
    return item
  })

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
    .select(`role, is_primary, intervention:interventions!intervention_id ( ${INTERVENTION_SELECT} )`)
    .eq('artisan_id', artisanId)
    .eq('intervention_id', interventionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Lecture de l'intervention impossible : ${error.message}`)
  }
  const row = data as unknown as AssignmentRow | null
  const intervention = row ? one(row.intervention) : null
  if (!row || !intervention || intervention.is_active === false) return null
  if (!isPortalVisibleStatus(one(intervention.statut)?.code)) return null

  const enrichment = await loadEnrichment(supabase, artisanId, [intervention.id])
  return {
    intervention: mapIntervention(intervention, roleOf(row), enrichment),
    report: enrichment.reports.get(intervention.id) ?? null,
  }
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
}

/** Photos et devis d'une intervention (jamais les factures GMBS). */
export async function listPortalInterventionDocuments(
  supabase: SupabaseClient,
  interventionId: string,
): Promise<{ photos: PortalPhoto[]; devis: PortalDevis[] }> {
  const { data, error } = await supabase
    .from('intervention_attachments')
    .select('id, kind, url, filename, created_at, created_by_display, metadata')
    .eq('intervention_id', interventionId)
    .in('kind', ['photos', 'devis'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Lecture des pièces impossible : ${error.message}`)
  }

  const rows = (data ?? []) as (PortalPhoto & { kind: string })[]
  return {
    photos: rows
      .filter((r) => r.kind === 'photos')
      .map(({ id, url, filename, created_at, created_by_display, metadata }) => ({
        id, url, filename, created_at, created_by_display, metadata: metadata ?? {},
      })),
    devis: rows.filter((r) => r.kind === 'devis').map(({ id, url, filename }) => ({ id, url, filename })),
  }
}
