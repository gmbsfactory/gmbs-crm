import { supabase } from "@/lib/supabase-client"
import type { InterventionPayment } from "@/lib/api/v2/common/types"
import type {
  ArtisanSearchRecord,
  GroupedSearchResults,
  InterventionSearchRecord,
  SearchContext,
  SearchResult,
  SearchScore,
  SearchResultsGroup,
} from "@/types/search"

// Increased limits to better utilize optimized search_global RPC
const DEFAULT_ARTISAN_LIMIT = 10
const DEFAULT_INTERVENTION_LIMIT = 20
const DIACRITICS_REGEX = /[\u0300-\u036f]/g

type SearchGlobalResult = {
  entity_type: "artisan" | "intervention"
  entity_id: string
  rank: number | null
}

const normalizeString = (value: string | null | undefined): string => {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .trim()
}

const sanitizePhone = (value: string | null | undefined): string => {
  if (!value) return ""
  return value.replace(/\D+/g, "")
}

const escapeIlike = (value: string): string => {
  return value.replace(/[%_]/g, (match) => `\\${match}`)
}

const performanceNow = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

const getPrimaryMetier = (record: ArtisanSearchRecord) => {
  const primary = record.metiers.find((entry) => entry.is_primary)
  return primary?.metier ?? record.metiers[0]?.metier ?? null
}

const getPrimaryArtisanFromIntervention = (
  intervention: Pick<InterventionSearchRecord, "intervention_artisans">,
) => {
  const primary = intervention.intervention_artisans.find((entry) => entry.is_primary)
  return primary?.artisan ?? intervention.intervention_artisans[0]?.artisan ?? null
}

const computeInitials = (...parts: Array<string | null | undefined>) => {
  const available = parts.filter((part) => part && part.trim().length > 0) as string[]
  if (!available.length) return null
  return available
    .map((part) => part.trim()[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
}

const incrementScore = (currentMax: number, candidate: number) => {
  return candidate > currentMax ? candidate : currentMax
}

export function detectSearchContext(query: string): SearchContext {
  const trimmed = query.trim()
  if (!trimmed) return "mixed"
  if (/^INT-/i.test(trimmed)) return "intervention"
  if (/^\d{5,}$/.test(trimmed)) return "intervention"
  if (/^[A-Z]{2,4}$/i.test(trimmed)) return "artisan"
  const digits = trimmed.replace(/\s/g, "")
  if (/^0[1-9]/.test(digits)) return "intervention"
  if (/^\d{5}$/.test(trimmed)) return "intervention"
  return "mixed"
}

export function scoreArtisan(artisan: ArtisanSearchRecord, query: string): SearchScore {
  const normalizedQuery = normalizeString(query)
  const digitsQuery = sanitizePhone(query)
  const matchedFields = new Set<string>()
  let score = 0

  if (!normalizedQuery && !digitsQuery) {
    return { score: 0, matchedFields: [] }
  }

  const code = artisan.numero_associe
  if (code) {
    const normalizedCode = normalizeString(code)
    if (normalizedCode === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 100)
      matchedFields.add("code")
    } else if (normalizedCode.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 85)
      matchedFields.add("code")
    }
  }

  const company = artisan.raison_sociale
  if (company) {
    const normalizedCompany = normalizeString(company)
    if (normalizedCompany.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 75)
      matchedFields.add("company")
    } else if (normalizedCompany.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 60)
      matchedFields.add("company")
    }
  }

  const parts = [artisan.prenom, artisan.nom].filter((part) => Boolean(part)) as string[]
  if (parts.length > 0) {
    const fullName = normalizeString(parts.join(" "))
    if (fullName.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 75)
      matchedFields.add("name")
    } else if (fullName.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 60)
      matchedFields.add("name")
    }
  }

  const telephoneVariants = [artisan.telephone, artisan.telephone2].map(sanitizePhone).filter(Boolean)
  for (const phone of telephoneVariants) {
    if (!phone || !digitsQuery) continue
    if (phone === digitsQuery) {
      score = incrementScore(score, 70)
      matchedFields.add("telephone")
    } else if (phone.startsWith(digitsQuery) || phone.includes(digitsQuery)) {
      score = incrementScore(score, 60)
      matchedFields.add("telephone")
    }
  }

  const email = artisan.email
  if (email) {
    const normalizedEmail = normalizeString(email)
    if (normalizedEmail.includes(normalizedQuery) && normalizedQuery.length > 1) {
      score = incrementScore(score, 65)
      matchedFields.add("email")
    }
  }

  const metier = getPrimaryMetier(artisan)
  if (metier?.label) {
    const normalizedMetier = normalizeString(metier.label)
    if (normalizedMetier.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 65)
      matchedFields.add("metier")
    } else if (normalizedMetier.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 55)
      matchedFields.add("metier")
    }
  }

  if (matchedFields.size > 1) {
    score = Math.min(100, score + matchedFields.size * 2)
  }

  return { score, matchedFields: [...matchedFields] }
}

