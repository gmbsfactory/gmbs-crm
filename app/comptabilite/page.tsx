"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"
import { format, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useComptabiliteQuery } from "@/hooks/useComptabiliteQuery"
import { cn } from "@/lib/utils"
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

type PeriodType = "month" | "year"

const STORAGE_KEY_PERIOD_TYPE = "comptabilite-period-type"
const STORAGE_KEY_START_YEAR = "comptabilite-start-year"
const STORAGE_KEY_START_MONTH = "comptabilite-start-month"
const STORAGE_KEY_END_YEAR = "comptabilite-end-year"
const STORAGE_KEY_END_MONTH = "comptabilite-end-month"

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
      // year
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

  // Hook TanStack Query pour les données comptabilité (cache, prefetch, optimistic updates)
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

  // Réinitialiser la page si on dépasse après un filtrage
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  // Réinitialiser les sélections quand on change de filtre de date
  useEffect(() => {
    setSelectedRows(new Set())
    setCurrentPage(1)
  }, [dateRange])

  // ── Sélection mémoïsée ──

  const selectableInterventions = useMemo(
    () => paginatedInterventions.filter((i) => !checkedInterventions.has(i.id)),
    [paginatedInterventions, checkedInterventions]
  )

  const allSelected = useMemo(
    () => selectableInterventions.length > 0 && selectableInterventions.every((i) => selectedRows.has(i.id)),
    [selectableInterventions, selectedRows]
  )

  const someSelected = selectedRows.size > 0 && !allSelected

  // ── Handlers stabilisés avec useCallback ──

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

  // Fonction de copie au format Excel (TSV)
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

  // Copier ET marquer comme gérées toutes les lignes sélectionnées
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

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">
      <h1 className="text-2xl font-bold mb-4">Comptabilité</h1>

      {/* Filter bar */}
      <div
        className="mb-4 p-4 bg-muted/50 rounded-lg"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, auto))",
          gap: "1rem",
          alignItems: "center",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">Type de période :</span>
          {isMounted ? (
            <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
              <SelectTrigger className="w-fit min-w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="w-[110px] h-10 rounded-md border bg-background flex items-center px-3">
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}
        </div>

        {/* Filtre De */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">De :</span>
          {isMounted ? (
            <>
              <Select value={startYear} onValueChange={setStartYear}>
                <SelectTrigger className="w-fit min-w-[100px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {periodType === "month" && (
                <Select value={startMonth} onValueChange={setStartMonth}>
                  <SelectTrigger className="w-fit min-w-[120px]">
                    <SelectValue placeholder="Mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          ) : (
            <div className="w-[100px] h-10 rounded-md border bg-background flex items-center px-3">
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}
        </div>

        {/* Filtre À */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">À :</span>
          {isMounted ? (
            <>
              <Select value={endYear} onValueChange={setEndYear}>
                <SelectTrigger className="w-fit min-w-[100px]">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {periodType === "month" && (
                <Select value={endMonth} onValueChange={setEndMonth}>
                  <SelectTrigger className="w-fit min-w-[120px]">
                    <SelectValue placeholder="Mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          ) : (
            <div className="w-[100px] h-10 rounded-md border bg-background flex items-center px-3">
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          )}
        </div>

        {/* Badge avec le nombre d'interventions */}
        {!isLoading && (
          <Badge variant="secondary" className="text-foreground font-medium whitespace-nowrap">
            {totalCount} intervention{totalCount > 1 ? "s" : ""}
          </Badge>
        )}

        {/* Bouton de copie */}
        <div className="flex items-center gap-2 ml-auto">
          {selectedRows.size > 0 && (
            <Badge variant="outline" className="text-foreground font-medium">
              {selectedRows.size} sélectionné{selectedRows.size > 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={copySelectedRows}
            disabled={selectedRows.size === 0}
            className={cn(
              "flex items-center gap-2 transition-all",
              copied && "bg-green-500/10 text-green-600 border-green-500/30"
            )}
            title={selectedRows.size === 0 ? "Sélectionnez des lignes pour copier" : "Copier les lignes sélectionnées"}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copier
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={copyAndCheckSelectedRows}
            disabled={selectedRows.size === 0}
            className={cn(
              "flex items-center gap-2 transition-all",
              copiedAndChecked
                ? "bg-green-600 text-white border-green-600"
                : "bg-green-500 hover:bg-green-600 text-white border-green-500"
            )}
            title={selectedRows.size === 0 ? "Sélectionnez des lignes" : "Copier et marquer comme gérées"}
          >
            {copiedAndChecked ? (
              <>
                <Check className="h-4 w-4" />
                Copié + Géré !
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copier + Check
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <Table className="w-full" style={{ tableLayout: "fixed" }}>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Sélectionner toutes les lignes"
                  className={cn(someSelected && "data-[state=checked]:bg-primary/50")}
                />
              </TableHead>
              <TableHead className="w-[90px]">Date Facturation</TableHead>
              <TableHead className="w-[80px]">Agence</TableHead>
              <TableHead className="w-[80px]">Attribué</TableHead>
              <TableHead className="w-[70px]">ID</TableHead>
              <TableHead className="w-[100px]">Client</TableHead>
              <TableHead className="w-[120px]">Adresse</TableHead>
              <TableHead className="w-[75px]">Métier</TableHead>
              <TableHead className="w-[140px]">Contexte</TableHead>
              <TableHead className="w-[85px]">Matériel</TableHead>
              <TableHead className="w-[75px]">Inter</TableHead>
              <TableHead className="w-[70px]">SST</TableHead>
              <TableHead className="w-[90px]">Artisan</TableHead>
              <TableHead className="w-[95px]">Ac. Client</TableHead>
              <TableHead className="w-[100px]">Date Ac. Client</TableHead>
              <TableHead className="w-[100px]">Ac. Artisan</TableHead>
              <TableHead className="w-[110px]">Date Ac. Artisan</TableHead>
              <TableHead className="w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 12 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-18" /></TableCell>
                <TableCell><Skeleton className="h-4 w-18" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-sm text-muted-foreground py-8">
                  Aucune intervention terminée pour la période sélectionnée.
                </TableCell>
              </TableRow>
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
                />
              ))}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        {!isLoading && totalCount > 0 && (
          <div className="border-t p-2">
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
  )
}
