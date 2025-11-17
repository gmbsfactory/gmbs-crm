"use client"

import { useMemo } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useState, useEffect } from "react"
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfYear,
  format,
  getYear,
  parseISO,
} from "date-fns"
import { fr } from "date-fns/locale"

type PeriodType = "week" | "month" | "year"

const STORAGE_KEY = "dashboard-period-type"
const STORAGE_KEY_SELECTED = "dashboard-period-selected"

/**
 * Hook pour gérer la période du dashboard (type, sélection, dates calculées)
 * Centralise toute la logique de gestion de période pour éviter la duplication
 */
export function useDashboardPeriod() {
  const [periodType, setPeriodType] = useState<PeriodType>("month")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [isMounted, setIsMounted] = useState(false)
  const [selectedGestionnaireId, setSelectedGestionnaireId] = useState<string | null>(null)
  
  const { data: currentUser } = useCurrentUser()
  const { data: gestionnaires = [] } = useGestionnaires()

  // Initialiser avec l'utilisateur courant par défaut
  useEffect(() => {
    if (currentUser?.id && !selectedGestionnaireId) {
      setSelectedGestionnaireId(currentUser.id)
    }
  }, [currentUser?.id, selectedGestionnaireId])

  // Charger depuis localStorage après le montage côté client
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "week" || saved === "month" || saved === "year") {
      setPeriodType(saved as PeriodType)
    }
    const savedSelected = localStorage.getItem(STORAGE_KEY_SELECTED)
    if (savedSelected) {
      setSelectedPeriod(savedSelected)
    }
  }, [])

  // Sauvegarder dans localStorage quand la période change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(STORAGE_KEY, periodType)
    }
  }, [periodType, isMounted])

  // Sauvegarder la sélection spécifique
  useEffect(() => {
    if (isMounted && selectedPeriod) {
      localStorage.setItem(STORAGE_KEY_SELECTED, selectedPeriod)
    }
  }, [selectedPeriod, isMounted])

  // Réinitialiser la sélection quand on change de type
  useEffect(() => {
    setSelectedPeriod("")
  }, [periodType])

  // Calculer les dates selon la période sélectionnée
  const period = useMemo(() => {
    let startDate: Date
    let endDate: Date

    if (selectedPeriod) {
      // Utiliser la période sélectionnée
      if (periodType === "month") {
        const [year, month] = selectedPeriod.split("-").map(Number)
        startDate = new Date(year, month - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(year, month, 0, 23, 59, 59, 999)
      } else if (periodType === "week") {
        const selectedDate = parseISO(selectedPeriod)
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 4) // Vendredi
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
      if (periodType === "week") {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        startDate = new Date(now.getFullYear(), now.getMonth(), diff)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 4)
        endDate.setHours(23, 59, 59, 999)
      } else if (periodType === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      } else {
        startDate = new Date(now.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      }
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }, [periodType, selectedPeriod])

  // Obtenir l'utilisateur effectif (gestionnaire sélectionné ou utilisateur courant)
  const effectiveUserId = selectedGestionnaireId || currentUser?.id || null

  return {
    periodType,
    setPeriodType,
    selectedPeriod,
    setSelectedPeriod,
    period,
    effectiveUserId,
    selectedGestionnaireId,
    setSelectedGestionnaireId,
    isMounted,
    gestionnaires,
  }
}




