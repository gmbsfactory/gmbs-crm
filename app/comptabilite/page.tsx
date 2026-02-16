"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"
import { format, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { useColumnResize, type ColumnWidths } from "@/hooks/useColumnResize"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useComptabiliteQuery } from "@/hooks/useComptabiliteQuery"
import { cn } from "@/lib/utils"
import { PagePresenceProvider, usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { PagePresenceAvatars } from "@/components/ui/PagePresenceAvatars"
import { ComptabiliteTableRow } from "./_components/ComptabiliteTableRow"
import {
  formatCurrency,
  formatDate,
  formatClientName,
  formatAddress,
  getMetierLabel,
  getCostAmountByType,
  getPaymentInfo,
  getArtisanName,
} from "@/lib/comptabilite/formatters"

// ---------------------------------------------------------------------------
// Page presence helper (must be rendered inside PagePresenceProvider)
// ---------------------------------------------------------------------------
function PagePresenceSection() {
  const ctx = usePagePresenceContext()
  if (!ctx) return null
  return <PagePresenceAvatars viewers={ctx.viewers} />
}

type PeriodType = "month" | "year"

const STORAGE_KEY_PERIOD_TYPE = "comptabilite-period-type"
const STORAGE_KEY_START_YEAR = "comptabilite-start-year"
const STORAGE_KEY_START_MONTH = "comptabilite-start-month"
const STORAGE_KEY_END_YEAR = "comptabilite-end-year"
const STORAGE_KEY_END_MONTH = "comptabilite-end-month"
const STORAGE_KEY_COL_WIDTHS = "comptabilite-col-widths"

/** Définition des colonnes : clé, label, largeur par défaut, redimensionnable */
const COLUMNS = [
  { key: "select", label: "", defaultWidth: 36, resizable: false },
  { key: "dateFact", label: "Date Fact.", defaultWidth: 88 },
  { key: "agence", label: "Agence", defaultWidth: 78 },
  { key: "attribue", label: "Attribué", defaultWidth: 128 },
  { key: "id", label: "ID", defaultWidth: 66 },
  { key: "client", label: "Client", defaultWidth: 100 },
  { key: "adresse", label: "Adresse", defaultWidth: 177 },
  { key: "metier", label: "Métier", defaultWidth: 85 },
  { key: "contexte", label: "Contexte", defaultWidth: 133 },
  { key: "materiel", label: "Matériel", defaultWidth: 70 },
  { key: "inter", label: "Inter", defaultWidth: 50 },
  { key: "sst", label: "SST", defaultWidth: 62 },
  { key: "artisan", label: "Artisan", defaultWidth: 88 },
  { key: "acClient", label: "Ac. Client", defaultWidth: 82 },
  { key: "dateAcClient", label: "Date Ac. Cl.", defaultWidth: 92 },
  { key: "acArtisan", label: "Ac. Artisan", defaultWidth: 82 },
  { key: "dateAcArtisan", label: "Date Ac. Art.", defaultWidth: 92 },
  { key: "action", label: "Action", defaultWidth: 72, resizable: false, sticky: true },
] as const

const DEFAULT_COL_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.defaultWidth])
)

