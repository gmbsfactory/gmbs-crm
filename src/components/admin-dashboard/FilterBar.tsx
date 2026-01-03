"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Card } from "@/components/ui/card"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useQuery } from "@tanstack/react-query"
import { referenceApi } from "@/lib/reference-api"
import { enumsApi } from "@/lib/api/v2"
import { DateRangePicker } from "@/components/interventions/DateRangePicker"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getYear,
  parseISO,
  addDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  isSameMonth,
} from "date-fns"
import { fr } from "date-fns/locale"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type FilterPeriodType = "semaine" | "mois" | "annee" | "custom"

interface FilterBarProps {
  onPeriodChange: (period: FilterPeriodType) => void
  onDateChange: (startDate: string | null, endDate: string | null) => void
  onAgencesChange: (agences: string[]) => void
  onGestionnairesChange: (gestionnaires: string[]) => void
  onMetiersChange: (metiers: string[]) => void
}

export function FilterBar({
  onPeriodChange,
  onDateChange,
  onAgencesChange,
  onGestionnairesChange,
  onMetiersChange
}: FilterBarProps) {
  const [periodType, setPeriodType] = useState<FilterPeriodType>("mois")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("") // Format: "yyyy-MM" pour month, "yyyy-MM-dd" pour week, "yyyy" pour year
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [isCustomMode, setIsCustomMode] = useState(false)
  const isProgrammaticUpdate = useRef(false) // Flag pour éviter de basculer en custom lors des mises à jour programmatiques
  const lastCalculatedDates = useRef<{ from: Date | null; to: Date | null } | null>(null) // Référence pour éviter les boucles infinies

  const [selectedAgences, setSelectedAgences] = useState<string[]>([])
  const [selectedGestionnaires, setSelectedGestionnaires] = useState<string[]>([])
  const [selectedMetiers, setSelectedMetiers] = useState<string[]>([])

  // Charger les gestionnaires
  const { data: gestionnaires, isLoading: isLoadingGestionnaires } = useGestionnaires()

  // Charger les agences
  const { data: agences, isLoading: isLoadingAgences } = useQuery({
    queryKey: ["agences"],
    queryFn: async () => referenceApi.getAgencies(),
    staleTime: 5 * 60 * 1000,
  })

  // Charger les métiers
  const { data: metiers, isLoading: isLoadingMetiers } = useQuery({
    queryKey: ["metiers"],
    queryFn: async () => enumsApi.getMetiers(),
    staleTime: 5 * 60 * 1000,
  })

  // Générer les listes selon le type de période
  const periodOptions = useMemo(() => {
    const currentYear = getYear(new Date())
    const years = [currentYear - 1, currentYear, currentYear + 1]

    if (periodType === "mois") {
      const months: Date[] = []
      years.forEach((year) => {
        const start = startOfYear(new Date(year, 0, 1))
        const end = endOfYear(new Date(year, 0, 1))
        months.push(...eachMonthOfInterval({ start, end }))
      })
      return months.map((month) => ({
        value: format(month, "yyyy-MM"),
        label: format(month, "MMM yyyy", { locale: fr }),
        year: getYear(month),
      }))
    }

    if (periodType === "semaine") {
      // Générer les semaines du mois courant uniquement
      const now = new Date()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 })

      return weeks.map((weekStart) => {
        const weekEnd = addDays(weekStart, 6)
        return {
          value: format(weekStart, "yyyy-MM-dd"),
          label: `${format(weekStart, "d MMM", { locale: fr })} – ${format(weekEnd, "d MMM yyyy", { locale: fr })}`,
          year: getYear(weekStart),
        }
      })
    }

    // Pour year
    return years.map((year) => ({
      value: year.toString(),
      label: year.toString(),
      year,
    }))
  }, [periodType])

  // Calculer les dates selon la période sélectionnée
  const calculatedDates = useMemo(() => {
    if (isCustomMode) {
      return { from: dateRange.from, to: dateRange.to }
    }

    let startDate: Date
    let endDate: Date

    if (selectedPeriod) {
      // Utiliser la période sélectionnée
      if (periodType === "mois") {
        const [year, month] = selectedPeriod.split("-").map(Number)
        startDate = new Date(year, month - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(year, month, 0, 23, 59, 59, 999)
      } else if (periodType === "semaine") {
        const selectedDate = parseISO(selectedPeriod)
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6) // Dimanche
        endDate.setHours(23, 59, 59, 999)
      } else {
        const year = parseInt(selectedPeriod)
        startDate = new Date(year, 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(year, 11, 31, 23, 59, 59, 999)
      }
    } else {
      // Comportement par défaut (période courante)
      const now = new Date()
      if (periodType === "semaine") {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        startDate = new Date(now.getFullYear(), now.getMonth(), diff)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
      } else if (periodType === "mois") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      } else {
        startDate = new Date(now.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      }
    }

    return { from: startDate, to: endDate }
  }, [periodType, selectedPeriod, isCustomMode, dateRange.from, dateRange.to])

  // Synchroniser dateRange avec calculatedDates quand ce n'est pas en mode custom
  useEffect(() => {
    if (!isCustomMode && calculatedDates.from && calculatedDates.to) {
      // Comparer avec les dernières dates calculées pour éviter les mises à jour inutiles
      const datesChanged = 
        !lastCalculatedDates.current ||
        !lastCalculatedDates.current.from ||
        !lastCalculatedDates.current.to ||
        lastCalculatedDates.current.from.getTime() !== calculatedDates.from.getTime() ||
        lastCalculatedDates.current.to.getTime() !== calculatedDates.to.getTime()
      
      if (datesChanged) {
        lastCalculatedDates.current = { from: calculatedDates.from, to: calculatedDates.to }
        isProgrammaticUpdate.current = true
        setDateRange({ from: calculatedDates.from, to: calculatedDates.to })
        onDateChange(format(calculatedDates.from, "yyyy-MM-dd"), format(calculatedDates.to, "yyyy-MM-dd"))
        // Reset le flag après un court délai
        setTimeout(() => {
          isProgrammaticUpdate.current = false
        }, 100)
      }
    } else if (isCustomMode) {
      // Réinitialiser la référence en mode custom
      lastCalculatedDates.current = null
    }
  }, [calculatedDates, isCustomMode, onDateChange])

  // Obtenir la valeur actuelle pour le Select
  const getCurrentSelectValue = () => {
    if (selectedPeriod) return selectedPeriod

    // Par défaut, utiliser la période courante
    const now = new Date()
    if (periodType === "mois") {
      return format(now, "yyyy-MM")
    }
    if (periodType === "semaine") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      return format(weekStart, "yyyy-MM-dd")
    }
    return getYear(now).toString()
  }

  // Gérer le changement de type de période
  const handlePeriodTypeChange = (newType: FilterPeriodType) => {
    setPeriodType(newType)
    setIsCustomMode(newType === "custom")
    setSelectedPeriod("") // Réinitialiser la sélection
    onPeriodChange(newType)
  }

  // Gérer le changement de sélection de période
  const handlePeriodSelect = (value: string) => {
    setSelectedPeriod(value)
    setIsCustomMode(false)
  }

  // Gérer le changement manuel du DateRangePicker
  const handleDateRangeChange = (range: { from: Date | null; to: Date | null }) => {
    setDateRange(range)

    // Si ce n'est pas une mise à jour programmatique, basculer en mode custom
    if (!isProgrammaticUpdate.current && range.from && range.to) {
      setIsCustomMode(true)
      setPeriodType("custom")
      onPeriodChange("custom")
      onDateChange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"))
    } else if (range.from && range.to) {
      onDateChange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"))
    }
  }

  // Initialisation des dates par défaut (une seule fois au montage)
  useEffect(() => {
    const now = new Date()
    const defaultStart = startOfMonth(now)
    const defaultEnd = endOfMonth(now)
    setDateRange({ from: defaultStart, to: defaultEnd })
    onDateChange(format(defaultStart, "yyyy-MM-dd"), format(defaultEnd, "yyyy-MM-dd"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionnellement vide - initialisation unique au montage

  // Réinitialiser la sélection quand on change de type
  useEffect(() => {
    if (periodType !== "custom") {
      setSelectedPeriod("")
    }
  }, [periodType])

  // Propagation des changements de filtres
  const handleAgencesSelect = (values: string[]) => {
    setSelectedAgences(values)
    onAgencesChange(values)
  }

  const handleGestionnairesSelect = (values: string[]) => {
    setSelectedGestionnaires(values)
    onGestionnairesChange(values)
  }

  const handleMetiersSelect = (values: string[]) => {
    setSelectedMetiers(values)
    onMetiersChange(values)
  }

  return (
    <Card className="border border-border rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Ligne 1: Période et Dates */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Période</label>
            <Select value={periodType} onValueChange={handlePeriodTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semaine">Semaine</SelectItem>
                <SelectItem value="mois">Mois</SelectItem>
                <SelectItem value="annee">Année</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sélecteur de période spécifique (affiché seulement si pas en mode custom) */}
          {periodType !== "custom" && (
            <div className="w-[200px]">
              <label className="text-sm font-medium text-foreground mb-2 block">
                {periodType === "semaine" ? "Semaine" : periodType === "mois" ? "Mois" : "Année"}
              </label>
              <Select
                value={getCurrentSelectValue()}
                onValueChange={handlePeriodSelect}
              >
                <SelectTrigger className={cn(
                  "w-full",
                  periodType === "semaine" && "min-w-[200px]",
                  periodType === "mois" && "min-w-[150px]",
                  periodType === "annee" && "min-w-[120px]"
                )}>
                  <SelectValue>
                    {periodOptions.find((opt) => opt.value === getCurrentSelectValue())?.label || "Sélectionner"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(() => {
                    const currentYear = getYear(new Date())
                    const years = [currentYear - 1, currentYear, currentYear + 1]

                    if (periodType === "mois") {
                      return years.map((year) => {
                        const yearMonths = periodOptions.filter((opt) => opt.year === year)
                        if (yearMonths.length === 0) return null
                        return (
                          <div key={year}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-0 bg-popover">
                              {year}
                            </div>
                            {yearMonths.map((month) => (
                              <SelectItem key={month.value} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </div>
                        )
                      })
                    }

                    if (periodType === "semaine") {
                      return periodOptions.map((week) => (
                        <SelectItem key={week.value} value={week.value}>
                          {week.label}
                        </SelectItem>
                      ))
                    }

                    // Pour year
                    return periodOptions.map((year) => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex-1 min-w-[300px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Plage de dates</label>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>

        <Separator />

        {/* Ligne 2: Filtres Multisélection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Agences</label>
            <MultiSelect
              options={agences?.map((agence) => ({
                value: agence.id,
                label: agence.label
              })) || []}
              selected={selectedAgences}
              onChange={handleAgencesSelect}
              placeholder="Sélectionner agences..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Gestionnaires</label>
            <MultiSelect
              options={gestionnaires?.map((gestionnaire) => ({
                value: gestionnaire.id,
                label: `${gestionnaire.firstname} ${gestionnaire.lastname}`
              })) || []}
              selected={selectedGestionnaires}
              onChange={handleGestionnairesSelect}
              placeholder="Sélectionner gestionnaires..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Métiers</label>
            <MultiSelect
              options={metiers?.map((metier) => ({
                value: metier.id,
                label: metier.label
              })) || []}
              selected={selectedMetiers}
              onChange={handleMetiersSelect}
              placeholder="Sélectionner métiers..."
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
