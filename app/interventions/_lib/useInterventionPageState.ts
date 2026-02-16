"use client"

/**
 * Custom hook that encapsulates ALL state management logic for the
 * interventions page. UI sub-components receive pre-computed values
 * and handlers as props — they never manage page-level state directly.
 *
 * All imports use `@/` paths (pointing to `src/`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { useModalDisplay } from "@/contexts/ModalDisplayContext"
import { useInterventionViews } from "@/hooks/useInterventionViews"
import { usePreloadDefaultViews } from "@/hooks/usePreloadDefaultViews"
import { useInterventionsQuery } from "@/hooks/useInterventionsQuery"
import { useInterventionStatusMap } from "@/hooks/useInterventionStatusMap"
import { useUserMap } from "@/hooks/useUserMap"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useInterventionViewCounts } from "@/hooks/useInterventionViewCounts"
import { usePermissions } from "@/hooks/usePermissions"
import { useInterventionStatuses } from "@/hooks/useInterventionStatuses"
import { useInterface } from "@/contexts/interface-context"
import useInterventionModal from "@/hooks/useInterventionModal"
import type { InterventionModalOpenOptions } from "@/hooks/useInterventionModal"

import { DEFAULT_WORKFLOW_CONFIG } from "@/config/interventions"
import { runQuery } from "@/lib/query-engine"
import { validateTransition } from "@/lib/workflow-engine"
import { loadWorkflowConfig, persistWorkflowConfig } from "@/lib/workflow-persistence"
import { WORKFLOW_EVENT_KEY } from "@/hooks/useWorkflowConfig"
import { convertViewFiltersToServerFilters } from "@/lib/filter-converter"
import { mapStatusFromDb, mapStatusToDb } from "@/lib/interventions/mappers"
import { isCheckStatus } from "@/lib/interventions/checkStatus"
import { getAccentHexColor } from "@/lib/themes"
import { interventionsApi, type InterventionQueryParams } from "@/lib/api/v2"

import type { WorkflowConfig } from "@/types/intervention-workflow"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"
import type {
  InterventionViewDefinition,
  LayoutOptions,
  TableLayoutOptions,
  TableRowDensity,
  ViewFilter,
  ViewLayout,
} from "@/types/intervention-views"
import type { DateRange, SortField, SortDir } from "@/components/interventions/FiltersBar"
import type { ModalDisplayMode } from "@/types/modal-display"

import {
  VIEW_TO_STATUS_CODE,
  VISIBLE_VIEW_LAYOUTS,
  VIEW_LAYOUT_LABELS,
  CREATABLE_VIEW_LAYOUTS,
  DEFAULT_STATUS_VALUES,
  SORT_FIELD_TO_PROPERTY,
  PROPERTY_TO_SORT_FIELD,
  managedFilterKeys,
  WORKFLOW_STORAGE_KEY,
  toISODate,
  notifyWorkflowUpdate,
} from "./constants"

// ---------------------------------------------------------------------------
// Alias
// ---------------------------------------------------------------------------
type GetAllParams = InterventionQueryParams

// ---------------------------------------------------------------------------
// Normalized intervention type
// ---------------------------------------------------------------------------
export type NormalizedIntervention = InterventionEntity & {
  datePrevue: string | null
  isCheck: boolean
}

// ---------------------------------------------------------------------------
// Utility: shallow-compare two filter arrays
// ---------------------------------------------------------------------------
const filtersShallowEqual = (a: ViewFilter[], b: ViewFilter[]) => {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((filter) =>
    b.some(
      (candidate) =>
        candidate.property === filter.property &&
        candidate.operator === filter.operator &&
        JSON.stringify(candidate.value ?? null) === JSON.stringify(filter.value ?? null),
    ),
  )
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------
export interface UseInterventionPageStateReturn {
  // Router
  router: ReturnType<typeof useRouter>

  // Permissions
  isAdmin: boolean

  // Views
  views: InterventionViewDefinition[]
  activeView: InterventionViewDefinition | null
  activeViewId: string | undefined
  setActiveView: (id: string) => void
  reorderViews: (ids: string[]) => void
  updateViewConfig: (id: string, patch: Partial<InterventionViewDefinition>) => void
  updateLayoutOptions: (id: string, options: Partial<LayoutOptions>) => void
  updateFilters: (id: string, filters: ViewFilter[]) => void
  resetViewToDefault: (id: string) => void
  removeView: (id: string) => void
  isReady: boolean
  registerExternalView: (view: InterventionViewDefinition) => void

  // View status colors
  viewStatusColors: Record<string, string | null>
  activeViewColor: string | null

  // View counts
  combinedViewCounts: Record<string, number>
  countsLoading: boolean

  // Search / filters state
  search: string
  setSearch: (value: string) => void
  selectedStatuses: InterventionStatusValue[]
  selectedUser: string
  dateRange: DateRange
  sortField: SortField
  sortDir: SortDir
  setSortField: (field: SortField) => void
  setSortDir: (dir: SortDir) => void

  // Reorder mode
  isReorderMode: boolean
  setIsReorderMode: (value: boolean) => void

  // Column config
  columnConfigViewId: string | null
  setColumnConfigViewId: (id: string | null) => void

  // Error
  statusError: string | null

  // Layout helpers
  showStatusFilter: boolean
  activeTableLayoutOptions: TableLayoutOptions | undefined
  activeRowDensity: TableRowDensity

  // Display mode
  preferredMode: ModalDisplayMode
  setPreferredMode: (mode: ModalDisplayMode) => void

  // Workflow
  workflowConfig: WorkflowConfig
  workflowPinnedStatuses: InterventionStatusValue[]
  displayedStatuses: InterventionStatusValue[]
  isCheckFilterActive: boolean
  usersForFilter: string[]

  // Data
  normalizedInterventions: NormalizedIntervention[]
  filteredInterventions: NormalizedIntervention[]
  viewInterventions: NormalizedIntervention[]
  loading: boolean
  error: string | null

  // Pagination
  page: number
  effectiveTotalCount: number
  effectiveTotalPages: number
  handleGoToPage: (page: number) => void
  handleNextPage: () => void
  handlePreviousPage: () => void

  // Handlers
  handleSelectStatus: (status: InterventionStatusValue | null) => void
  handleSelectUser: (user: string) => void
  handleDateRangeChange: (range: DateRange) => void
  handleStatusChange: (id: string, status: InterventionStatusValue) => Promise<void>
  handleNavigateToDetail: (id: string, options?: InterventionModalOpenOptions) => void
  handleCreateView: (layout: ViewLayout) => void
  handleRenameView: (id: string) => void
  handleDuplicateView: (id: string) => void
  handleDeleteView: (id: string) => void
  handleLayoutOptionsPatch: (options: Partial<LayoutOptions>) => void
  handlePinStatus: (status: InterventionStatusValue) => void
  handleUnpinStatus: (status: InterventionStatusValue) => void
  updateFilterForProperty: (property: string, filter: ViewFilter | null) => void
  getCountByStatus: (status: InterventionStatusValue | null) => number
  getCheckCount: () => number
  loadDistinctValues: (property: string) => Promise<string[]>
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------
export function useInterventionPageState(): UseInterventionPageStateReturn {
  const router = useRouter()
  const { preferredMode, setPreferredMode } = useModalDisplay()
  const { isAdmin } = usePermissions()

  // ---- Views ----
  const {
    views,
    activeView,
    activeViewId,
    setActiveView,
    createView,
    duplicateView,
    updateView: updateViewConfig,
    updateLayoutOptions,
    updateFilters,
    updateSorts,
    reorderViews,
    removeView,
    resetViewToDefault,
    isReady,
    registerExternalView,
  } = useInterventionViews()

  usePreloadDefaultViews()

  // ---- Status colors ----
  const { getStatusByCode } = useInterventionStatuses()
  const { accent, customAccent } = useInterface()

  const viewStatusColors = useMemo(() => {
    const colors: Record<string, string | null> = {}
    Object.entries(VIEW_TO_STATUS_CODE).forEach(([viewId, statusCode]) => {
      const status = getStatusByCode(statusCode)
      colors[viewId] = status?.color ?? null
    })
    colors["market"] = "#EF4444"
    colors["mes-interventions-a-check"] = "#EF4444"
    return colors
  }, [getStatusByCode])

  const activeViewColor = useMemo(() => {
    if (!activeViewId) return null
    if (viewStatusColors[activeViewId]) {
      return viewStatusColors[activeViewId]
    }
    return getAccentHexColor(accent, customAccent)
  }, [activeViewId, viewStatusColors, accent, customAccent])

  // ---- Local state ----
  const [statusError, setStatusError] = useState<string | null>(null)
  const [columnConfigViewId, setColumnConfigViewId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("")
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const [sortField, setSortField] = useState<SortField>("cree")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedStatuses, setSelectedStatuses] = useState<InterventionStatusValue[]>([])
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig>(DEFAULT_WORKFLOW_CONFIG)
  const [page, setPage] = useState(1)

  // ---- Mapper hooks ----
  const { codeToId: statusCodeToId, statusMap, loading: statusMapLoading } = useInterventionStatusMap()
  const { nameToId: userCodeToId, userMap, loading: userMapLoading } = useUserMap()
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? undefined

  const mappersReady = useMemo(() => ({
    statusMapReady: !statusMapLoading && Object.keys(statusMap).length > 0,
    userMapReady: !userMapLoading && Object.keys(userMap).length > 0,
    currentUserIdReady: currentUserId !== undefined,
  }), [statusMapLoading, statusMap, userMapLoading, userMap, currentUserId])

  const allMappersReady =
    mappersReady.statusMapReady && mappersReady.userMapReady && mappersReady.currentUserIdReady

  // ---- View counts ----
  const convertFiltersToApiParams = useCallback(
    (filters: ViewFilter[]): Partial<GetAllParams> => {
      const { serverFilters } = convertViewFiltersToServerFilters(filters, {
        statusCodeToId,
        userCodeToId,
        currentUserId,
      })
      return serverFilters ?? {}
    },
    [statusCodeToId, userCodeToId, currentUserId],
  )

  const { counts: viewCounts, isLoading: countsLoading } = useInterventionViewCounts({
    views,
    convertFiltersToApiParams,
    enabled: isReady && allMappersReady && views.length > 0,
    currentUserId,
  })

  const combinedViewCounts = useMemo(() => viewCounts, [viewCounts])

  // ---- Derived UI flags ----
  const showStatusFilter = useMemo(() => {
    if (activeView?.layout !== "table") return false
    const tableOptions = activeView.layoutOptions as TableLayoutOptions
    return tableOptions.showStatusFilter ?? false
  }, [activeView])

  const { open: openInterventionModal } = useInterventionModal()

  const viewFields = useMemo(() => {
    if (!activeView?.visibleProperties) return undefined
    const normalized = activeView.visibleProperties
      .map((f) => (f ? f.trim() : ""))
      .filter((f): f is string => Boolean(f))
    if (!normalized.length) return undefined
    return Array.from(new Set(normalized))
  }, [activeView?.visibleProperties])

  // ---- Server / client filters ----
  const { serverFilters, clientFilters } = useMemo(() => {
    const baseFilters =
      activeView && activeView.filters.length > 0
        ? convertViewFiltersToServerFilters(activeView.filters, {
            statusCodeToId: (code) => statusCodeToId(code),
            userCodeToId: (code) => userCodeToId(code),
            currentUserId,
          })
        : { serverFilters: undefined, clientFilters: [] }

    const combinedServerFilters: Partial<GetAllParams> = {
      ...(baseFilters.serverFilters ?? {}),
    }

    const normalizedSearch = search.trim()
    if (normalizedSearch) {
      combinedServerFilters.search = normalizedSearch
    }

    const hasServerFilters = Object.keys(combinedServerFilters).length > 0

    return {
      serverFilters: hasServerFilters ? combinedServerFilters : undefined,
      clientFilters: baseFilters.clientFilters,
    }
  }, [activeView, statusCodeToId, userCodeToId, currentUserId, search])

  const serverFiltersSignature = useMemo(() => {
    if (!serverFilters) return "no-filters"
    return JSON.stringify(serverFilters, Object.keys(serverFilters).sort())
  }, [serverFilters])

  // ---- TanStack Query for interventions ----
  const queryLimit = activeViewId === "mes-interventions-a-check" ? 500 : 100

  const {
    interventions: fetchedInterventions,
    loading: remoteLoading,
    error: remoteError,
    totalCount,
    totalPages,
    currentPage,
    refresh,
    updateInterventionOptimistic,
  } = useInterventionsQuery({
    viewId: activeViewId ?? undefined,
    fields: viewFields,
    serverFilters,
    limit: queryLimit,
    page,
  })

  const [stableTotalCount, setStableTotalCount] = useState(0)
  const [stableTotalPages, setStableTotalPages] = useState(1)

  useEffect(() => {
    if (remoteLoading) return
    setStableTotalCount(totalCount)
    setStableTotalPages(totalPages ?? 1)
  }, [remoteLoading, totalCount, totalPages])

  const effectiveTotalCount = remoteLoading ? stableTotalCount : totalCount
  const effectiveTotalPages = remoteLoading ? stableTotalPages : (totalPages ?? 1)

  // ---- Pagination handlers ----
  const handleGoToPage = useCallback(
    (newPage: number) => {
      if (remoteLoading) return
      setPage(Math.max(1, Math.min(newPage, effectiveTotalPages)))
    },
    [effectiveTotalPages, remoteLoading],
  )

  const handleNextPage = useCallback(() => {
    if (remoteLoading) return
    setPage((prev) => Math.min(prev + 1, effectiveTotalPages))
  }, [effectiveTotalPages, remoteLoading])

  const handlePreviousPage = useCallback(() => {
    if (remoteLoading) return
    setPage((prev) => Math.max(1, prev - 1))
  }, [remoteLoading])

  // Reset page when filters/view change
  useEffect(() => {
    setPage(1)
  }, [serverFiltersSignature, activeViewId, search])

  // ---- View-change loading indicator ----
  const previousViewIdRef = useRef<string | undefined>(undefined)
  const [isViewChanging, setIsViewChanging] = useState(false)

  useEffect(() => {
    const wasChanging =
      previousViewIdRef.current !== undefined && previousViewIdRef.current !== activeViewId
    if (wasChanging) setIsViewChanging(true)
    previousViewIdRef.current = activeViewId
  }, [activeViewId])

  useEffect(() => {
    if (isViewChanging && !remoteLoading && fetchedInterventions.length > 0) {
      setIsViewChanging(false)
    }
  }, [isViewChanging, remoteLoading, fetchedInterventions.length])

  // ---- Normalize interventions ----
  const normalizedInterventions = useMemo(() => {
    return fetchedInterventions.map((item) => {
      // Use `unknown` bridge for fields not present on the strict type
      const raw = item as unknown as Record<string, unknown>
      const statusCode = item.status?.code ?? item.statusValue ?? raw.statut as string | undefined
      const normalizedStatus = mapStatusFromDb(statusCode)
      const datePrevue =
        raw.date_prevue as string | null ??
        raw.datePrevue as string | null ??
        null
      const isCheck = isCheckStatus(statusCode, datePrevue)
      return {
        ...item,
        statusValue: normalizedStatus,
        statusLabel: item.status?.label ?? raw.statusLabel as string | null ?? null,
        statusColor: item.status?.color ?? raw.statusColor as string | null ?? null,
        assignedUserColor: raw.assignedUserColor as string | null ?? null,
        datePrevue,
        isCheck,
      } as NormalizedIntervention
    })
  }, [fetchedInterventions])

  const loading = remoteLoading || (isViewChanging && normalizedInterventions.length > 0)
  const error = remoteError ?? statusError

  // ---- Client-side filtering ----
  const filteredInterventions = useMemo(() => {
    if (!activeView) return normalizedInterventions
    if (clientFilters.length === 0) return normalizedInterventions
    return runQuery(normalizedInterventions, clientFilters, activeView.sorts) as NormalizedIntervention[]
  }, [activeView, normalizedInterventions, clientFilters])

  const viewInterventions = filteredInterventions

  // ---- Distinct values ----
  const loadDistinctValues = useCallback(async (property: string) => {
    try {
      return await interventionsApi.getDistinctValues(property)
    } catch {
      return []
    }
  }, [])

  // ---- Workflow config persistence ----
  useEffect(() => {
    if (typeof window === "undefined") return
    const persisted = loadWorkflowConfig(WORKFLOW_STORAGE_KEY)
    if (persisted) setWorkflowConfig(persisted)

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WorkflowConfig>).detail
      if (detail) setWorkflowConfig(detail)
    }

    window.addEventListener(WORKFLOW_EVENT_KEY, handler as EventListener)
    return () => window.removeEventListener(WORKFLOW_EVENT_KEY, handler as EventListener)
  }, [])

  const workflowPinnedStatuses = useMemo(
    () =>
      workflowConfig.statuses
        .filter((s) => s.isPinned)
        .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0))
        .map((s) => s.key as InterventionStatusValue),
    [workflowConfig.statuses],
  )

  const updatePinnedStatus = useCallback(
    (status: InterventionStatusValue, shouldPin: boolean) => {
      setWorkflowConfig((prev) => {
        const clone: WorkflowConfig = JSON.parse(JSON.stringify(prev))
        const target = clone.statuses.find((item) => item.key === status)
        if (!target) return prev
        if (shouldPin) {
          if (target.isPinned) return prev
          target.isPinned = true
          target.pinnedOrder =
            clone.statuses.reduce(
              (max, item) =>
                item.isPinned && item.pinnedOrder != null ? Math.max(max, item.pinnedOrder) : max,
              -1,
            ) + 1
        } else {
          if (!target.isPinned) return prev
          target.isPinned = false
          target.pinnedOrder = undefined
        }
        const pinned = clone.statuses
          .filter((item) => item.isPinned)
          .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0))
        pinned.forEach((item, index) => {
          item.pinnedOrder = index
        })
        clone.updatedAt = new Date().toISOString()
        persistWorkflowConfig(WORKFLOW_STORAGE_KEY, clone)
        notifyWorkflowUpdate(clone)
        return clone
      })
    },
    [],
  )

  // ---- Sort sync (view <-> local) ----
  const isSyncingFromViewRef = useRef(false)
  const activeViewSorts = activeView?.sorts
  const firstSort = activeViewSorts?.[0]
  const activeViewSortKey = useMemo(() => {
    if (!firstSort) return null
    return `${firstSort.property}:${firstSort.direction}`
  }, [firstSort])

  useEffect(() => {
    if (!activeView || !activeViewSortKey || isSyncingFromViewRef.current) return
    const primarySort = activeView.sorts[0]
    if (primarySort) {
      const mappedField = PROPERTY_TO_SORT_FIELD[primarySort.property]
      if (mappedField) {
        setSortField((prev) => (prev !== mappedField ? mappedField : prev))
      }
      const direction = primarySort.direction === "asc" ? "asc" : "desc"
      setSortDir((prev) => (prev !== direction ? direction : prev))
    }
  }, [activeView, activeViewSortKey])

  useEffect(() => {
    if (!isReady || !activeView || isSyncingFromViewRef.current) return
    const property = SORT_FIELD_TO_PROPERTY[sortField]
    if (!property) return
    const currentSort = activeView.sorts[0]
    if (currentSort && currentSort.property === property && currentSort.direction === sortDir) return
    isSyncingFromViewRef.current = true
    updateSorts(activeView.id, [{ property, direction: sortDir }])
    requestAnimationFrame(() => {
      isSyncingFromViewRef.current = false
    })
  }, [sortField, sortDir, activeView, isReady, updateSorts])

  // ---- Filter property update ----
  const updateFilterForProperty = useCallback(
    (property: string, nextFilter: ViewFilter | null) => {
      if (!activeView) return
      const without = activeView.filters.filter((f) => f.property !== property)
      const candidate = nextFilter ? [...without, nextFilter] : without
      if (filtersShallowEqual(activeView.filters, candidate)) return
      updateFilters(activeView.id, candidate)
    },
    [activeView, updateFilters],
  )

  // ---- Pending filter from sessionStorage ----
  useEffect(() => {
    if (!isReady || !activeView) return
    const pendingFilterStr = sessionStorage.getItem("pending-intervention-filter")
    if (pendingFilterStr) {
      try {
        const pendingFilter = JSON.parse(pendingFilterStr)
        if (pendingFilter.viewId && views.some((v) => v.id === pendingFilter.viewId)) {
          setActiveView(pendingFilter.viewId)
        }
        const statusValue =
          pendingFilter.statusFilter ||
          (pendingFilter.property === "statusValue" ? pendingFilter.value : null)
        if (statusValue) {
          const values = Array.isArray(statusValue) ? statusValue : [statusValue]
          updateFilterForProperty("statusValue", {
            property: "statusValue",
            operator: "in" as const,
            value: values,
          })
        }
        if (
          pendingFilter.property === "isCheck" &&
          pendingFilter.operator === "eq" &&
          pendingFilter.value === true
        ) {
          updateFilterForProperty("isCheck", { property: "isCheck", operator: "eq" as const, value: true })
        }
        if (
          pendingFilter.property === "attribueA" &&
          pendingFilter.operator === "eq" &&
          typeof pendingFilter.value === "string"
        ) {
          updateFilterForProperty("attribueA", {
            property: "attribueA",
            operator: "eq" as const,
            value: pendingFilter.value,
          })
        }
        sessionStorage.removeItem("pending-intervention-filter")
      } catch {
        sessionStorage.removeItem("pending-intervention-filter")
      }
    }
  }, [isReady, views, setActiveView, activeView, updateFilterForProperty])

  // ---- Sync managed filters from activeView ----
  useEffect(() => {
    if (!activeView) return
    const statusFilter = activeView.filters.find((f) => f.property === managedFilterKeys.status)
    let statusValues: InterventionStatusValue[] = []
    if (statusFilter) {
      if (statusFilter.operator === "in" && Array.isArray(statusFilter.value)) {
        statusValues = statusFilter.value as InterventionStatusValue[]
      } else if (statusFilter.operator === "eq" && typeof statusFilter.value === "string") {
        statusValues = [statusFilter.value as InterventionStatusValue]
      }
    }
    setSelectedStatuses(statusValues)

    const userFilter = activeView.filters.find((f) => f.property === managedFilterKeys.user)
    const userValue = userFilter && typeof userFilter.value === "string" ? (userFilter.value as string) : ""
    setSelectedUser((prev) => (prev === userValue ? prev : userValue))

    const dateFilter = activeView.filters.find(
      (f) => f.property === managedFilterKeys.date && f.operator === "between",
    )
    let nextFrom: Date | null = null
    let nextTo: Date | null = null
    if (dateFilter) {
      if (Array.isArray(dateFilter.value)) {
        nextFrom = dateFilter.value[0] ? new Date(dateFilter.value[0] as string) : null
        nextTo = dateFilter.value[1] ? new Date(dateFilter.value[1] as string) : null
      } else if (dateFilter.value && typeof dateFilter.value === "object") {
        const lookup = dateFilter.value as { from?: string; to?: string }
        nextFrom = lookup.from ? new Date(lookup.from) : null
        nextTo = lookup.to ? new Date(lookup.to) : null
      }
      if (nextFrom && Number.isNaN(nextFrom.getTime())) nextFrom = null
      if (nextTo && Number.isNaN(nextTo.getTime())) nextTo = null
    }
    setDateRange((prev) => {
      const sameFrom =
        (prev.from == null && nextFrom == null) ||
        (!!prev.from && !!nextFrom && prev.from.getTime() === nextFrom.getTime())
      const sameTo =
        (prev.to == null && nextTo == null) ||
        (!!prev.to && !!nextTo && prev.to.getTime() === nextTo.getTime())
      if (sameFrom && sameTo) return prev
      return { from: nextFrom, to: nextTo }
    })
  }, [activeView])

  // ---- Check filter ----
  const isCheckFilterActive = useMemo(() => {
    if (!activeView) return false
    return Boolean(
      activeView.filters.find((f) => f.property === "isCheck" && f.operator === "eq" && f.value === true),
    )
  }, [activeView])

  // ---- Derived lists ----
  const usersForFilter = useMemo(() => {
    const s = new Set<string>()
    filteredInterventions.forEach((i) => i.attribueA && s.add(i.attribueA))
    return Array.from(s)
  }, [filteredInterventions])

  const uniqueStatuses = useMemo(() => {
    const set = new Set<InterventionStatusValue>()
    filteredInterventions.forEach((i) => {
      if (i.statusValue) set.add(i.statusValue)
    })
    return Array.from(set)
  }, [filteredInterventions])

  const displayedStatuses = useMemo(() => {
    const order = [...DEFAULT_STATUS_VALUES]
    const seen = new Set<InterventionStatusValue>(order)
    workflowPinnedStatuses.forEach((s) => {
      if (!seen.has(s)) { order.push(s); seen.add(s) }
    })
    uniqueStatuses.forEach((s) => {
      if (!seen.has(s)) { order.push(s); seen.add(s) }
    })
    selectedStatuses.forEach((s) => {
      if (!seen.has(s)) order.push(s)
    })
    return order
  }, [workflowPinnedStatuses, uniqueStatuses, selectedStatuses])

  // ---- Status counts ----
  const getCountByStatus = useCallback(
    (status: InterventionStatusValue | null) => {
      if (!status) return normalizedInterventions.length
      return normalizedInterventions.filter((i) => i.statusValue === status).length
    },
    [normalizedInterventions],
  )

  const getCheckCount = useCallback(
    () => normalizedInterventions.filter((i) => i.isCheck === true).length,
    [normalizedInterventions],
  )

  // ---- Action handlers ----
  const handlePinStatus = useCallback(
    (status: InterventionStatusValue) => updatePinnedStatus(status, true),
    [updatePinnedStatus],
  )
  const handleUnpinStatus = useCallback(
    (status: InterventionStatusValue) => updatePinnedStatus(status, false),
    [updatePinnedStatus],
  )

  const handleSelectStatus = useCallback(
    (status: InterventionStatusValue | null) => {
      if (status === null) {
        setSelectedStatuses([])
        updateFilterForProperty(managedFilterKeys.status, null)
        updateFilterForProperty("isCheck", null)
        return
      }
      setSelectedStatuses((prev) => {
        const isSelected = prev.includes(status)
        const next = isSelected ? prev.filter((s) => s !== status) : [...prev, status]
        updateFilterForProperty(
          managedFilterKeys.status,
          next.length > 0
            ? { property: managedFilterKeys.status, operator: "in", value: next }
            : null,
        )
        return next
      })
    },
    [updateFilterForProperty],
  )

  const handleSelectUser = useCallback(
    (user: string) => {
      setSelectedUser(user)
      updateFilterForProperty(
        managedFilterKeys.user,
        user ? { property: managedFilterKeys.user, operator: "eq", value: user } : null,
      )
    },
    [updateFilterForProperty],
  )

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range)
      const hasBounds = Boolean(range.from || range.to)
      updateFilterForProperty(
        managedFilterKeys.date,
        hasBounds
          ? {
              property: managedFilterKeys.date,
              operator: "between",
              value: { from: toISODate(range.from), to: toISODate(range.to) },
            }
          : null,
      )
    },
    [updateFilterForProperty],
  )

  const handleStatusChange = useCallback(
    async (id: string, status: InterventionStatusValue) => {
      const currentIntervention = normalizedInterventions.find((i) => i.id === id)
      if (!currentIntervention) return

      // Use `unknown` bridge for fields not present on the strict type
      const raw = currentIntervention as unknown as Record<string, unknown>

      const previous = currentIntervention.statusValue
      const statusLabel = mapStatusToDb(status)
      const nextDevisId = currentIntervention.devisId ?? null
      const interventionBusinessId =
        raw.id_inter as string | null ??
        raw.idInter as string | null ??
        raw.idIntervention as string | null ??
        null

      const validation = validateTransition(workflowConfig, previous, status, {
        id: currentIntervention.id,
        artisanId:
          raw.artisan as string | null ??
          raw.artisanId as string | null ??
          null,
        factureId: currentIntervention.idFacture ? String(currentIntervention.idFacture) : null,
        proprietaireId:
          raw.proprietaireId as string | null ??
          (raw.nomProprietaire || raw.prenomProprietaire
            ? `${raw.prenomProprietaire ?? ""} ${raw.nomProprietaire ?? ""}`.toString().trim() || null
            : null),
        commentaire:
          raw.commentaireAgent as string | null ??
          raw.commentaire as string | null ??
          null,
        devisId: nextDevisId ?? currentIntervention.devisId ?? null,
        idIntervention: interventionBusinessId,
      })

      if (!validation.canTransition) {
        const messages = [...validation.missingRequirements, ...validation.failedConditions]
        setStatusError(messages.join(" · ") || "Transition non autorisee")
        return
      }
      setStatusError(null)

      updateInterventionOptimistic(id, {
        statusValue: status,
        statut: statusLabel,
        devisId: nextDevisId ?? currentIntervention.devisId ?? null,
      })

      try {
        const response = await fetch(`/api/interventions/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusLabel }),
        })
        if (!response.ok) throw new Error(await response.text())
      } catch (err) {
        updateInterventionOptimistic(id, {
          statusValue: previous,
          statut: mapStatusToDb(previous),
          devisId: currentIntervention.devisId ?? null,
        })
        setStatusError((err as Error).message)
      }
    },
    [normalizedInterventions, workflowConfig, updateInterventionOptimistic],
  )

  const handleNavigateToDetail = useCallback(
    (id: string, options?: InterventionModalOpenOptions) => {
      openInterventionModal(id, {
        ...options,
        origin: options?.origin ?? activeViewId ?? undefined,
      })
    },
    [activeViewId, openInterventionModal],
  )

  const handleCreateView = useCallback(
    (layout: ViewLayout) => {
      if (!CREATABLE_VIEW_LAYOUTS.includes(layout)) return
      const label = VIEW_LAYOUT_LABELS[layout]
      const fallbackTitle = `${label} personnalisee`
      const title = window.prompt("Nom de la nouvelle vue", fallbackTitle)
      if (!title) return
      createView({
        title,
        layout,
        visibleProperties: activeView?.visibleProperties ?? [],
        filters: activeView?.filters ?? [],
        sorts: activeView?.sorts ?? [],
        layoutOptions: activeView?.layoutOptions,
      })
    },
    [activeView, createView],
  )

  const handleRenameView = useCallback(
    (id: string) => {
      const view = views.find((item) => item.id === id)
      if (!view) return
      const nextTitle = window.prompt("Renommer la vue", view.title)
      if (!nextTitle || nextTitle.trim() === view.title) return
      updateViewConfig(id, { title: nextTitle.trim() })
    },
    [updateViewConfig, views],
  )

  const handleDuplicateView = useCallback(
    (id: string) => {
      const view = views.find((item) => item.id === id)
      if (!view) return
      const title = window.prompt("Nom de la copie", `${view.title} (copie)`)
      if (!title) return
      duplicateView(id, title)
    },
    [duplicateView, views],
  )

  const handleDeleteView = useCallback(
    (id: string) => {
      const view = views.find((item) => item.id === id)
      if (!view) return
      if (view.isDefault) return
      const confirmed = window.confirm(`Supprimer la vue \u00ab ${view.title} \u00bb ?`)
      if (!confirmed) return
      removeView(id)
    },
    [removeView, views],
  )

  const handleLayoutOptionsPatch = useCallback(
    (options: Partial<LayoutOptions>) => {
      if (!activeView) return
      updateLayoutOptions(activeView.id, options)
    },
    [activeView, updateLayoutOptions],
  )

  // ---- Layout helpers ----
  const activeTableLayoutOptions =
    activeView?.layout === "table" ? (activeView.layoutOptions as TableLayoutOptions) : undefined

  const activeRowDensity: TableRowDensity =
    (activeTableLayoutOptions?.rowDensity ??
      (activeTableLayoutOptions?.dense ? "dense" : "default")) as TableRowDensity

  // ---- Escape key for reorder mode ----
  useEffect(() => {
    if (!isReorderMode) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReorderMode(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isReorderMode])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    router,
    isAdmin,
    views,
    activeView: activeView ?? null,
    activeViewId: activeViewId ?? undefined,
    setActiveView,
    reorderViews,
    updateViewConfig,
    updateLayoutOptions,
    updateFilters,
    resetViewToDefault,
    removeView,
    isReady,
    registerExternalView,
    viewStatusColors,
    activeViewColor,
    combinedViewCounts,
    countsLoading,
    search,
    setSearch,
    selectedStatuses,
    selectedUser,
    dateRange,
    sortField,
    sortDir,
    setSortField,
    setSortDir,
    isReorderMode,
    setIsReorderMode,
    columnConfigViewId,
    setColumnConfigViewId,
    statusError,
    showStatusFilter,
    activeTableLayoutOptions,
    activeRowDensity,
    preferredMode,
    setPreferredMode,
    workflowConfig,
    workflowPinnedStatuses,
    displayedStatuses,
    isCheckFilterActive,
    usersForFilter,
    normalizedInterventions,
    filteredInterventions,
    viewInterventions,
    loading,
    error,
    page,
    effectiveTotalCount,
    effectiveTotalPages,
    handleGoToPage,
    handleNextPage,
    handlePreviousPage,
    handleSelectStatus,
    handleSelectUser,
    handleDateRangeChange,
    handleStatusChange,
    handleNavigateToDetail,
    handleCreateView,
    handleRenameView,
    handleDuplicateView,
    handleDeleteView,
    handleLayoutOptionsPatch,
    handlePinStatus,
    handleUnpinStatus,
    updateFilterForProperty,
    getCountByStatus,
    getCheckCount,
    loadDistinctValues,
  }
}
