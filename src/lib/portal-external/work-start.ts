import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { interventionsApi } from '@/lib/api'
import { getCumulativeEntryRules, getEntryRulesForStatus } from '@/lib/workflow/cumulative-validation'
import type { WorkflowEntityContext } from '@/types/intervention-workflow'
import {
  findRecordedAction,
  normalizeOccurredAt,
  recordArtisanAction,
  type EventEnvelope,
} from './actions'
import { isStartAllowedStatus } from './interventions'
import { resolveArtisanOrder } from './price'

/**
 * Déclaration de début de chantier — `POST /me/interventions/{id}/start`
 * (spécification §4.2) et son repli gestionnaire
 * `PATCH /api/interventions/{id}/artisans/{artisanId}/start` (§4.3).
 *
 * **Règle P3 — le fait ne meurt pas de l'échec de la projection.**
 * `work_started_at` et la ligne de journal sont écrits *toujours*. La bascule
 * `ACCEPTE → INTER_EN_COURS` n'est qu'une **tentative** : si elle échoue, on
 * répond quand même `200`, avec `status_advanced: false` et la liste des champs
 * manquants. L'artisan n'est jamais bloqué par une dette de saisie du CRM ; le
 * CRM, lui, affiche « Démarré · n champs manquants ».
 *
 * La garde de transition est explicite et tient en trois points (§7.7) :
 * statut `ACCEPTE`, artisan affecté, `price_response = 'accepted'` — quelle
 * qu'en soit la source, sans quoi un artisan sans smartphone ne pourrait jamais
 * démarrer. **Rien d'autre n'est vérifié.**
 */

export interface MissingField {
  /** Clé de la règle de `VALIDATION_RULES` — stable, utilisable en test. */
  key: string
  /** Message métier déjà écrit dans la configuration du workflow. */
  label: string
}

export interface StartWorkPayload {
  started_at: string
  from: 'portal' | 'crm'
}

export type StartWorkResult =
  | {
      status: 200
      body: {
        work: StartWorkPayload
        statut_code: string | null
        status_advanced: boolean
        missing_fields: MissingField[]
        replayed?: boolean
      }
    }
  | { status: 404 | 409 | 500; body: { error: string } }

interface AssignmentRow {
  id: string
  role: string | null
  is_primary: boolean | null
  price_response: string | null
  work_started_at: string | null
  work_started_from: string | null
}

interface InterventionRow {
  id: string
  id_inter: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  contexte_intervention: string | null
  consigne_intervention: string | null
  date_prevue: string | null
  agence_id: string | null
  metier_id: string | null
  assigned_user_id: string | null
  tenant_id: string | null
  owner_id: string | null
  is_active: boolean | null
  statut: { code: string | null } | { code: string | null }[] | null
}

function statusCode(row: InterventionRow): string | null {
  const s = row.statut
  if (!s) return null
  return Array.isArray(s) ? s[0]?.code ?? null : s.code ?? null
}

const INTERVENTION_SELECT =
  'id, id_inter, adresse, code_postal, ville, contexte_intervention, consigne_intervention, ' +
  'date_prevue, agence_id, metier_id, assigned_user_id, tenant_id, owner_id, is_active, ' +
  'statut:intervention_statuses!statut_id ( code )'

/**
 * Champs qui manqueraient pour un passage « propre » en `INTER_EN_COURS`.
 *
 * On réutilise la configuration du workflow (`VALIDATION_RULES` d'entrée du
 * statut **plus** celles de ses prédécesseurs sur la chaîne cumulative) : ce
 * sont exactement les quatorze champs que le modal exige. On ne les redéclare
 * pas ici — les redéclarer, c'est les voir diverger.
 */
export function collectMissingFields(context: WorkflowEntityContext): MissingField[] {
  const rules = [...getEntryRulesForStatus('INTER_EN_COURS'), ...getCumulativeEntryRules('INTER_EN_COURS')]
  const vues = new Set<string>()
  const manquants: MissingField[] = []
  for (const rule of rules) {
    if (vues.has(rule.key)) continue
    vues.add(rule.key)
    if (!rule.validate(context)) manquants.push({ key: rule.key, label: rule.message })
  }
  return manquants
}

export interface StartWorkParams {
  supabase: SupabaseClient
  artisanId: string
  interventionId: string
  source: 'portal' | 'crm'
  /** Date de démarrage imposée par le gestionnaire (repli téléphone). */
  startedAt?: string | null
  actor?: { userId: string | null; label: string | null }
  envelope?: EventEnvelope | null
}