export function scoreIntervention(intervention: InterventionSearchRecord, query: string): SearchScore {
  const normalizedQuery = normalizeString(query)
  const digitsQuery = sanitizePhone(query)
  const matchedFields = new Set<string>()
  let score = 0
  const contact = intervention.tenant ?? intervention.owner ?? null

  if (!normalizedQuery && !digitsQuery) {
    return { score: 0, matchedFields: [] }
  }

  // Get primary artisan once at the beginning for reuse
  const primaryArtisan = getPrimaryArtisanFromIntervention(intervention)

  const idInter = intervention.id_inter
  if (idInter) {
    const normalizedId = normalizeString(idInter)
    if (normalizedId === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 100)
      matchedFields.add("interventionId")
    } else if (normalizedId.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 90)
      matchedFields.add("interventionId")
    } else if (normalizedId.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 80)
      matchedFields.add("interventionId")
    }
  }

  // numero_sst corresponds to the artisan's telephone
  // Search in primary artisan's telephone and telephone2
  if (primaryArtisan) {
    const telephoneCandidates = [
      primaryArtisan.telephone,
      primaryArtisan.telephone2
    ].filter(Boolean)

    for (const phone of telephoneCandidates) {
      if (!phone) continue
      const sanitized = sanitizePhone(phone)
      const normalizedPhone = normalizeString(phone)

      // Exact match on sanitized phone (digits only)
      if (digitsQuery && sanitized === digitsQuery) {
        score = incrementScore(score, 85)
        matchedFields.add("numeroSst")
        break
      }
      // Starts with or contains in normalized phone
      if (normalizedPhone.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
        score = incrementScore(score, 75)
        matchedFields.add("numeroSst")
        break
      } else if (normalizedPhone.includes(normalizedQuery) && normalizedQuery.length > 0) {
        score = incrementScore(score, 65)
        matchedFields.add("numeroSst")
        break
      }
    }
  }

  const contexte = intervention.contexte_intervention
  if (contexte) {
    const normalizedContexte = normalizeString(contexte)
    if (normalizedContexte === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 85)
      matchedFields.add("contexte")
    } else if (normalizedContexte.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 75)
      matchedFields.add("contexte")
    } else if (normalizedContexte.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 65)
      matchedFields.add("contexte")
    }
  }

  const telephoneCandidates = [contact?.telephone, contact?.telephone2]
  for (const phone of telephoneCandidates) {
    const sanitized = sanitizePhone(phone)
    if (!sanitized || !digitsQuery) continue
    if (sanitized === digitsQuery) {
      score = incrementScore(score, 95)
      matchedFields.add("telephone")
    } else if (sanitized.includes(digitsQuery)) {
      score = incrementScore(score, 70)
      matchedFields.add("telephone")
    }
  }

  const clientPlainNom = (contact as any)?.plain_nom
  const clientNameFallback = [
    (contact as any)?.firstname ?? (contact as any)?.owner_firstname,
    (contact as any)?.lastname ?? (contact as any)?.owner_lastname,
  ].filter(Boolean).join(" ") || null
  const clientFullName = normalizeString(clientPlainNom || clientNameFallback)
  if (clientFullName) {
    if (clientFullName === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 85)
      matchedFields.add("client")
    } else if (clientFullName.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 75)
      matchedFields.add("client")
    } else if (clientFullName.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 65)
      matchedFields.add("client")
    }
  }

  const clientEmail = (contact as any)?.email
  if (clientEmail) {
    const normalizedEmail = normalizeString(clientEmail)
    if (normalizedEmail.includes(normalizedQuery) && normalizedQuery.length > 1) {
      score = incrementScore(score, 65)
      matchedFields.add("clientEmail")
    }
  }

  const address = intervention.adresse
  if (address) {
    const normalizedAddress = normalizeString(address)
    if (normalizedAddress.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 60)
      matchedFields.add("address")
    }
  }

  const city = intervention.ville
  if (city) {
    const normalizedCity = normalizeString(city)
    if (normalizedCity === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 70)
      matchedFields.add("city")
    } else if (normalizedCity.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 65)
      matchedFields.add("city")
    }
  }

  const postal = intervention.code_postal
  if (postal) {
    const normalizedPostal = normalizeString(postal)
    if (normalizedPostal === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 80)
      matchedFields.add("postal")
    }
  }

  const commentaire = intervention.commentaire_agent
  if (commentaire) {
    const normalizedComment = normalizeString(commentaire)
    if (normalizedComment.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 50)
      matchedFields.add("comments")
    }
  }

  const consigne = intervention.consigne_intervention
  if (consigne) {
    const normalizedConsigne = normalizeString(consigne)
    if (normalizedConsigne.includes(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 50)
      matchedFields.add("notes")
    }
  }

  const assignedUserCode = intervention.assigned_user?.code_gestionnaire ?? intervention.assigned_user?.username
  if (assignedUserCode) {
    const normalizedUserCode = normalizeString(assignedUserCode)
    if (normalizedUserCode === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 80)
      matchedFields.add("assignedUser")
    } else if (normalizedUserCode.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 70)
      matchedFields.add("assignedUser")
    }
  }

  // Score by numero_associe (artisan code)
  if (primaryArtisan?.numero_associe) {
    const normalizedPrimaryCode = normalizeString(primaryArtisan.numero_associe)
    if (normalizedPrimaryCode === normalizedQuery && normalizedQuery.length > 0) {
      score = incrementScore(score, 80)
      matchedFields.add("assignedArtisan")
    } else if (normalizedPrimaryCode.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 70)
      matchedFields.add("assignedArtisan")
    }
  }

  // Score by artisan name (prenom nom)
  if (primaryArtisan) {
    const artisanNameParts = [primaryArtisan.prenom, primaryArtisan.nom].filter(
      (part) => Boolean(part),
    ) as string[]
    if (artisanNameParts.length > 0) {
      const artisanFullName = normalizeString(artisanNameParts.join(" "))
      if (artisanFullName === normalizedQuery && normalizedQuery.length > 0) {
        score = incrementScore(score, 75)
        matchedFields.add("assignedArtisanName")
      } else if (artisanFullName.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
        score = incrementScore(score, 65)
        matchedFields.add("assignedArtisanName")
      } else if (artisanFullName.includes(normalizedQuery) && normalizedQuery.length > 0) {
        score = incrementScore(score, 55)
        matchedFields.add("assignedArtisanName")
      }
    }
  }

  const metier = intervention.metier?.label
  if (metier) {
    const normalizedMetier = normalizeString(metier)
    if (normalizedMetier.startsWith(normalizedQuery) && normalizedQuery.length > 0) {
      score = incrementScore(score, 60)
      matchedFields.add("metier")
    }
  }

  if (matchedFields.size > 1) {
    score = Math.min(100, score + matchedFields.size * 2)
  }

  return { score, matchedFields: [...matchedFields] }
}

