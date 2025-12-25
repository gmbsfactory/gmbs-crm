import type {
  CreateInterventionInput,
  InterventionDTO,
  InterventionStatusValue,
  InterventionWithDocuments,
  UpdateInterventionInput,
} from "@/types/interventions"

export type InterventionRow = Record<string, any>
export type InterventionInsert = Record<string, any>
export type InterventionUpdate = Record<string, any>

const normalizeStatusInput = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()

const STATUS_FROM_DB_NORMALIZED: Record<string, InterventionStatusValue> = {
  DEMANDE: "DEMANDE",
  DEVIS_ENVOYE: "DEVIS_ENVOYE",
  VISITE_TECHNIQUE: "VISITE_TECHNIQUE",
  REFUSE: "REFUSE",
  ANNULE: "ANNULE",
  STAND_BY: "STAND_BY",
  ACCEPTE: "ACCEPTE",
  INTER_EN_COURS: "INTER_EN_COURS",
  INTER_TERMINEE: "INTER_TERMINEE",
  CLOTURE: "INTER_TERMINEE",
  CLOTUREE: "INTER_TERMINEE",
  SAV: "SAV",
  ATT_ACOMPTE: "ATT_ACOMPTE",
  ATTENTE_ACOMPTE: "ATT_ACOMPTE",
  POTENTIEL: "POTENTIEL",
}

export const STATUS_TO_DB: Record<InterventionStatusValue, string> = {
  DEMANDE: "DEMANDE",
  DEVIS_ENVOYE: "DEVIS_ENVOYE",
  VISITE_TECHNIQUE: "VISITE_TECHNIQUE",
  REFUSE: "REFUSE",
  ANNULE: "ANNULE",
  STAND_BY: "STAND_BY",
  ACCEPTE: "ACCEPTE",
  INTER_EN_COURS: "INTER_EN_COURS",
  INTER_TERMINEE: "INTER_TERMINEE",
  SAV: "SAV",
  ATT_ACOMPTE: "ATT_ACOMPTE",
  POTENTIEL: "POTENTIEL",
}

export const DEFAULT_STATUS: InterventionStatusValue = "DEMANDE"

const coerceNullableString = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeDateInput = (value: unknown) => {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString()
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`).toISOString()
    }
    return trimmed
  }
  return null
}

export const mapStatusToDb = (status?: InterventionStatusValue | null) => {
  if (!status) return STATUS_TO_DB[DEFAULT_STATUS]
  return STATUS_TO_DB[status] ?? STATUS_TO_DB[DEFAULT_STATUS]
}

export const mapStatusFromDb = (status?: string | null): InterventionStatusValue => {
  if (!status) return DEFAULT_STATUS
  const normalized = normalizeStatusInput(status)
  return STATUS_FROM_DB_NORMALIZED[normalized] ?? DEFAULT_STATUS
}

const deriveName = (row: { commentaire_agent?: string | null; contexte_intervention?: string | null; adresse?: string | null }) => {
  const name = coerceNullableString(row.commentaire_agent)
  if (name) return name
  const context = coerceNullableString(row.contexte_intervention)
  if (context) return context.length > 80 ? `${context.slice(0, 77)}…` : context
  const address = coerceNullableString(row.adresse)
  if (address) return address
  return "Intervention"
}

export const mapRowToIntervention = (row: InterventionRow): InterventionDTO => {
  const status = mapStatusFromDb(row.statut)
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: deriveName(row),
    agency: coerceNullableString(row.agence),
    address: coerceNullableString(row.adresse) ?? "",
    context: coerceNullableString(row.contexte_intervention) ?? "",
    consigne: coerceNullableString(row.consigne_intervention),
    status,
    statusChangedAt: row.updated_at,
    dueAt: row.date_prevue,
    invoice2goId: row.id_facture ? String(row.id_facture) : null,
    artisanId: row.artisan_id ?? null,
    managerId: row.attribue_a ? String(row.attribue_a) : null,
    isValidated: Boolean(row.id_facture),
  }
}

export const mapRowToInterventionWithDocuments = (row: InterventionRow): InterventionWithDocuments => ({
  ...mapRowToIntervention(row),
  documents: [],
})

export const buildInsertPayload = (input: CreateInterventionInput): InterventionInsert => {
  const now = new Date().toISOString()
  const statusDb = mapStatusToDb(input.status)
  const context = coerceNullableString(input.context) ?? coerceNullableString(input.name) ?? ""
  const comment = coerceNullableString(input.name)
  const invoiceNumber = coerceNullableString(input.invoice2goId)

  return {
    date: now,
    updated_at: now,
    agence: coerceNullableString(input.agency),
    adresse: coerceNullableString(input.address) ?? "",
    contexte_intervention: context,
    commentaire_agent: comment,
    consigne_intervention: coerceNullableString(input.consigne),
    statut: statusDb,
    date_prevue: normalizeDateInput(input.dueAt),
    attribue_a: coerceNullableString(input.managerId),
    artisan_id: coerceNullableString(input.artisanId),
    id_facture: invoiceNumber ? Number.parseInt(invoiceNumber, 10) || null : null,
  } as InterventionInsert
}

export const buildUpdatePayload = (input: UpdateInterventionInput): InterventionUpdate => {
  const payload: InterventionUpdate = {}

  if (input.name !== undefined) {
    payload.commentaire_agent = coerceNullableString(input.name)
  }
  if (input.address !== undefined) {
    payload.adresse = coerceNullableString(input.address)
  }
  if (input.context !== undefined) {
    const context = coerceNullableString(input.context) ?? coerceNullableString(input.name) ?? null
    payload.contexte_intervention = context
  }
  if (input.agency !== undefined) {
    payload.agence = coerceNullableString(input.agency)
  }
  if (input.consigne !== undefined) {
    payload.consigne_intervention = coerceNullableString(input.consigne)
  }
  if (input.status !== undefined) {
    payload.statut = mapStatusToDb(input.status)
  }
  if (input.dueAt !== undefined) {
    payload.date_prevue = normalizeDateInput(input.dueAt)
  }
  if (input.artisanId !== undefined) {
    payload.artisan_id = coerceNullableString(input.artisanId)
  }
  if (input.managerId !== undefined) {
    payload.attribue_a = coerceNullableString(input.managerId)
  }
  if (input.invoice2goId !== undefined) {
    const invoiceNumber = coerceNullableString(input.invoice2goId)
    payload.id_facture = invoiceNumber ? Number.parseInt(invoiceNumber, 10) || null : null
  }
  if (Object.keys(payload).length) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export const buildStatusUpdatePayload = (
  status: InterventionStatusValue,
  dueAt?: Date | string | null,
  artisanId?: string | null,
): InterventionUpdate => ({
  statut: mapStatusToDb(status),
  date_prevue: dueAt !== undefined ? normalizeDateInput(dueAt) : undefined,
  artisan_id: artisanId !== undefined ? coerceNullableString(artisanId) : undefined,
  updated_at: new Date().toISOString(),
})

type DuplicateRow = Pick<InterventionRow, "id" | "adresse" | "contexte_intervention" | "commentaire_agent"> & {
  agence?: string | null
  agence_id?: string | null
}

export const buildDuplicateSummary = (rows: DuplicateRow[]) =>
  rows.map((row) => ({
    id: row.id,
    name: deriveName(row),
    address: coerceNullableString(row.adresse) ?? "",
    agency: coerceNullableString(row.agence ?? row.agence_id ?? null),
  }))