/** Enregistre le démarrage puis tente la transition ; renvoie code et corps. */
export async function startWork(params: StartWorkParams): Promise<StartWorkResult> {
  const { supabase, artisanId, interventionId, source } = params
  const envelope = params.envelope ?? null

  // 1. Rejeu hors ligne : même (artisan, event_uid) ⇒ 200 avec la date existante.
  if (envelope) {
    const deja = await findRecordedAction(supabase, artisanId, envelope.event_uid)
    if (deja) {
      const current = await loadAssignment(supabase, interventionId, artisanId)
      const intervention = await loadIntervention(supabase, interventionId)
      if (!current || !intervention || !current.work_started_at) {
        return { status: 404, body: { error: 'Intervention not found' } }
      }
      return {
        status: 200,
        body: {
          work: { started_at: current.work_started_at, from: (current.work_started_from as 'portal' | 'crm') ?? source },
          statut_code: statusCode(intervention),
          status_advanced: false,
          missing_fields: [],
          replayed: true,
        },
      }
    }
  }

  const assignment = await loadAssignment(supabase, interventionId, artisanId)
  if (!assignment) return { status: 404, body: { error: 'Intervention not found' } }

  const intervention = await loadIntervention(supabase, interventionId)
  if (!intervention || intervention.is_active === false) {
    return { status: 404, body: { error: 'Intervention not found' } }
  }

  // 2. Idempotence par le FAIT, pas seulement par la clé : un second appel
  //    (nouvelle clé, réinstallation de l'application) renvoie la même date.
  //    C'est aussi ce qui évite un 409 après que la transition a fait passer
  //    l'intervention en INTER_EN_COURS.
  if (assignment.work_started_at) {
    return {
      status: 200,
      body: {
        work: {
          started_at: assignment.work_started_at,
          from: (assignment.work_started_from as 'portal' | 'crm') ?? source,
        },
        statut_code: statusCode(intervention),
        status_advanced: false,
        missing_fields: [],
      },
    }
  }

  // 3. Garde explicite, et seulement elle.
  if (!isStartAllowedStatus(statusCode(intervention))) {
    return { status: 409, body: { error: 'status_not_allowed' } }
  }
  if (assignment.price_response !== 'accepted') {
    return { status: 409, body: { error: 'price_not_accepted' } }
  }

  // 4. LE FAIT, D'ABORD. Il est écrit avant toute tentative de projection.
  const declaree = params.startedAt ?? envelope?.occurred_at_declared ?? null
  const clock = normalizeOccurredAt(declaree)
  // Le FAIT et sa TRACE n'ont pas les mêmes bornes. `occurred_at` du journal est
  // borné à [now − 7 j, now + 5 min] par le CHECK de 99079 ; `work_started_at`,
  // lui, doit accepter la correction d'un gestionnaire — « il avait démarré le
  // 20 août », un cas de rattrapage réel. Côté portail, en revanche, on garde la
  // valeur recalée : l'horloge d'un téléphone n'est pas une source d'autorité.
  const saisieGestionnaire = source === 'crm' && params.startedAt ? new Date(params.startedAt) : null
  const startedAt =
    saisieGestionnaire && !Number.isNaN(saisieGestionnaire.getTime())
      ? saisieGestionnaire.toISOString()
      : clock.occurred_at
  const { error: updateError } = await supabase
    .from('intervention_artisans')
    .update({
      work_started_at: startedAt,
      work_started_from: source,
      work_started_by: params.actor?.userId ?? null,
    })
    .eq('id', assignment.id)
  if (updateError) {
    console.error('[portal-external] Démarrage non enregistré :', updateError.message)
    return { status: 500, body: { error: 'Failed to save work start' } }
  }

  await recordArtisanAction(supabase, {
    artisanId,
    actionType: 'WORK_STARTED',
    source,
    interventionId,
    actorUserId: params.actor?.userId ?? null,
    actorLabel: params.actor?.label ?? null,
    intervention: { id: intervention.id, id_inter: intervention.id_inter, adresse: intervention.adresse },
    payload: { started_at: startedAt },
    envelope,
    clock,
  })

  // 5. LA PROJECTION, ENSUITE — et son échec n'est pas une erreur pour l'artisan.
  const context = await buildWorkflowContext(supabase, intervention, artisanId)
  const missing = collectMissingFields(context)
  const advanced = await tryAdvanceToInProgress(supabase, intervention)

  return {
    status: 200,
    body: {
      work: { started_at: startedAt, from: source },
      statut_code: advanced ? 'INTER_EN_COURS' : statusCode(intervention),
      status_advanced: advanced,
      missing_fields: missing,
    },
  }
}

/**
 * Tentative de bascule `ACCEPTE → INTER_EN_COURS`.
 *
 * **Écart assumé avec la spécification §7.7** : elle demande d'appeler
 * `transitionStatus`. C'est impossible en l'état — `assertBusinessRules` exige
 * un `artisanId` pour `INTER_EN_COURS`, et le passer fait écrire
 * `interventions.artisan_id`, colonne qui **n'existe pas** dans le schéma
 * (PostgREST `PGRST204`, vérifié sur la base locale). On appelle donc
 * directement `interventionsApi.update`, c'est-à-dire la fonction à laquelle
 * `transitionStatus` délègue : le trigger d'historisation des transitions et le
 * recalcul des statuts artisans jouent exactement de la même façon.
 *
 * Ne renvoie jamais d'exception : un échec vaut `status_advanced: false`.
 */