const buildArtisanQuery = (query: string, limit: number) => {
  const trimmed = query.trim()
  if (!trimmed) return null

  const pattern = escapeIlike(trimmed)
  const normalizedDigits = sanitizePhone(trimmed)

  // PostgREST .or() syntax: "column.operator.pattern,column2.operator.pattern"
  const orFilters = [
    `numero_associe.ilike.*${pattern}*`,
    `plain_nom.ilike.*${pattern}*`,
    `raison_sociale.ilike.*${pattern}*`,
    `prenom.ilike.*${pattern}*`,
    `nom.ilike.*${pattern}*`,
    `email.ilike.*${pattern}*`,
  ]

  if (normalizedDigits) {
    orFilters.push(`telephone.ilike.*${normalizedDigits}*`)
    orFilters.push(`telephone2.ilike.*${normalizedDigits}*`)
  } else {
    orFilters.push(`telephone.ilike.*${pattern}*`)
    orFilters.push(`telephone2.ilike.*${pattern}*`)
  }

  const baseLimit = Math.max(limit * 3, limit + 3)

  return supabase
    .from("artisans")
    .select(
      `
        id,
        prenom,
        nom,
        plain_nom,
        raison_sociale,
        email,
        telephone,
        telephone2,
        numero_associe,
        statut_id,
        is_active,
        status:artisan_statuses (
          id,
          code,
          label,
          color
        ),
        metiers:artisan_metiers (
          is_primary,
          metier:metiers (
            id,
            code,
            label
          )
        )
      `,
      { count: "exact" },
    )
    .or(orFilters.join(","))
    .order("numero_associe", { ascending: true })
    .limit(baseLimit)
}

