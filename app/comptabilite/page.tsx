"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Loader2, Copy, Check } from "lucide-react"
import { format, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Pagination } from "@/components/ui/pagination"
import { TruncatedCell } from "@/components/ui/truncated-cell"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { interventionsApi } from "@/lib/api/v2"
import { comptaApi } from "@/lib/api/compta"
import type { InterventionWithStatus } from "@/types/intervention"
import { cn } from "@/lib/utils"

type InterventionRecord = InterventionWithStatus & {
  intervention_artisans?: Array<{
    artisan_id?: string
    is_primary?: boolean
    role?: string | null
    artisans?: { prenom?: string | null; nom?: string | null } | null
  }>
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount))
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

const formatName = (first?: string | null, last?: string | null) => {
  const full = `${first ?? ""} ${last ?? ""}`.trim()
  return full.length ? full : "—"
}

const formatClientName = (intervention: any) => {
  return formatName(intervention?.prenomClient ?? intervention?.prenom_client, intervention?.nomClient ?? intervention?.nom_client)
}

const formatAddress = (intervention: any) => {
  const parts = [
    intervention?.adresse ?? "",
    [intervention?.code_postal ?? intervention?.codePostal ?? "", intervention?.ville ?? ""].filter(Boolean).join(" "),
  ].filter((part) => (part ?? "").toString().trim().length > 0)
  return parts.length ? parts.join(", ") : "—"
}

const getMetierLabel = (intervention: any) => intervention?.metierLabel ?? intervention?.metier ?? "—"

const getCostAmountByType = (intervention: InterventionRecord, type: "materiel" | "intervention" | "sst") => {
  const costs = Array.isArray((intervention as any).costs) ? (intervention as any).costs : []
  if (costs.length > 0) {
    return costs
      .filter((cost: any) => cost?.cost_type === type)
      .reduce((sum: number, cost: any) => sum + (Number(cost?.amount) || 0), 0)
  }
  if (type === "materiel") return (intervention as any).coutMateriel ?? null
  if (type === "intervention") return (intervention as any).coutIntervention ?? null
  if (type === "sst") return (intervention as any).coutSST ?? null
  return null
}

const getPaymentInfo = (intervention: InterventionRecord, paymentType: string) => {
  // Utiliser payments ou intervention_payments selon ce qui est disponible
  const inter = intervention as any
  const payments = Array.isArray(intervention.payments) && intervention.payments.length > 0
    ? intervention.payments
    : Array.isArray(inter.intervention_payments)
      ? inter.intervention_payments
      : []
  if (!payments.length) return { amount: null, date: null }
  const filtered = payments.filter((payment: any) => payment?.payment_type === paymentType)
  if (!filtered.length) return { amount: null, date: null }
  const amount = filtered.reduce((sum: number, payment: any) => sum + (Number(payment?.amount) || 0), 0)
  const date = filtered.find((payment: any) => payment?.payment_date)?.payment_date ?? filtered[0]?.payment_date ?? null
  return { amount, date }
}

const getArtisanName = (intervention: InterventionRecord) => {
  const artisans = Array.isArray(intervention.intervention_artisans) ? intervention.intervention_artisans : []
  const primary = artisans.find((artisan) => artisan?.is_primary) ?? artisans[0]
  const details = primary?.artisans
  return formatName(details?.prenom, details?.nom)
}

type PeriodType = "month" | "year"

const STORAGE_KEY_PERIOD_TYPE = "comptabilite-period-type"
const STORAGE_KEY_START_YEAR = "comptabilite-start-year"
const STORAGE_KEY_START_MONTH = "comptabilite-start-month"
const STORAGE_KEY_END_YEAR = "comptabilite-end-year"
const STORAGE_KEY_END_MONTH = "comptabilite-end-month"