async function tryAdvanceToInProgress(
  supabase: SupabaseClient,
  intervention: InterventionRow,
): Promise<boolean> {
  try {
    const { data: statut } = await supabase
      .from('intervention_statuses')
      .select('id')
      .eq('code', 'INTER_EN_COURS')
      .maybeSingle()
    const statutId = (statut as { id: string } | null)?.id
    if (!statutId) {
      console.error("[portal-external] Statut INTER_EN_COURS introuvable : bascule ignorée")
      return false
    }

    // Effet de bord repris du chemin Kanban (`computeDueDate`) : une échéance à
    // sept jours, mais SEULEMENT si la date prévue est absente. L'écraser
    // déplacerait une date que l'artisan et le gestionnaire ont sous les yeux.
    const datePrevue = intervention.date_prevue ?? addDays(new Date(), 7).toISOString()

    await interventionsApi.update(intervention.id, {
      statut_id: statutId,
      date_prevue: datePrevue,
    } as Parameters<typeof interventionsApi.update>[1])
    return true
  } catch (error) {
    console.warn(
      '[portal-external] Bascule INTER_EN_COURS refusée, le démarrage reste enregistré :',
      error instanceof Error ? error.message : error,
    )
    return false
  }
}

/** Contexte de validation du workflow, assemblé depuis la base. */
async function buildWorkflowContext(
  supabase: SupabaseClient,
  intervention: InterventionRow,
  artisanId: string,
): Promise<WorkflowEntityContext> {
  const order = await resolveArtisanOrder(supabase, intervention.id, artisanId)

  const [costsRes, tenantRes, ownerRes] = await Promise.all([
    supabase
      .from('intervention_costs')
      .select('cost_type, amount, artisan_order')
      .eq('intervention_id', intervention.id),
    intervention.tenant_id
      ? supabase
          .from('tenants')
          .select('firstname, lastname, plain_nom_client, telephone')
          .eq('id', intervention.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    intervention.owner_id
      ? supabase
          .from('owner')
          .select('owner_firstname, owner_lastname, plain_nom_facturation')
          .eq('id', intervention.owner_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const costs = (costsRes.data ?? []) as {
    cost_type: string
    amount: number | string
    artisan_order: number | null
  }[]
  const nombre = (value: number | string | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  const coutIntervention = nombre(costs.find((c) => c.cost_type === 'intervention')?.amount)
  const coutSST = nombre(
    (costs.find((c) => c.cost_type === 'sst' && (c.artisan_order ?? 1) === order) ??
      costs.find((c) => c.cost_type === 'sst'))?.amount,
  )

  const tenant = tenantRes.data as {
    firstname: string | null
    lastname: string | null
    plain_nom_client: string | null
    telephone: string | null
  } | null
  const owner = ownerRes.data as {
    owner_firstname: string | null
    owner_lastname: string | null
    plain_nom_facturation: string | null
  } | null

  return {
    id: intervention.id,
    idIntervention: intervention.id_inter,
    artisanId,
    agenceId: intervention.agence_id,
    metierId: intervention.metier_id,
    adresse: intervention.adresse,
    contexteIntervention: intervention.contexte_intervention,
    assignedUserId: intervention.assigned_user_id,
    nomPrenomFacturation:
      owner?.plain_nom_facturation ||
      [owner?.owner_firstname, owner?.owner_lastname].filter(Boolean).join(' ') ||
      null,
    coutIntervention,
    coutSST,
    consigneArtisan: intervention.consigne_intervention,
    nomPrenomClient:
      tenant?.plain_nom_client || [tenant?.firstname, tenant?.lastname].filter(Boolean).join(' ') || null,
    telephoneClient: tenant?.telephone ?? null,
    datePrevue: intervention.date_prevue,
  }
}

async function loadAssignment(
  supabase: SupabaseClient,
  interventionId: string,
  artisanId: string,
): Promise<AssignmentRow | null> {
  const { data } = await supabase
    .from('intervention_artisans')
    .select('id, role, is_primary, price_response, work_started_at, work_started_from')
    .eq('intervention_id', interventionId)
    .eq('artisan_id', artisanId)
    .maybeSingle()
  return (data as AssignmentRow | null) ?? null
}

async function loadIntervention(
  supabase: SupabaseClient,
  interventionId: string,
): Promise<InterventionRow | null> {
  const { data } = await supabase
    .from('interventions')
    .select(INTERVENTION_SELECT)
    .eq('id', interventionId)
    .maybeSingle()
  return (data as unknown as InterventionRow | null) ?? null
}