const fetchActiveInterventionCounts = async (artisanIds: string[]) => {
  if (artisanIds.length === 0) return new Map<string, number>()

  const { data, error } = await supabase
    .from("intervention_artisans")
    .select(
      `
        artisan_id,
        intervention_id,
        interventions!inner (
          id,
          is_active
        )
      `,
    )
    .in("artisan_id", artisanIds)
    .eq("interventions.is_active", true)

  if (error) {
    console.warn("[universalSearch] Unable to fetch artisan intervention counts", error)
    return new Map<string, number>()
  }

  const counts = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const artisanId = row.artisan_id
    const interventionId = row.intervention_id
    if (!artisanId || !interventionId) continue
    if (!counts.has(artisanId)) {
      counts.set(artisanId, new Set<string>())
    }
    counts.get(artisanId)?.add(interventionId)
  }

  const finalCounts = new Map<string, number>()
  counts.forEach((set, key) => {
    finalCounts.set(key, set.size)
  })
  return finalCounts
}

const searchArtisans = async (
  query: string,
  limit: number,
): Promise<SearchResultsGroup<ArtisanSearchRecord>> => {
  const builder = buildArtisanQuery(query, limit)
  if (!builder) {
    return {
      items: [],
      total: 0,
      hasMore: false,
    }
  }

  const { data, error, count } = await builder
  if (error) {
    throw error
  }

  const scored = (data ?? []).map((record: any) => {
    // Normaliser la structure des métiers et du status si nécessaire
    const normalizedRecord: ArtisanSearchRecord = {
      ...record,
      metiers: Array.isArray(record.metiers)
        ? record.metiers.map((m: any) => ({
          is_primary: m.is_primary,
          metier: Array.isArray(m.metier) ? m.metier[0] : m.metier,
        }))
        : [],
      status: Array.isArray(record.status) ? record.status[0] : record.status,
    } as unknown as ArtisanSearchRecord
    const score = scoreArtisan(normalizedRecord, query)
    return {
      record: normalizedRecord,
      score,
    }
  })

  const filtered = scored
    .filter((entry: any) => entry.score.score > 0)
    .sort((a: any, b: any) => {
      if (b.score.score !== a.score.score) {
        return b.score.score - a.score.score
      }
      const codeA = normalizeString(a.record.numero_associe ?? "")
      const codeB = normalizeString(b.record.numero_associe ?? "")
      return codeA.localeCompare(codeB)
    })
    .slice(0, limit)

  const artisanIds = filtered.map((entry: any) => entry.record.id)
  const counts = await fetchActiveInterventionCounts(artisanIds)

  const items: Array<SearchResult<ArtisanSearchRecord>> = filtered.map((entry: any) => {
    const activeCount = counts.get(entry.record.id) ?? 0
    return {
      type: "artisan",
      data: {
        ...entry.record,
        activeInterventionCount: activeCount,
      },
      score: entry.score.score,
      matchedFields: entry.score.matchedFields,
    }
  })

  const total = count ?? items.length
  return {
    items,
    total,
    hasMore: total > items.length,
  }
}

