"use client"

import { useState, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useQuery } from "@tanstack/react-query"
import { referenceApi } from "@/lib/reference-api"
import { enumsApi } from "@/lib/supabase-api-v2"
import { DatePicker } from "@/components/ui/date-picker"
import { DateRangePicker } from "@/components/interventions/DateRangePicker"
import { format, startOfWeek, endOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"

type PeriodType = "jour" | "semaine" | "mois" | "annee"

interface FilterBarProps {
  onPeriodChange: (period: PeriodType) => void
  onDateChange?: (startDate: string | null, endDate: string | null) => void
  onAgenceChange?: (agence: string) => void
  onGestionnaireChange?: (gestionnaire: string) => void
  onMetierChange?: (metier: string) => void
}

const MONTHS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
]

// Générer les années de 2020 à 2030
const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i)

export function FilterBar({ 
  onPeriodChange, 
  onDateChange,
  onAgenceChange, 
  onGestionnaireChange, 
  onMetierChange 
}: FilterBarProps) {
  const [period, setPeriod] = useState<PeriodType>("mois")
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, "0"))
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [weekRange, setWeekRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  })

  // Charger les gestionnaires depuis la BDD
  const { data: gestionnaires, isLoading: isLoadingGestionnaires } = useGestionnaires()
  
  // Charger les agences depuis la BDD
  const { data: agences, isLoading: isLoadingAgences } = useQuery({
    queryKey: ["agences"],
    queryFn: async () => {
      return await referenceApi.getAgencies()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  // Charger les métiers depuis la BDD
  const { data: metiers, isLoading: isLoadingMetiers } = useQuery({
    queryKey: ["metiers"],
    queryFn: async () => {
      return await enumsApi.getMetiers()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Gérer le changement de période
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod)
    onPeriodChange(newPeriod)
    
    // Réinitialiser les dates selon le type de période
    const now = new Date()
    switch (newPeriod) {
      case "jour":
        setSelectedDay(now)
        onDateChange?.(format(now, "yyyy-MM-dd"), format(now, "yyyy-MM-dd"))
        break
      case "semaine":
        const weekStart = startOfWeek(now, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
        setWeekRange({ from: weekStart, to: weekEnd })
        onDateChange?.(format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd"))
        break
      case "mois":
        setSelectedMonth((now.getMonth() + 1).toString().padStart(2, "0"))
        setSelectedYear(now.getFullYear().toString())
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        onDateChange?.(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd"))
        break
      case "annee":
        setSelectedYear(now.getFullYear().toString())
        const yearStart = new Date(now.getFullYear(), 0, 1)
        const yearEnd = new Date(now.getFullYear(), 11, 31)
        onDateChange?.(format(yearStart, "yyyy-MM-dd"), format(yearEnd, "yyyy-MM-dd"))
        break
    }
  }

  // Gérer le changement d'année
  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    if (period === "annee") {
      const yearStart = new Date(parseInt(year), 0, 1)
      const yearEnd = new Date(parseInt(year), 11, 31)
      onDateChange?.(format(yearStart, "yyyy-MM-dd"), format(yearEnd, "yyyy-MM-dd"))
    } else if (period === "mois") {
      const monthStart = new Date(parseInt(year), parseInt(selectedMonth) - 1, 1)
      const monthEnd = new Date(parseInt(year), parseInt(selectedMonth), 0)
      onDateChange?.(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd"))
    }
  }

  // Gérer le changement de mois
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    const monthStart = new Date(parseInt(selectedYear), parseInt(month) - 1, 1)
    const monthEnd = new Date(parseInt(selectedYear), parseInt(month), 0)
    onDateChange?.(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd"))
  }

  // Gérer le changement de jour
  const handleDayChange = (date: Date | null) => {
    setSelectedDay(date)
    if (date) {
      onDateChange?.(format(date, "yyyy-MM-dd"), format(date, "yyyy-MM-dd"))
    }
  }

  // Gérer le changement de semaine
  const handleWeekRangeChange = (range: { from: Date | null; to: Date | null }) => {
    setWeekRange(range)
    if (range.from && range.to) {
      onDateChange?.(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"))
    }
  }

  return (
    <Card className="border border-border rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-2 block">Période</label>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jour">Jour</SelectItem>
              <SelectItem value="semaine">Semaine</SelectItem>
              <SelectItem value="mois">Mois</SelectItem>
              <SelectItem value="annee">Année</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sélecteur selon le type de période */}
        {period === "jour" && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Date</label>
            <DatePicker
              date={selectedDay}
              onDateChange={handleDayChange}
              placeholder="Sélectionner un jour"
            />
          </div>
        )}

        {period === "semaine" && (
          <div className="flex-1 min-w-[300px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Semaine</label>
            <DateRangePicker
              value={weekRange}
              onChange={handleWeekRangeChange}
            />
          </div>
        )}

        {period === "mois" && (
          <>
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-foreground mb-2 block">Mois</label>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium text-foreground mb-2 block">Année</label>
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {period === "annee" && (
          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Année</label>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {onAgenceChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Agence</label>
            <Select onValueChange={onAgenceChange} disabled={isLoadingAgences}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingAgences ? "Chargement..." : "Toutes les agences"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les agences</SelectItem>
                {agences?.map((agence) => (
                  <SelectItem key={agence.id} value={agence.id}>
                    {agence.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {onGestionnaireChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Gestionnaire</label>
            <Select onValueChange={onGestionnaireChange} disabled={isLoadingGestionnaires}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingGestionnaires ? "Chargement..." : "Tous les gestionnaires"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les gestionnaires</SelectItem>
                {gestionnaires?.map((gestionnaire) => (
                  <SelectItem key={gestionnaire.id} value={gestionnaire.id}>
                    {gestionnaire.firstname} {gestionnaire.lastname}
                    {gestionnaire.code_gestionnaire && ` (${gestionnaire.code_gestionnaire})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {onMetierChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Métier</label>
            <Select onValueChange={onMetierChange} disabled={isLoadingMetiers}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingMetiers ? "Chargement..." : "Tous les métiers"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les métiers</SelectItem>
                {metiers?.map((metier) => (
                  <SelectItem key={metier.id} value={metier.id}>
                    {metier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Card>
  )
}