const cleanValue = (value: string): string => {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const emptyIfDash = (value: string) => value === "—" ? "" : value

export default function ComptabilitePage() {
  const router = useRouter()
  const { open: openInterventionModal } = useInterventionModal()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { can, isLoading: loadingPermissions } = usePermissions()
  const [isMounted, setIsMounted] = useState(false)

  // État pour les filtres de période
  const [periodType, setPeriodType] = useState<PeriodType>("month")
  const [startYear, setStartYear] = useState<string>("")
  const [startMonth, setStartMonth] = useState<string>("")
  const [endYear, setEndYear] = useState<string>("")
  const [endMonth, setEndMonth] = useState<string>("")

  // États pour la sélection et la copie
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [copiedAndChecked, setCopiedAndChecked] = useState(false)

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // État pour les largeurs de colonnes (redimensionnement)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => ({ ...DEFAULT_COL_WIDTHS }))

  // Vérifier l'accès via la permission view_comptabilite
  const canAccessComptabilite = can("view_comptabilite")

  // Charger depuis localStorage après le montage côté client
  useEffect(() => {
    setIsMounted(true)
    const savedPeriodType = localStorage.getItem(STORAGE_KEY_PERIOD_TYPE)
    if (savedPeriodType === "month" || savedPeriodType === "year") {
      setPeriodType(savedPeriodType as PeriodType)
    }
    const savedStartYear = localStorage.getItem(STORAGE_KEY_START_YEAR)
    const savedStartMonth = localStorage.getItem(STORAGE_KEY_START_MONTH)
    const savedEndYear = localStorage.getItem(STORAGE_KEY_END_YEAR)
    const savedEndMonth = localStorage.getItem(STORAGE_KEY_END_MONTH)
    if (savedStartYear) setStartYear(savedStartYear)
    if (savedStartMonth) setStartMonth(savedStartMonth)
    if (savedEndYear) setEndYear(savedEndYear)
    if (savedEndMonth) setEndMonth(savedEndMonth)

    // Charger les largeurs de colonnes
    try {
      const savedWidths = localStorage.getItem(STORAGE_KEY_COL_WIDTHS)
      if (savedWidths) {
        const parsed = JSON.parse(savedWidths)
        if (parsed && typeof parsed === "object") {
          setColumnWidths((prev) => ({ ...prev, ...parsed }))
        }
      }
    } catch {
      // Ignore les erreurs de parsing
    }
  }, [])

  // Sauvegarder dans localStorage quand les filtres changent
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(STORAGE_KEY_PERIOD_TYPE, periodType)
      if (startYear) localStorage.setItem(STORAGE_KEY_START_YEAR, startYear)
      if (startMonth) localStorage.setItem(STORAGE_KEY_START_MONTH, startMonth)
      if (endYear) localStorage.setItem(STORAGE_KEY_END_YEAR, endYear)
      if (endMonth) localStorage.setItem(STORAGE_KEY_END_MONTH, endMonth)
    }
  }, [periodType, startYear, startMonth, endYear, endMonth, isMounted])

  // Redimensionnement des colonnes (même pattern que TableView interventions)
  const { activeColumn, handlePointerDown } = useColumnResize(columnWidths, (widths) => {
    setColumnWidths(widths)
    try { localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(widths)) } catch {}
  })

  // Générer les années disponibles (année courante ± 2 ans)
  const availableYears = useMemo(() => {
    const currentYear = getYear(new Date())
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => ({
      value: year.toString(),
      label: year.toString(),
    }))
  }, [])

  // Générer les mois disponibles
  const availableMonths = useMemo(() => {
    const currentYear = getYear(new Date())
    const start = startOfYear(new Date(currentYear, 0, 1))
    const end = endOfYear(new Date(currentYear, 0, 1))
    return eachMonthOfInterval({ start, end }).map((month) => ({
      value: format(month, "MM"),
      label: format(month, "MMMM", { locale: fr }),
    }))
  }, [])

  // Calculer les dates de début et fin selon les filtres
  const dateRange = useMemo(() => {
    if (!startYear || !endYear) return null

    let startDate: Date
    let endDate: Date

    if (periodType === "month") {
      if (!startMonth || !endMonth) return null
      const startYearNum = parseInt(startYear)
      const startMonthNum = parseInt(startMonth)
      const endYearNum = parseInt(endYear)
      const endMonthNum = parseInt(endMonth)

      startDate = startOfMonth(new Date(startYearNum, startMonthNum - 1, 1))
      endDate = endOfMonth(new Date(endYearNum, endMonthNum - 1, 1))
    } else {
      const startYearNum = parseInt(startYear)
      const endYearNum = parseInt(endYear)
      startDate = startOfYear(new Date(startYearNum, 0, 1))
      endDate = endOfYear(new Date(endYearNum, 0, 1))
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    }
  }, [periodType, startYear, startMonth, endYear, endMonth])

  useEffect(() => {
    if (loadingUser || loadingPermissions) return
    if (!currentUser) {
      router.replace("/dashboard")
      return
    }
    if (!canAccessComptabilite) {
      router.replace("/dashboard")
    }
  }, [canAccessComptabilite, currentUser, loadingUser, loadingPermissions, router])

  // Hook TanStack Query pour les données comptabilité
  const {
    interventions: paginatedInterventions,
    allInterventions,
    facturationDates,
    checkedInterventions,
    totalCount,
    totalPages,
    loading,
    error,
    toggleComptaCheck,
    bulkCheck,
  } = useComptabiliteQuery({
    dateRange,
    enabled: canAccessComptabilite && !!currentUser,
    page: currentPage,
    itemsPerPage,
  })

  const isLoading = loading || loadingUser || loadingPermissions

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    setSelectedRows(new Set())
    setCurrentPage(1)
  }, [dateRange])

  // ── Sélection ──

  const selectableInterventions = useMemo(
    () => paginatedInterventions.filter((i) => !checkedInterventions.has(i.id)),
    [paginatedInterventions, checkedInterventions]
  )

  const allSelected = useMemo(
    () => selectableInterventions.length > 0 && selectableInterventions.every((i) => selectedRows.has(i.id)),
    [selectableInterventions, selectedRows]
  )

  const someSelected = selectedRows.size > 0 && !allSelected

  // ── Handlers ──

  const toggleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      const selectable = paginatedInterventions.filter((i) => !checkedInterventions.has(i.id))
      const allChecked = selectable.length > 0 && selectable.every((i) => prev.has(i.id))
      if (allChecked) {
        selectable.forEach((i) => next.delete(i.id))
      } else {
        selectable.forEach((i) => next.add(i.id))
      }
      return next
    })
  }, [paginatedInterventions, checkedInterventions])

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleOpenModal = useCallback((id: string) => {
    openInterventionModal(id)
  }, [openInterventionModal])

  const copySelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return

    const selectedInterventions = allInterventions.filter((i) => selectedRows.has(i.id))

    const rows = selectedInterventions.map((intervention) => {
      const acompteClient = getPaymentInfo(intervention, "acompte_client")
      const acompteArtisan = getPaymentInfo(intervention, "acompte_sst")
      const inter = intervention as any
      return [
        emptyIfDash(cleanValue(formatDate(facturationDates.get(intervention.id)))),
        cleanValue(inter.agenceLabel || inter.agence || ""),
        cleanValue(inter.assignedUserName || inter.attribueA || ""),
        cleanValue(intervention.id_inter || ""),
        emptyIfDash(cleanValue(formatClientName(intervention))),
        emptyIfDash(cleanValue(formatAddress(intervention))),
        emptyIfDash(cleanValue(getMetierLabel(intervention))),
        cleanValue(inter.contexteIntervention ?? intervention.contexte_intervention ?? ""),
        "",
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "materiel")))),
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "intervention")))),
        "",
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "sst")))),
        "",
        "",
        emptyIfDash(cleanValue(getArtisanName(intervention))),
        "",
        emptyIfDash(cleanValue(formatCurrency(acompteClient.amount))),
        emptyIfDash(cleanValue(formatDate(acompteClient.date))),
        emptyIfDash(cleanValue(formatCurrency(acompteArtisan.amount))),
        emptyIfDash(cleanValue(formatDate(acompteArtisan.date))),
      ]
    })

    const tsvContent = rows.map((row) => row.join("\t")).join("\n")

    try {
      await navigator.clipboard.writeText(tsvContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Erreur lors de la copie:", err)
    }
  }, [selectedRows, allInterventions, facturationDates])

  const copyAndCheckSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return

    await copySelectedRows()

    const idsToCheck = Array.from(selectedRows)
    await bulkCheck(idsToCheck)

    setSelectedRows(new Set())

    setCopiedAndChecked(true)
    setTimeout(() => setCopiedAndChecked(false), 2000)
  }, [selectedRows, copySelectedRows, bulkCheck])

  if (!loadingUser && !loadingPermissions && (!currentUser || !canAccessComptabilite)) {
    return null
  }

  // ── Helper : style inline par colonne (width/min/max) ──
  const getColStyle = (key: string): CSSProperties => {
    const w = (columnWidths[key] as number) ?? DEFAULT_COL_WIDTHS[key]
    return { width: w, minWidth: w, maxWidth: w }
  }

  return (
    <PagePresenceProvider pageName="comptabilite">
    <div className="flex flex-col h-full p-4 sm:p-6 overflow-hidden gap-3">
      {/* Barre de filtres et actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card/50 px-3 py-2.5">
        <fieldset className="contents" aria-label="Filtres de période">
          <div className="flex items-center gap-1.5">
            <label htmlFor="period-type" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Période</label>
            {isMounted ? (
              <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
                <SelectTrigger id="period-type" className="h-8 w-fit min-w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Skeleton className="h-8 w-[90px] rounded-md" />
            )}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">De</label>
            {isMounted ? (
              <>
                <Select value={startYear} onValueChange={setStartYear}>
                  <SelectTrigger className="h-8 w-fit min-w-[80px] text-xs" aria-label="Année de début">
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {periodType === "month" && (
                  <Select value={startMonth} onValueChange={setStartMonth}>
                    <SelectTrigger className="h-8 w-fit min-w-[100px] text-xs" aria-label="Mois de début">
                      <SelectValue placeholder="Mois" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((month) => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            ) : (
              <Skeleton className="h-8 w-[80px] rounded-md" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">À</label>
            {isMounted ? (
              <>
                <Select value={endYear} onValueChange={setEndYear}>
                  <SelectTrigger className="h-8 w-fit min-w-[80px] text-xs" aria-label="Année de fin">
                    <SelectValue placeholder="Année" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {periodType === "month" && (
                  <Select value={endMonth} onValueChange={setEndMonth}>
                    <SelectTrigger className="h-8 w-fit min-w-[100px] text-xs" aria-label="Mois de fin">
                      <SelectValue placeholder="Mois" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMonths.map((month) => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            ) : (
              <Skeleton className="h-8 w-[80px] rounded-md" />
            )}
          </div>
        </fieldset>

        {!isLoading && (
          <Badge variant="secondary" className="text-foreground font-medium tabular-nums">
            {totalCount} intervention{totalCount > 1 ? "s" : ""}
          </Badge>
        )}

        <PagePresenceSection />

        <div className="flex-1" />

        <div className="flex items-center gap-2" role="toolbar" aria-label="Actions sur la sélection">
          {selectedRows.size > 0 && (
            <Badge variant="outline" className="text-foreground font-medium tabular-nums text-xs">
              {selectedRows.size} sélectionné{selectedRows.size > 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copySelectedRows}
            disabled={selectedRows.size === 0}
            className={cn(
              "h-8 text-xs gap-1.5 transition-colors",
              copied && "bg-green-500/10 text-green-600 border-green-500/30"
            )}
            aria-label={selectedRows.size === 0 ? "Sélectionnez des lignes pour copier" : `Copier ${selectedRows.size} lignes sélectionnées`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copié !" : "Copier"}
          </Button>
          <Button
            size="sm"
            onClick={copyAndCheckSelectedRows}
            disabled={selectedRows.size === 0}
            className={cn(
              "h-8 text-xs gap-1.5 transition-colors",
              copiedAndChecked
                ? "bg-green-600 text-white border-green-600"
                : "bg-green-500 hover:bg-green-600 text-white border-green-500"
            )}
            aria-label={selectedRows.size === 0 ? "Sélectionnez des lignes" : `Copier et marquer ${selectedRows.size} lignes comme gérées`}
          >
            {copiedAndChecked ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedAndChecked ? "Copié + Géré !" : "Copier + Check"}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tableau - même pattern que TableView interventions */}
      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1 comptabilite-table-scroll" role="region" aria-label="Tableau comptabilité" tabIndex={0}>
          <div className="min-w-fit h-full flex flex-col">
            <table
              className="data-table shadcn-table comptabilite-table border-separate border-spacing-0"
              style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}
            >
              {/* Header avec handles de resize */}
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-border/60">
                  {COLUMNS.map((col) => {
                    const w = (columnWidths[col.key] as number) ?? col.defaultWidth
                    const isSticky = "sticky" in col && col.sticky
                    return (
                      <th
                        key={col.key}
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        className={cn(
                          "border-b px-2 py-2.5 text-left text-xs font-semibold text-muted-foreground",
                          "whitespace-nowrap align-middle relative select-none",
                          isSticky && [
                            "sticky right-0 z-[60]",
                            "bg-muted/95 backdrop-blur-sm",
                            "shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.1)]",
                            "dark:shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.3)]",
                          ],
                        )}
                      >
                        <div className="relative flex items-center gap-1">
                          {col.key === "select" ? (
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={toggleSelectAll}
                              aria-label={allSelected ? "Désélectionner toutes les lignes" : "Sélectionner toutes les lignes non gérées"}
                              className={cn(someSelected && "data-[state=checked]:bg-primary/50")}
                            />
                          ) : (
                            <span className="truncate">{col.label}</span>
                          )}
                          {/* Handle de redimensionnement (identique à TableView) */}
                          {(!("resizable" in col) || col.resizable !== false) && (
                            <div
                              className={cn(
                                "absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors duration-150",
                                activeColumn === col.key
                                  ? "bg-primary/50"
                                  : "opacity-0 hover:opacity-100 hover:bg-primary/30",
                              )}
                              onPointerDown={(event) => handlePointerDown(event, col.key)}
                            />
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 12 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b">
                    {COLUMNS.map((col) => (
                      <td key={col.key} style={getColStyle(col.key)} className="px-2 py-2 align-middle overflow-hidden">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && totalCount === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="text-center text-sm text-muted-foreground py-12">
                      Aucune intervention terminée pour la période sélectionnée.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  paginatedInterventions.map((intervention) => (
                    <ComptabiliteTableRow
                      key={intervention.id}
                      intervention={intervention}
                      facturationDate={facturationDates.get(intervention.id)}
                      isSelected={selectedRows.has(intervention.id)}
                      isComptaChecked={checkedInterventions.has(intervention.id)}
                      onToggleSelect={toggleSelectRow}
                      onToggleComptaCheck={toggleComptaCheck}
                      onOpenModal={handleOpenModal}
                      columnWidths={columnWidths}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {!isLoading && totalCount > 0 && (
          <div className="border-t px-2 py-1.5 shrink-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
    </PagePresenceProvider>
  )
}
