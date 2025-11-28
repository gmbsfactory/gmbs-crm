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
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { interventionsApi } from "@/lib/api/v2"
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
  const payments = Array.isArray(intervention.payments) ? intervention.payments : []
  if (!payments.length) return { amount: null, date: null }
  const filtered = payments.filter((payment) => payment?.payment_type === paymentType)
  if (!filtered.length) return { amount: null, date: null }
  const amount = filtered.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0)
  const date = filtered.find((payment) => payment?.payment_date)?.payment_date ?? filtered[0]?.payment_date ?? null
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

  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  const hasRoleAccess = useMemo(() => {
    const roles = currentUser?.roles || []
    return roles.some((role) => {
      const normalized = (role || "").toLowerCase()
      return normalized === "admin" || normalized === "manager"
    })
  }, [currentUser?.roles])

  const hasPagePermission = currentUser?.page_permissions?.comptabilite !== false
  const canAccessComptabilite = hasRoleAccess && hasPagePermission

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
    if (loadingUser) return
    if (!currentUser) {
      router.replace("/dashboard")
      return
    }
    if (!canAccessComptabilite) {
      router.replace("/dashboard")
    }
  }, [canAccessComptabilite, currentUser, loadingUser, router])

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
          include: ["artisans", "costs"],
          limit: 1000,
        })
        let filtered = (data || []).filter((intervention) => {
          const statusCode = (intervention.status?.code || (intervention as any).statusValue || (intervention as any).statut || "").toUpperCase()
          return statusCode === "INTER_TERMINEE"
        })

        // Appliquer le filtre de date si disponible
        if (dateRange) {
          filtered = filtered.filter((intervention) => {
            const interventionDate = (intervention as any).dateIntervention ?? intervention.date
            if (!interventionDate) return false
            const date = new Date(interventionDate)
            const start = new Date(dateRange.start)
            const end = new Date(dateRange.end)
            return date >= start && date <= end
          })
        }

        setInterventions(filtered as InterventionRecord[])
      } catch (err: any) {
        setError(err?.message || "Impossible de charger les interventions")
      } finally {
        setLoading(false)
      }
    }

    fetchInterventions()
  }, [canAccessComptabilite, currentUser, dateRange])

  const isLoading = loading || loadingUser

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

  // Gestion de la sélection
  const allSelected = paginatedInterventions.length > 0 && paginatedInterventions.every((i) => selectedRows.has(i.id))
  const someSelected = selectedRows.size > 0 && !allSelected

  const toggleSelectAll = () => {
    const newSelected = new Set(selectedRows)
    if (allSelected) {
      // Désélectionner toutes les lignes de la page actuelle
      paginatedInterventions.forEach((i) => newSelected.delete(i.id))
    } else {
      // Sélectionner toutes les lignes de la page actuelle
      paginatedInterventions.forEach((i) => newSelected.add(i.id))
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
    
    // En-têtes de colonnes
    const headers = [
      "Date",
      "Agence",
      "Attribué à",
      "ID_inter",
      "Client",
      "Adresse",
      "Métier",
      "Contexte",
      "Coût Matériel",
      "Coût Inter",
      "Coût SST",
      "Artisan",
      "Acompte Client",
      "Date Acompte Client",
      "Acompte Artisan",
      "Date Acompte Artisan",
    ]

    // Construire les lignes de données
    const rows = selectedInterventions.map((intervention) => {
      const acompteClient = getPaymentInfo(intervention, "acompte_client")
      const acompteArtisan = getPaymentInfo(intervention, "acompte_artisan")
      
      // Nettoyer toutes les valeurs pour éviter les retours à la ligne
      const inter = intervention as any
      return [
        cleanValue(formatDate(inter.dateIntervention ?? intervention.date)),
        cleanValue(inter.agenceLabel || inter.agence || "—"),
        cleanValue(inter.assignedUserName || inter.attribueA || "—"),
        cleanValue(intervention.id_inter || "—"),
        cleanValue(formatClientName(intervention)),
        cleanValue(formatAddress(intervention)),
        cleanValue(getMetierLabel(intervention)),
        cleanValue(inter.contexteIntervention ?? intervention.contexte_intervention ?? "—"),
        cleanValue(formatCurrency(getCostAmountByType(intervention, "materiel"))),
        cleanValue(formatCurrency(getCostAmountByType(intervention, "intervention"))),
        cleanValue(formatCurrency(getCostAmountByType(intervention, "sst"))),
        cleanValue(getArtisanName(intervention)),
        cleanValue(formatCurrency(acompteClient.amount)),
        cleanValue(formatDate(acompteClient.date)),
        cleanValue(formatCurrency(acompteArtisan.amount)),
        cleanValue(formatDate(acompteArtisan.date)),
      ]
    })

    // Créer le contenu TSV (Tab Separated Values - compatible Excel)
    const tsvContent = [
      headers.join("\t"),
      ...rows.map((row) => row.join("\t")),
    ].join("\n")

    try {
      await navigator.clipboard.writeText(tsvContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Erreur lors de la copie:", err)
    }
  }

  if (!loadingUser && (!currentUser || !canAccessComptabilite)) {
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
              <TableHead className="w-[85px]">Date</TableHead>
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
              <TableHead className="w-[60px]">Action</TableHead>
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
                const acompteArtisan = getPaymentInfo(intervention, "acompte_artisan")
                const isSelected = selectedRows.has(intervention.id)
                return (
                  <TableRow 
                    key={intervention.id}
                    className={cn(isSelected && "bg-muted/50")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectRow(intervention.id)}
                        aria-label={`Sélectionner la ligne ${intervention.id_inter || intervention.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell content={formatDate((intervention as any).dateIntervention ?? intervention.date)} maxWidth="75px" />
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