const searchInterventions = async (
  query: string,
  limit: number,
): Promise<SearchResultsGroup<InterventionSearchRecord>> => {
  const trimmed = query.trim()
  if (!trimmed) {
    return {
      items: [],
      total: 0,
      hasMore: false,
    }
  }

  const pattern = escapeIlike(trimmed)

  // Validate pattern is not empty after escaping
  if (!pattern || pattern.length === 0) {
    console.warn("[searchInterventions] Pattern is empty after escaping, query:", trimmed)
    return {
      items: [],
      total: 0,
      hasMore: false,
    }
  }

  // PostgREST .or() syntax: "column.operator.pattern"
  // Only search on direct columns, not relations (PostgREST limitation with .or())
  // Note: numero_sst corresponds to artisan's telephone, so it's searched client-side
  // via the intervention_artisans relation in scoreIntervention function
  // Note: PostgREST may have issues with NULL values in .or() filters, so we use a workaround:
  // Instead of filtering NULL columns, we fetch more results and filter client-side
  const orFilters = [
    `id_inter.ilike.*${pattern}*`,
    `contexte_intervention.ilike.*${pattern}*`,
    `adresse.ilike.*${pattern}*`,
    `ville.ilike.*${pattern}*`,
    `code_postal.ilike.*${pattern}*`,
    `commentaire_agent.ilike.*${pattern}*`,
    `consigne_intervention.ilike.*${pattern}*`,
  ]

  // Build the filter string - PostgREST requires comma-separated filters
  // If this causes 400 errors, it's likely due to NULL handling in PostgREST
  const orFilterString = orFilters.join(",")

  // Validate filter string is not empty
  if (!orFilterString || orFilterString.length === 0) {
    console.warn("[searchInterventions] Filter string is empty, pattern:", pattern)
    return {
      items: [],
      total: 0,
      hasMore: false,
    }
  }

  // Fetch more results since we'll filter/score with relations client-side
  const baseLimit = Math.max(limit * 5, limit + 10)
  const { data, error, count } = await supabase
    .from("interventions")
    .select(
      `
        id,
        id_inter,
        agence_id,
        statut_id,
        metier_id,
        assigned_user_id,
        contexte_intervention,
        consigne_intervention,
        commentaire_agent,
        adresse,
        code_postal,
        ville,
        date,
        date_prevue,
        due_date,
        tenant:tenants (
          id,
          firstname,
          lastname,
          telephone,
          telephone2,
          email,
          adresse,
          code_postal,
          ville
        ),
        owner:owner (
          id,
          owner_firstname,
          owner_lastname,
          telephone,
          telephone2,
          email,
          adresse,
          code_postal,
          ville
        ),
        status:intervention_statuses (
          id,
          code,
          label,
          color
        ),
        metier:metiers (
          id,
          code,
          label
        ),
        assigned_user:users!assigned_user_id (
          id,
          firstname,
          lastname,
          username,
          code_gestionnaire,
          color,
          avatar_url
        ),
        intervention_artisans (
          is_primary,
          role,
          artisan:artisans (
            id,
            prenom,
            nom,
            numero_associe,
            telephone,
            telephone2,
            siret
          )
        ),
        payments:intervention_payments(*)
      `,
      { count: "exact" },
    )
    .or(orFilterString)
    .order("date", { ascending: false, nullsFirst: false })
    .limit(baseLimit)

  if (error) {
    // Try to serialize the error to see its actual structure
    let errorSerialized: any
    try {
      errorSerialized = JSON.stringify(error, Object.getOwnPropertyNames(error))
    } catch {
      errorSerialized = String(error)
    }

    console.error("[searchInterventions] PostgREST error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      serialized: errorSerialized,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorKeys: error ? Object.keys(error) : [],
      errorString: String(error),
      query: trimmed,
      pattern: pattern,
      orFilters: orFilterString,
      baseLimit: baseLimit,
    })
    throw error
  }

  const scored = (data ?? []).map((record: any) => {
    const typedRecord: InterventionSearchRecord = {
      ...(record as unknown as InterventionSearchRecord),
    }
    typedRecord.primaryArtisan = getPrimaryArtisanFromIntervention(typedRecord)
    const score = scoreIntervention(typedRecord, query)
    return {
      record: typedRecord,
      score,
    }
  })

  const filtered = scored
    .filter((entry: any) => entry.score.score > 0)
    .sort((a: any, b: any) => {
      if (b.score.score !== a.score.score) {
        return b.score.score - a.score.score
      }
      const labelA = normalizeString(a.record.status?.label ?? "")
      const labelB = normalizeString(b.record.status?.label ?? "")
      return labelA.localeCompare(labelB)
    })
    .slice(0, limit)

  const items: Array<SearchResult<InterventionSearchRecord>> = filtered.map((entry: any) => ({
    type: "intervention",
    data: entry.record,
    score: entry.score.score,
    matchedFields: entry.score.matchedFields,
  }))

  const total = count ?? items.length
  return {
    items,
    total,
    hasMore: total > items.length,
  }
}