export default function ComptabilitePage() {
  const router = useRouter()
  const { open: openInterventionModal } = useInterventionModal()
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser()
  const { can, isLoading: loadingPermissions } = usePermissions()
  const [interventions, setInterventions] = useState<InterventionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  
  // État pour les interventions marquées comme "gérées" en compta
  const [checkedInterventions, setCheckedInterventions] = useState<Set<string>>(new Set())

  // État pour les dates de facturation (date de passage à INTER_TERMINEE)
  const [facturationDates, setFacturationDates] = useState<Map<string, string>>(new Map())

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

  useEffect(() => {
    const fetchInterventions = async () => {
      if (!currentUser || !canAccessComptabilite) return
      setLoading(true)
      setError(null)
      try {
        const status = await interventionsApi.getStatusByCode("INTER_TERMINEE")
        if (!status?.id) {
          setError("Statut INTER_TERMINEE introuvable")
          setInterventions([])
          return
        }
        const { data } = await interventionsApi.getAll({
          statut: status.id,
          include: ["artisans", "costs", "payments"],
          limit: 1000,
        })

        let allInterventions = (data || []).filter((intervention) => {
          const statusCode = (intervention.status?.code || (intervention as any).statusValue || (intervention as any).statut || "").toUpperCase()
          return statusCode === "INTER_TERMINEE"
        })

        // Récupérer les dates de facturation depuis intervention_status_transitions
        const allIds = allInterventions.map(i => i.id)
        const dates = await comptaApi.getFacturationDates(allIds)
        setFacturationDates(dates)

        // Appliquer le filtre de date par date de facturation
        let filtered = allInterventions
        if (dateRange) {
          filtered = allInterventions.filter((intervention) => {
            const dateFacturation = dates.get(intervention.id)
            if (!dateFacturation) return false
            const date = new Date(dateFacturation)
            const start = new Date(dateRange.start)
            const end = new Date(dateRange.end)
            return date >= start && date <= end
          })
        }

        // Trier par date de facturation - plus récent en premier
        filtered.sort((a, b) => {
          const dateA = new Date(dates.get(a.id) || 0).getTime()
          const dateB = new Date(dates.get(b.id) || 0).getTime()
          return dateB - dateA
        })

        setInterventions(filtered as InterventionRecord[])

        // Récupérer les checks compta
        const ids = filtered.map(i => i.id)
        const checks = await comptaApi.getCheckedInterventions(ids)
        setCheckedInterventions(checks)
      } catch (err: any) {
        setError(err?.message || "Impossible de charger les interventions")
      } finally {
        setLoading(false)
      }
    }

    fetchInterventions()
  }, [canAccessComptabilite, currentUser, dateRange])

  const isLoading = loading || loadingUser || loadingPermissions

  // Pagination
  const totalPages = Math.ceil(interventions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInterventions = interventions.slice(startIndex, endIndex)

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

  // Gestion de la sélection (exclut les lignes déjà cochées en compta)
  const selectableInterventions = paginatedInterventions.filter((i) => !checkedInterventions.has(i.id))
  const allSelected = selectableInterventions.length > 0 && selectableInterventions.every((i) => selectedRows.has(i.id))
  const someSelected = selectedRows.size > 0 && !allSelected

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedRows)
    if (allSelected) {
      // Désélectionner toutes les lignes sélectionnables de la page actuelle
      selectableInterventions.forEach((i) => newSelected.delete(i.id))
    } else {
      // Sélectionner toutes les lignes non-cochées en compta de la page actuelle
      selectableInterventions.forEach((i) => newSelected.add(i.id))
    }
    setSelectedRows(newSelected)
  }

  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  // Tâche #182 : Toggle le statut "géré" d'une intervention (optimistic update)
  const toggleComptaCheck = async (interventionId: string) => {
    const wasChecked = checkedInterventions.has(interventionId)
    const newChecked = !wasChecked

    // Mise à jour optimiste immédiate de l'UI
    setCheckedInterventions(prev => {
      const next = new Set(prev)
      if (newChecked) {
        next.add(interventionId)
      } else {
        next.delete(interventionId)
      }
      return next
    })

    // Appel API en arrière-plan
    const success = newChecked
      ? await comptaApi.check(interventionId)
      : await comptaApi.uncheck(interventionId)

    // Rollback si échec
    if (!success) {
      setCheckedInterventions(prev => {
        const next = new Set(prev)
        if (wasChecked) {
          next.add(interventionId)
        } else {
          next.delete(interventionId)
        }
        return next
      })
    }
  }

  // Fonction pour nettoyer les valeurs et éviter les retours à la ligne
  const cleanValue = (value: string): string => {
    return value
      .replace(/[\r\n]+/g, " ") // Remplacer tous les retours à la ligne par des espaces
      .replace(/\s+/g, " ") // Remplacer les espaces multiples par un seul espace
      .trim() // Supprimer les espaces en début et fin
  }

  // Fonction de copie au format Excel (TSV)
  const copySelectedRows = async () => {
    if (selectedRows.size === 0) return

    const selectedInterventions = interventions.filter((i) => selectedRows.has(i.id))
    
    // En-têtes de colonnes (format compatible avec le tableau Excel existant)
    const headers = [
      "Date",
      "Agence",
      "GESTIONNAIRE",
      "ID",
      "Nom Prénom",
      "ADRESSE",
      "METIER",
      "INTERVENTION",
      "",  // colonne vide
      "COUT MATÉRIEL",
      "MONTANT HT",
      "MONTANT TTC",
      "COUT SST",
      "",  // colonne vide 1
      "",  // colonne vide 2
      "SST",
      "",  // colonne vide
      "Acompte client",
      "Date acompte client",
      "Acompte sst",
      "Date acompte SST",
    ]

    // Fonction pour remplacer "—" par vide pour la copie
    const emptyIfDash = (value: string) => value === "—" ? "" : value

    // Construire les lignes de données
    const rows = selectedInterventions.map((intervention) => {
      const acompteClient = getPaymentInfo(intervention, "acompte_client")
      const acompteArtisan = getPaymentInfo(intervention, "acompte_sst")

      // Nettoyer toutes les valeurs pour éviter les retours à la ligne
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
        "",  // colonne vide
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "materiel")))),
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "intervention")))),
        "",  // MONTANT TTC - colonne vide
        emptyIfDash(cleanValue(formatCurrency(getCostAmountByType(intervention, "sst")))),
        "",  // colonne vide 1
        "",  // colonne vide 2
        emptyIfDash(cleanValue(getArtisanName(intervention))),
        "",  // colonne vide
        emptyIfDash(cleanValue(formatCurrency(acompteClient.amount))),
        emptyIfDash(cleanValue(formatDate(acompteClient.date))),
        emptyIfDash(cleanValue(formatCurrency(acompteArtisan.amount))),
        emptyIfDash(cleanValue(formatDate(acompteArtisan.date))),
      ]
    })

    // Créer le contenu TSV (Tab Separated Values - compatible Excel) sans les en-têtes
    const tsvContent = rows.map((row) => row.join("\t")).join("\n")

    try {
      await navigator.clipboard.writeText(tsvContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Erreur lors de la copie:", err)
    }
  }

  // Copier ET marquer comme gérées toutes les lignes sélectionnées
  const copyAndCheckSelectedRows = async () => {
    if (selectedRows.size === 0) return

    // D'abord copier
    await copySelectedRows()

    // Puis marquer toutes les lignes sélectionnées comme gérées
    const idsToCheck = Array.from(selectedRows)

    // Mise à jour optimiste immédiate
    setCheckedInterventions(prev => {
      const next = new Set(prev)
      idsToCheck.forEach(id => next.add(id))
      return next
    })

    // Appels API en parallèle
    const results = await Promise.all(
      idsToCheck.map(id => comptaApi.check(id))
    )

    // Rollback des échecs
    const failedIds = idsToCheck.filter((_, index) => !results[index])
    if (failedIds.length > 0) {
      setCheckedInterventions(prev => {
        const next = new Set(prev)
        failedIds.forEach(id => next.delete(id))
        return next
      })
    }

    // Désélectionner les lignes (elles sont maintenant gérées)
    setSelectedRows(new Set())

    // Feedback visuel
    setCopiedAndChecked(true)
    setTimeout(() => setCopiedAndChecked(false), 2000)
  }

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
        {!loading && (
          <Badge variant="secondary" className="text-foreground font-medium whitespace-nowrap">
            {interventions.length} intervention{interventions.length > 1 ? "s" : ""}
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
            {isLoading && (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des interventions…
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && interventions.length === 0 && (
              <TableRow>
                <TableCell colSpan={18} className="text-center text-sm text-muted-foreground py-8">
                  Aucune intervention terminée pour la période sélectionnée.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              paginatedInterventions.map((intervention) => {
                const acompteClient = getPaymentInfo(intervention, "acompte_client")
                const acompteArtisan = getPaymentInfo(intervention, "acompte_sst")
                const isSelected = selectedRows.has(intervention.id)
                const isComptaChecked = checkedInterventions.has(intervention.id)
                return (
                  <TableRow
                    key={intervention.id}
                    className={cn(
                      "transition-colors",
                      isSelected && !isComptaChecked && "bg-muted/50",
                      isComptaChecked && "compta-checked"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectRow(intervention.id)}
                        aria-label={`Sélectionner la ligne ${intervention.id_inter || intervention.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatDate(facturationDates.get(intervention.id))} maxWidth="80px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={(intervention as any).agenceLabel || (intervention as any).agence || "—"} maxWidth="70px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={(intervention as any).assignedUserName || (intervention as any).attribueA || "—"} maxWidth="70px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={intervention.id_inter || "—"} maxWidth="60px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatClientName(intervention)} maxWidth="90px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatAddress(intervention)} maxWidth="110px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={getMetierLabel(intervention)} maxWidth="65px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        content={(intervention as any).contexteIntervention ?? intervention.contexte_intervention ?? "—"}
                        maxWidth="130px"
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "materiel"))} maxWidth="75px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "intervention"))} maxWidth="65px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "sst"))} maxWidth="60px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={getArtisanName(intervention)} maxWidth="80px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatCurrency(acompteClient.amount)} maxWidth="85px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatDate(acompteClient.date)} maxWidth="90px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatCurrency(acompteArtisan.amount)} maxWidth="90px" />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatDate(acompteArtisan.date)} maxWidth="100px" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={isComptaChecked}
                          onCheckedChange={() => toggleComptaCheck(intervention.id)}
                          aria-label="Marquer comme géré"
                          className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (intervention.id) {
                              openInterventionModal(intervention.id)
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        {!isLoading && interventions.length > 0 && (
          <div className="border-t p-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={interventions.length}
              pageSize={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
