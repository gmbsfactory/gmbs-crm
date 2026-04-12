import { addDays } from "date-fns"
import { INTERVENTION_STATUS_ORDER } from "@/config/interventions"
import {
  CreateInterventionSchema,
  DuplicateCheckSchema,
  type CreateInterventionInput,
  type DuplicateCheckInput,
  type InterventionStatusValue,
  type InterventionWithDocuments,
  type UpdateInterventionInput,
  UpdateInterventionSchema,
} from "@/types/interventions"
import {
  buildDuplicateSummary,
  buildInsertPayload,
  buildStatusUpdatePayload,
  buildUpdatePayload,
  mapRowToIntervention,
  mapRowToInterventionWithDocuments,
  mapStatusFromDb,
  mapStatusToDb,
} from "@/lib/interventions/mappers"
import { listInterventionDocuments } from "@/lib/api/documents"
import { interventionsApi } from "@/lib/api/v2"
import type { InterventionStatus } from "@/types/intervention"

// Dynamic import to avoid pulling next/headers into client bundles
// (this file is also imported by client hooks for transitionStatus)
async function getServerClient() {
  const { createSSRServerClient } = await import("@/lib/supabase/server-ssr")
  return createSSRServerClient()
}

const DEFAULT_LIMIT = 50

export type ListParams = {
  status?: InterventionStatusValue
  search?: string
  take?: number
  skip?: number
  withDocuments?: boolean
}

export type ListResult = {
  data: InterventionWithDocuments[]
  total: number
}

const computeDueDate = (payload: { status?: InterventionStatusValue; dueAt?: Date | string | null }) => {
  if (payload.status === "INTER_EN_COURS") {
    if (!payload.dueAt) {
      return addDays(new Date(), 7)
    }
  }
  if (!payload.dueAt) return null
  if (payload.dueAt instanceof Date) return payload.dueAt
  return new Date(payload.dueAt)
}