// Helper function to fetch full artisan data by IDs
const fetchArtisansByIds = async (ids: string[]): Promise<ArtisanSearchRecord[]> => {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("artisans")
    .select(
      `
        id,
        prenom,
        nom,
        plain_nom,
        raison_sociale,
        email,
        telephone,
        telephone2,
        numero_associe,
        statut_id,
        is_active,
        status:artisan_statuses (
          id,
          code,
          label,
          color
        ),
        metiers:artisan_metiers (
          is_primary,
          metier:metiers (
            id,
            code,
            label
          )
        )
      `,
    )
    .in("id", ids)

  if (error) {
    console.error("[fetchArtisansByIds] Error:", error)
    return []
  }

  return (data ?? []).map((record: any) => ({
    ...record,
    metiers: Array.isArray(record.metiers)
      ? record.metiers.map((m: any) => ({
        is_primary: m.is_primary,
        metier: Array.isArray(m.metier) ? m.metier[0] : m.metier,
      }))
      : [],
    status: Array.isArray(record.status) ? record.status[0] : record.status,
  })) as ArtisanSearchRecord[]
}

// Helper function to fetch full intervention data by IDs using the API
const fetchInterventionsByIds = async (ids: string[]): Promise<InterventionSearchRecord[]> => {
  if (ids.length === 0) return []

  const results: InterventionSearchRecord[] = []
  const errors: Array<{ id: string; error: any }> = []

  // Import the utility function and API
  const { convertInterventionToSearchRecord } = await import("@/lib/api/v2/search-utils")
  const { interventionsApi } = await import("@/lib/api/v2/interventionsApi")

  // Fetch interventions in parallel
  const promises = ids.map(async (id) => {
    try {
      const intervention = await interventionsApi.getById(id)
      return convertInterventionToSearchRecord(intervention)
    } catch (err) {
      console.error(`[fetchInterventionsByIds] Error fetching intervention ${id}:`, err)
      errors.push({ id, error: err })
      return null
    }
  })

  const fetchedResults = await Promise.all(promises)

  // Filter out null results (errors)
  for (const result of fetchedResults) {
    if (result !== null) {
      results.push(result)
    }
  }

  if (errors.length > 0) {
    console.error(`[fetchInterventionsByIds] Failed to fetch ${errors.length}/${ids.length} interventions:`, errors)
  }

  return results
}

