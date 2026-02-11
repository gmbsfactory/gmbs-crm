import { useCallback, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { supabase } from "@/lib/supabase-client"
import {
  buildDuplicateSummary,
  buildInsertPayload,
  buildUpdatePayload,
  mapRowToInterventionWithDocuments,
} from "@/lib/interventions/mappers"
import type {
  CreateInterventionInput,
  InterventionStatusValue,
  UpdateInterventionInput,
} from "@/types/interventions"
import { CreateInterventionSchema, UpdateInterventionSchema } from "@/types/interventions"

const DEFAULT_LIMIT_DUPLICATES = 5
const REQUIRES_ARTISAN_STATUSES: InterventionStatusValue[] = [
  "VISITE_TECHNIQUE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "ATT_ACOMPTE",
]

const toDateInputValue = (value: unknown) => {
  if (!value) return undefined
  const date = typeof value === "string" ? new Date(value) : (value as Date)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

const computeDueDate = (payload: { status?: InterventionStatusValue; dueAt?: Date | string | null }) => {
  if (payload.status === "INTER_EN_COURS") {
    if (!payload.dueAt) {
      const date = new Date()
      date.setDate(date.getDate() + 7)
      return date
    }
  }
  if (!payload.dueAt) return null
  if (payload.dueAt instanceof Date) return payload.dueAt
  return new Date(payload.dueAt)
}

const ensureBusinessRules = (status?: InterventionStatusValue, artisanId?: string | null) => {
  if (status && REQUIRES_ARTISAN_STATUSES.includes(status) && !artisanId) {
    throw new Error("Un artisan assigné est requis pour ce statut")
  }
}

type UseInterventionFormParams = {
  mode: "create" | "edit"
  interventionId?: string
  defaultValues?: Partial<CreateInterventionInput & UpdateInterventionInput>
  onSuccess?: (payload: unknown) => void
  canEditContext?: boolean
}

type DuplicateSummary = {
  id: string
  name: string
  address: string
  agencyId?: string | null
  agencyLabel?: string | null
  managerName?: string | null
}

type DuplicateCheckResult = {
  blockingDuplicates: DuplicateSummary[] // adresse + contexte exact
  confirmableDuplicates: DuplicateSummary[] // adresse + agence (besoin confirmation)
}

export function useInterventionForm({
  mode,
  interventionId,
  defaultValues,
  onSuccess,
  canEditContext = true,
}: UseInterventionFormParams) {
  const resolver = useMemo(
    () => (mode === "create" ? zodResolver(CreateInterventionSchema) : zodResolver(UpdateInterventionSchema)),
    [mode],
  )

  const normalizedDefaults = useMemo(() => {
    if (!defaultValues) return undefined
    return {
      ...defaultValues,
      status: (defaultValues.status as InterventionStatusValue | undefined) ?? "POTENTIEL",
      dueAt: toDateInputValue(defaultValues.dueAt),
    } as Partial<CreateInterventionInput & UpdateInterventionInput>
  }, [defaultValues])

  const form = useForm<CreateInterventionInput | UpdateInterventionInput>({
    resolver,
    defaultValues: {
      status: "POTENTIEL",
      ...normalizedDefaults,
    },
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateSummary[]>([])
  const [confirmableDuplicates, setConfirmableDuplicates] = useState<DuplicateSummary[]>([])
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false)

  const runDuplicateCheck = useCallback(async (payload: { name: string; address: string; agency?: string }): Promise<DuplicateCheckResult> => {
    const name = payload.name?.trim()
    const address = payload.address?.trim()
    if (!name || !address) return { blockingDuplicates: [], confirmableDuplicates: [] }

    const blockingResults = new Map<string, DuplicateSummary>()
    const confirmableResults = new Map<string, DuplicateSummary>()

    // Règle 1 : Adresse + Contexte exact (bloque silencieusement)
    const { data: exactMatches } = await supabase
      .from("interventions")
      .select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
      .eq("adresse", address)
      .eq("contexte_intervention", name)
      .limit(DEFAULT_LIMIT_DUPLICATES)

    if (exactMatches) {
      for (const item of buildDuplicateSummary(exactMatches)) {
        blockingResults.set(item.id, item)
      }
    }

    // Règle 2 : Adresse + Agence (demande confirmation avec infos enrichies)
    if (payload.agency) {
      const agency = payload.agency.trim()
      if (agency) {
        const { data: agencyMatches } = await supabase
          .from("interventions")
          .select(`
            id,
            contexte_intervention,
            adresse,
            agence_id,
            commentaire_agent,
            agences:agence_id(label),
            users:assigned_user_id(firstname, lastname)
          `)
          .eq("adresse", address)
          .eq("agence_id", agency)
          .limit(DEFAULT_LIMIT_DUPLICATES)

        if (agencyMatches) {
          for (const match of agencyMatches) {
            // Ne pas ajouter si déjà dans blockingResults
            if (!blockingResults.has(match.id)) {
              const agencyData = match.agences as any
              const userData = match.users as any

              confirmableResults.set(match.id, {
                id: match.id,
                name: match.contexte_intervention || match.commentaire_agent || "Intervention sans nom",
                address: match.adresse || "",
                agencyId: match.agence_id,
                agencyLabel: agencyData?.label || null,
                managerName: userData ? `${userData.firstname || ''} ${userData.lastname || ''}`.trim() || null : null,
              })
            }
          }
        }
      }
    }

    return {
      blockingDuplicates: Array.from(blockingResults.values()),
      confirmableDuplicates: Array.from(confirmableResults.values()),
    }
  }, [])

  const submit = form.handleSubmit(async (values) => {
    setIsSubmitting(true)
    setServerError(null)
    setDuplicates([])
    setConfirmableDuplicates([])

    try {
      const dueAtValue = (() => {
        if (!values.dueAt) return undefined
        if (values.dueAt instanceof Date) return values.dueAt
        if (typeof values.dueAt === "string") {
          const parsed = new Date(values.dueAt)
          return Number.isNaN(parsed.getTime()) ? undefined : parsed
        }
        return undefined
      })()

      const normalizedValues = {
        ...values,
        status: values.status as InterventionStatusValue | undefined,
        dueAt: dueAtValue,
      }

      const dueAt = computeDueDate(normalizedValues)
      ensureBusinessRules(normalizedValues.status, normalizedValues.artisanId as string | null | undefined)

      if (mode === "create") {
        // Vérifier les doublons sauf si l'utilisateur a confirmé
        if (!skipDuplicateCheck) {
          const dupCheck = await runDuplicateCheck({
            name: String(values.name ?? ""),
            address: String(values.address ?? ""),
            agency: values.agency ? String(values.agency) : undefined,
          })

          // S'il y a des doublons bloquants (adresse + contexte exact), on bloque
          if (dupCheck.blockingDuplicates.length > 0) {
            setDuplicates(dupCheck.blockingDuplicates)
            return
          }

          // S'il y a des doublons confirmables (adresse + agence), on demande confirmation
          if (dupCheck.confirmableDuplicates.length > 0) {
            setConfirmableDuplicates(dupCheck.confirmableDuplicates)
            return
          }
        }

        // Réinitialiser le flag de skip après utilisation
        setSkipDuplicateCheck(false)

        const insertPayload = buildInsertPayload({ ...normalizedValues, dueAt: dueAt ?? undefined } as CreateInterventionInput)
        const { data, error } = await supabase
          .from("interventions")
          .insert(insertPayload)
          .select("*")
          .single()

        if (error) {
          throw new Error(error.message)
        }

        const mapped = mapRowToInterventionWithDocuments(data)
        onSuccess?.(mapped)
      } else {
        if (!interventionId) {
          throw new Error("Identifiant intervention manquant")
        }

        const updatePayload = buildUpdatePayload({ ...normalizedValues, dueAt: dueAt ?? undefined } as UpdateInterventionInput)
        if (!canEditContext) {
          delete updatePayload.contexte_intervention
        }
        const { data, error } = await supabase
          .from("interventions")
          .update(updatePayload)
          .eq("id", interventionId)
          .select("*")
          .single()

        if (error) {
          throw new Error(error.message)
        }

        const mapped = mapRowToInterventionWithDocuments(data)
        onSuccess?.(mapped)
      }
    } catch (error) {
      setServerError((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  })

  const checkDuplicates = useCallback(
    async (payload: { name: string; address: string; agency?: string }) => {
      if (!payload.name || !payload.address) return
      try {
        const dupCheck = await runDuplicateCheck(payload)
        setDuplicates(dupCheck.blockingDuplicates)
        setConfirmableDuplicates(dupCheck.confirmableDuplicates)
      } catch (error) {
        console.warn("[useInterventionForm] duplicate check failed", error)
      }
    },
    [runDuplicateCheck],
  )

  const confirmAndSubmit = useCallback(() => {
    setSkipDuplicateCheck(true)
    setConfirmableDuplicates([])
    // Soumettre le formulaire à nouveau
    submit()
  }, [submit])

  const cancelDuplicateConfirmation = useCallback(() => {
    setConfirmableDuplicates([])
    setIsSubmitting(false)
  }, [])

  return {
    form,
    submit,
    isSubmitting,
    serverError,
    duplicates,
    confirmableDuplicates,
    setDuplicates,
    checkDuplicates,
    confirmAndSubmit,
    cancelDuplicateConfirmation,
  }
}

type StatusGuardParams = {
  status: InterventionStatusValue
  artisanId?: string | null
}

export function useStatusGuard({ status, artisanId }: StatusGuardParams) {
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(() => {
    if (REQUIRES_ARTISAN_STATUSES.includes(status) && !artisanId) {
      setError("Un artisan doit être sélectionné pour ce statut")
      return false
    }
    setError(null)
    return true
  }, [artisanId, status])

  return { error, validate }
}