const assertBusinessRules = (payload: { status?: InterventionStatusValue | null; artisanId?: string | null }) => {
  if (payload.status && ["VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE"].includes(payload.status) && !payload.artisanId) {
    throw new Error("Un artisan assigné est requis pour ce statut")
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUUID = (value: string) => UUID_REGEX.test(value)

const escapeIlike = (value: string) => value.replace(/[%_]/g, (match) => `\\${match}`)

export async function listInterventions(params: ListParams = {}): Promise<ListResult> {
  const supabase = await getServerClient()
  const take = params.take ?? DEFAULT_LIMIT
  const skip = params.skip ?? 0

  let query = supabase
    .from("interventions")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(skip, skip + take - 1)

  if (params.status) {
    query = query.eq("statut", mapStatusToDb(params.status))
  }

  if (params.search) {
    const search = escapeIlike(params.search.trim())
    const pattern = `%${search}%`
    query = query.or(
      `contexte_intervention.ilike.${pattern},commentaire_agent.ilike.${pattern},adresse.ilike.${pattern}`,
    )
  }

  const { data, error, count } = await query
  if (error) {
    throw new Error(`Impossible de récupérer les interventions: ${error.message}`)
  }

  const rows = data ?? []
  const mapped = rows.map((row) => mapRowToInterventionWithDocuments(row))

  return {
    data: mapped,
    total: count ?? mapped.length,
  }
}

type GetParams = {
  id: string
  includeDocuments?: boolean
}

export async function getIntervention({ id, includeDocuments = true }: GetParams) {
  const supabase = await getServerClient()
  const { data, error } = await supabase.from("interventions").select("*").eq("id", id).maybeSingle()

  if (error) {
    throw new Error(`Erreur lors de la récupération de l'intervention: ${error.message}`)
  }
  if (!data) return null

  const intervention = mapRowToIntervention(data)
  if (!includeDocuments) {
    return intervention
  }

  const documents = await listInterventionDocuments(id)
  return { ...intervention, documents }
}

export async function findDuplicates(input: DuplicateCheckInput, supabaseClient?: Awaited<ReturnType<typeof getServerClient>>) {
  const supabase = supabaseClient ?? await getServerClient()
  const { name, address, agency } = DuplicateCheckSchema.parse(input)
  const results = new Map<string, ReturnType<typeof buildDuplicateSummary>[number]>()

  const normalizedAddress = address.trim()
  const normalizedContext = name.trim()

  if (normalizedContext && normalizedAddress) {
    const { data, error } = await supabase
      .from("interventions")
      .select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
      .eq("adresse", normalizedAddress)
      .eq("contexte_intervention", normalizedContext)
      .eq("is_active", true)
      .limit(5)

    if (!error && data) {
      for (const item of buildDuplicateSummary(data)) {
        results.set(item.id, item)
      }
    }
  }

  if (agency) {
    const { data, error } = await supabase
      .from("interventions")
      .select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
      .eq("adresse", normalizedAddress)
      .eq("agence_id", agency.trim())
      .eq("is_active", true)
      .limit(5)

    if (!error && data) {
      for (const item of buildDuplicateSummary(data)) {
        results.set(item.id, item)
      }
    }
  }

  return Array.from(results.values())
}

export async function createIntervention(payload: CreateInterventionInput) {
  const parsed = CreateInterventionSchema.parse(payload)
  assertBusinessRules(parsed)

  const duplicates = await findDuplicates(parsed)
  if (duplicates.length > 0) {
    return { duplicates }
  }

  const dueAt = computeDueDate(parsed)
  const supabase = await getServerClient()

  const insertPayload = buildInsertPayload({ ...parsed, dueAt: dueAt ?? undefined })

  const { data, error } = await supabase
    .from("interventions")
    .insert(insertPayload)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Échec de la création de l'intervention: ${error?.message ?? "unknown"}`)
  }

  const intervention = mapRowToInterventionWithDocuments(data)
  return { intervention }
}

export async function updateIntervention(id: string, payload: UpdateInterventionInput) {
  const parsed = UpdateInterventionSchema.parse(payload)
  assertBusinessRules(parsed)

  const dueAt = computeDueDate(parsed)
  const supabase = await getServerClient()

  const updatePayload = buildUpdatePayload({ ...parsed, dueAt: dueAt ?? undefined })

  const { data, error } = await supabase
    .from("interventions")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Échec de la mise à jour de l'intervention: ${error?.message ?? "unknown"}`)
  }

  return mapRowToInterventionWithDocuments(data)
}

export async function deleteIntervention(id: string) {
  const supabase = await getServerClient()
  const { error } = await supabase.from("interventions").delete().eq("id", id)
  if (error) {
    throw new Error(`Impossible de supprimer l'intervention: ${error.message}`)
  }
}

export type StatusPayload = {
  status: InterventionStatusValue
  dueAt?: Date | string | null
  artisanId?: string | null
}

export async function transitionStatus(id: string, payload: StatusPayload) {
  assertBusinessRules(payload)
  const dueAt = computeDueDate(payload)
  const statusInput = payload.status

  let resolvedStatus: InterventionStatus | null = null
  let statusId: string | null = null

  if (isUUID(statusInput)) {
    statusId = statusInput
  } else {
    resolvedStatus =
      (await interventionsApi.getStatusByCode(statusInput)) ??
      (await interventionsApi.getStatusByLabel(statusInput))

    if (!resolvedStatus) {
      throw new Error(`Statut "${statusInput}" introuvable`)
    }

    statusId = resolvedStatus.id
  }

  if (!statusId) {
    throw new Error("Statut cible non défini")
  }

  const legacyPayload = buildStatusUpdatePayload(payload.status, dueAt, payload.artisanId ?? null)
  const datePrevueUpdate =
    legacyPayload.date_prevue === undefined ? undefined : legacyPayload.date_prevue ?? null
  const artisanIdUpdate =
    payload.artisanId === undefined ? undefined : payload.artisanId ?? undefined

  const updated = await interventionsApi.update(id, {
    statut_id: statusId,
    artisan_id: artisanIdUpdate,
    date_prevue: datePrevueUpdate,
  })

  const mapped = mapRowToInterventionWithDocuments({
    ...updated,
    statut: updated.status?.code ?? payload.status,
    statut_id: updated.status?.id ?? statusId ?? updated.statut_id ?? null,
  })

  return {
    ...mapped,
    status: updated.status ?? resolvedStatus,
    statusColor: updated.status?.color ?? null,
  }
}