export async function universalSearch(
  query: string,
  options?: {
    artisanLimit?: number
    interventionLimit?: number
  },
): Promise<GroupedSearchResults> {
  const trimmed = query.trim()
  const context = detectSearchContext(trimmed)

  if (trimmed.length < 2) {
    return {
      artisans: { items: [], total: 0, hasMore: false },
      interventions: { items: [], total: 0, hasMore: false },
      context,
      searchTime: 0,
    }
  }

  const artisanLimit =
    options?.artisanLimit ?? (context === "artisan" ? Math.max(DEFAULT_ARTISAN_LIMIT, 5) : DEFAULT_ARTISAN_LIMIT)
  const interventionLimit =
    options?.interventionLimit ??
    (context === "intervention" ? Math.max(DEFAULT_INTERVENTION_LIMIT, 8) : DEFAULT_INTERVENTION_LIMIT)

  const resolvedArtisanLimit =
    options?.artisanLimit !== undefined
      ? artisanLimit
      : context === "intervention"
        ? Math.min(artisanLimit, 3)
        : artisanLimit

  const resolvedInterventionLimit =
    options?.interventionLimit !== undefined
      ? interventionLimit
      : context === "artisan"
        ? Math.min(interventionLimit, 5)
        : interventionLimit

  const start = performanceNow()

  // Use search_global RPC function for optimized search
  const totalLimit = resolvedArtisanLimit + resolvedInterventionLimit
  const { data: globalResults, error: globalError } = await supabase.rpc("search_global", {
    p_query: trimmed,
    p_limit: totalLimit,
    p_offset: 0,
    p_entity_type: null, // Search both types
  })

  if (globalError) {
    console.error("[universalSearch] Error in search_global RPC:", globalError)
    // Fallback to old method if RPC fails
    const [artisanSettled, interventionSettled] = await Promise.allSettled([
      searchArtisans(trimmed, resolvedArtisanLimit),
      searchInterventions(trimmed, resolvedInterventionLimit),
    ])

    const artisanResults =
      artisanSettled.status === "fulfilled"
        ? artisanSettled.value
        : { items: [], total: 0, hasMore: false }

    const interventionResults =
      interventionSettled.status === "fulfilled"
        ? interventionSettled.value
        : { items: [], total: 0, hasMore: false }

    const searchTime = Math.round(performanceNow() - start)
    return {
      artisans: artisanResults,
      interventions: interventionResults,
      context,
      searchTime,
    }
  }

  // Separate results by entity type
  const artisanResults: SearchGlobalResult[] = (globalResults ?? []).filter((r: SearchGlobalResult) => r.entity_type === "artisan")
  const interventionResults: SearchGlobalResult[] = (globalResults ?? []).filter((r: SearchGlobalResult) => r.entity_type === "intervention")

  // Sort by rank (already sorted by search_global, but ensure order is preserved)
  artisanResults.sort((a: SearchGlobalResult, b: SearchGlobalResult) => (b.rank ?? 0) - (a.rank ?? 0))
  interventionResults.sort((a: SearchGlobalResult, b: SearchGlobalResult) => (b.rank ?? 0) - (a.rank ?? 0))

  // Limit results per type
  const limitedArtisanResults = artisanResults.slice(0, resolvedArtisanLimit)
  const limitedInterventionResults = interventionResults.slice(0, resolvedInterventionLimit)

  // Extract IDs
  const artisanIds = limitedArtisanResults.map((r) => r.entity_id)
  const interventionIds = limitedInterventionResults.map((r) => r.entity_id)

  // Fetch full data for artisans and interventions in parallel
  const [artisanData, interventionData, artisanCounts] = await Promise.all([
    fetchArtisansByIds(artisanIds),
    fetchInterventionsByIds(interventionIds),
    fetchActiveInterventionCounts(artisanIds),
  ])

  // Debug logging

  // Create a map of entity_id -> rank for scoring
  const artisanRankMap = new Map(limitedArtisanResults.map((r) => [r.entity_id, r.rank ?? 0]))
  const interventionRankMap = new Map(limitedInterventionResults.map((r) => [r.entity_id, r.rank ?? 0]))

  // Create maps for quick lookup by ID
  const artisanDataMap = new Map(artisanData.map((a) => [a.id, a]))
  const interventionDataMap = new Map(interventionData.map((i) => [i.id, i]))

  // Map artisans to SearchResult format, preserving order from search_global
  const artisanItems: Array<SearchResult<ArtisanSearchRecord>> = limitedArtisanResults
    .map((result) => {
      const artisan = artisanDataMap.get(result.entity_id)
      if (!artisan) {
        console.warn("[universalSearch] Artisan not found for ID:", result.entity_id)
        return null
      }

      const rank = result.rank ?? 0
      // Convert rank (0-1) to score (0-100) for consistency with old scoring
      const score = rank * 100
      // Determine matched fields based on metadata (simplified)
      const matchedFields: string[] = []
      if (artisan.numero_associe && normalizeString(artisan.numero_associe).includes(normalizeString(trimmed))) {
        matchedFields.push("code")
      }
      if (artisan.plain_nom && normalizeString(artisan.plain_nom).includes(normalizeString(trimmed))) {
        matchedFields.push("nom")
      }
      if (artisan.raison_sociale && normalizeString(artisan.raison_sociale).includes(normalizeString(trimmed))) {
        matchedFields.push("raison_sociale")
      }

      return {
        type: "artisan" as const,
        data: {
          ...artisan,
          activeInterventionCount: artisanCounts.get(artisan.id) ?? 0,
        },
        score,
        matchedFields,
      } as SearchResult<ArtisanSearchRecord>
    })
    .filter((item): item is SearchResult<ArtisanSearchRecord> => item !== null)

  // Map interventions to SearchResult format, preserving order from search_global
  const interventionItems: Array<SearchResult<InterventionSearchRecord>> = limitedInterventionResults
    .map((result) => {
      const intervention = interventionDataMap.get(result.entity_id)
      if (!intervention) {
        console.warn("[universalSearch] Intervention not found for ID:", result.entity_id)
        return null
      }

      const rank = result.rank ?? 0
      // Convert rank (0-1) to score (0-100) for consistency with old scoring
      const score = rank * 100
      // Determine matched fields based on metadata (simplified)
      const matchedFields: string[] = []
      if (
        intervention.contexte_intervention &&
        normalizeString(intervention.contexte_intervention).includes(normalizeString(trimmed))
      ) {
        matchedFields.push("contexte")
      }
      if (intervention.adresse && normalizeString(intervention.adresse).includes(normalizeString(trimmed))) {
        matchedFields.push("address")
      }
      if (intervention.ville && normalizeString(intervention.ville).includes(normalizeString(trimmed))) {
        matchedFields.push("city")
      }

      return {
        type: "intervention" as const,
        data: intervention,
        score,
        matchedFields,
      } as SearchResult<InterventionSearchRecord>
    })
    .filter((item): item is SearchResult<InterventionSearchRecord> => item !== null)

  const searchTime = Math.round(performanceNow() - start)

  return {
    artisans: {
      items: artisanItems,
      total: artisanResults.length, // Total found (before limiting)
      hasMore: artisanResults.length > resolvedArtisanLimit,
    },
    interventions: {
      items: interventionItems,
      total: interventionResults.length, // Total found (before limiting)
      hasMore: interventionResults.length > resolvedInterventionLimit,
    },
    context,
    searchTime,
  }
}
