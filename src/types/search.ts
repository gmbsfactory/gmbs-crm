import type { InterventionPayment } from "@/lib/api/v2/common/types"

export type SearchEntityType = "intervention" | "artisan"
export type SearchContext = SearchEntityType | "mixed"

export interface SearchHighlightSegment {
  start: number
  length: number
}

export interface SearchHighlight {
  field: string
  segments: SearchHighlightSegment[]
  snippet?: string
}

export interface SearchScore {
  score: number
  matchedFields: string[]
  highlightText?: string
  highlights?: SearchHighlight[]
}

export interface ArtisanSearchRecord {
  id: string
  prenom: string | null
  nom: string | null
  plain_nom: string | null
  raison_sociale: string | null
  email: string | null
  telephone: string | null
  telephone2: string | null
  numero_associe: string | null
  statut_id: string | null
  is_active: boolean | null
  metiers: Array<{
    is_primary: boolean | null
    metier: {
      id: string
      code: string | null
      label: string | null
    } | null
  }>
  status?: {
    id: string
    code: string | null
    label: string | null
    color: string | null
  } | null
  activeInterventionCount?: number
}

export interface InterventionSearchRecord {
  id: string
  id_inter: string | null
  agence_id: string | null
  statut_id: string | null
  metier_id: string | null
  assigned_user_id: string | null
  contexte_intervention: string | null
  consigne_intervention: string | null
  commentaire_agent: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  date: string | null
  date_prevue: string | null
  due_date: string | null
  numero_sst: string | null
  pourcentage_sst: number | null
  clients?: {
    id: string
    firstname: string | null
    lastname: string | null
    telephone: string | null
    telephone2: string | null
    email: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
  } | null
  tenant?: {
    id: string
    firstname: string | null
    lastname: string | null
    telephone: string | null
    telephone2: string | null
    email: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
  } | null
  status: {
    id: string
    code: string | null
    label: string | null
    color: string | null
  } | null
  assigned_user: {
    id: string | null
    firstname: string | null
    lastname: string | null
    username: string | null
    code_gestionnaire: string | null
    color: string | null
  } | null
  metier: {
    id: string
    code: string | null
    label: string | null
  } | null
  intervention_artisans: Array<{
    is_primary: boolean | null
    role: string | null
    artisan: {
      id: string
      prenom: string | null
      nom: string | null
      numero_associe: string | null
      telephone: string | null
      telephone2: string | null
    } | null
  }>
  primaryArtisan?: {
    id: string
    prenom: string | null
    nom: string | null
    numero_associe: string | null
    telephone: string | null
    telephone2: string | null
  } | null
  payments?: InterventionPayment[]
}

export interface SearchResult<TData> {
  type: SearchEntityType
  data: TData
  score: number
  matchedFields: string[]
  highlights?: SearchHighlight[]
}

export interface SearchResultsGroup<TData> {
  items: Array<SearchResult<TData>>
  total: number
  hasMore: boolean
}

export interface GroupedSearchResults {
  artisans: SearchResultsGroup<ArtisanSearchRecord>
  interventions: SearchResultsGroup<InterventionSearchRecord>
  context: SearchContext
  searchTime: number
}