export function getStatusSortIndex(status: InterventionStatusValue) {
  return INTERVENTION_STATUS_ORDER.indexOf(status) ?? 0
}

/**
 * Duplique une intervention pour créer un "devis supp"
 * - Récupère l'intervention originale
 * - Crée une nouvelle intervention avec les mêmes données sauf contexte et consignes (null)
 * - Crée un commentaire système avec l'ID de l'intervention originale
 * @param originalId - ID de l'intervention à dupliquer
 * @param authorId - ID de l'utilisateur qui effectue la duplication
 * @param token - Token d'authentification optionnel pour les opérations Supabase
 */
export async function duplicateIntervention(originalId: string, authorId: string) {
  // @supabase/ssr lit automatiquement les cookies de session
  const supabase = await getServerClient()
  
  // Récupérer l'intervention originale avec le client authentifié
  const { data: originalData, error: fetchError } = await supabase
    .from("interventions")
    .select("*")
    .eq("id", originalId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Erreur lors de la récupération de l'intervention: ${fetchError.message}`)
  }
  if (!originalData) {
    throw new Error(`Intervention originale introuvable: ${originalId}`)
  }

  // Utiliser les données brutes de la base de données pour créer le payload de duplication
  // Créer le payload de duplication en excluant contexte et consignes
  // Mapper les données de la base vers le format CreateInterventionInput
  const duplicatePayload: CreateInterventionInput = {
    name: originalData.commentaire_agent ?? originalData.contexte_intervention ?? originalData.adresse ?? "Intervention",
    address: originalData.adresse ?? "",
    context: "Devis supplémentaire", // Valeur par défaut pour devis supp (le contexte original est exclu)
    agency: originalData.agence ?? originalData.agence_id ?? "",
    metier: originalData.metier_id ?? "",
    consigne: undefined, // Forcer consigne à undefined pour devis supp
    status: originalData.statut ? mapStatusFromDb(originalData.statut) : "DEMANDE",
    dueAt: originalData.date_prevue ? new Date(originalData.date_prevue) : undefined,
    artisanId: originalData.artisan_id ?? null,
    managerId: originalData.attribue_a ?? null,
  }

  // Clarification FR-006 : Ignorer la vérification de doublons pour permettre plusieurs devis supplémentaires
  // La vérification de doublons est désactivée lors de la duplication "Devis supp" pour permettre
  // la création de plusieurs devis supplémentaires pour une même demande
  // const duplicates = await findDuplicates(duplicatePayload, supabase)
  // if (duplicates.length > 0) {
  //   throw new Error("Des doublons ont été détectés lors de la duplication")
  // }

  // Créer la nouvelle intervention avec le client authentifié
  const parsed = CreateInterventionSchema.parse(duplicatePayload)
  assertBusinessRules(parsed)
  const dueAt = computeDueDate(parsed)
  const insertPayload = buildInsertPayload({ ...parsed, dueAt: dueAt ?? undefined })

  const { data: newData, error: createError } = await supabase
    .from("interventions")
    .insert(insertPayload)
    .select("*")
    .single()

  if (createError || !newData) {
    throw new Error(`Échec de la création de l'intervention: ${createError?.message ?? "unknown"}`)
  }

  const newIntervention = mapRowToInterventionWithDocuments(newData)

  // Note: Le commentaire système est créé dans la route API avec le client Supabase authentifié
  // pour éviter les problèmes d'authentification côté serveur

  return newIntervention
}
