"use client"

import { useCallback } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { interventionsApi } from "@/lib/api/v2"
import type { AIDataSummary } from "@/lib/ai/types"

export type SummaryPeriod = 'week' | 'month' | 'quarter'

/**
 * Calcule les dates de debut et fin pour une periode donnee
 */
function getPeriodDates(period: SummaryPeriod): { startDate: string; endDate: string; label: string } {
  const now = new Date()
  const end = now.toISOString()

  switch (period) {
    case 'week': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { startDate: start.toISOString(), endDate: end, label: 'Derniers 7 jours' }
    }
    case 'month': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 1)
      return { startDate: start.toISOString(), endDate: end, label: 'Dernier mois' }
    }
    case 'quarter': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { startDate: start.toISOString(), endDate: end, label: 'Dernier trimestre' }
    }
  }
}

/**
 * Detecte les alertes a partir des donnees collectees
 */
function detectAlerts(
  statsTotal: number,
  byStatusLabel: Record<string, number>,
  marginPercent: number,
  completed: number,
): string[] {
  const alerts: string[] = []

  // Alerte si marge faible (< 15%)
  if (marginPercent > 0 && marginPercent < 15) {
    alerts.push(`Marge moyenne faible : ${marginPercent}% (seuil recommande : 15%)`)
  }

  // Alerte si taux de completion faible
  if (statsTotal > 0 && completed > 0) {
    const completionRate = (completed / statsTotal) * 100
    if (completionRate < 20) {
      alerts.push(`Taux de completion faible : ${Math.round(completionRate)}% des interventions cloturees`)
    }
  }

  // Alerte si beaucoup d'interventions dans un statut de blocage
  const checkCount = byStatusLabel['Check'] ?? 0
  if (checkCount > 0) {
    alerts.push(`${checkCount} intervention(s) en statut Check (date prevue depassee)`)
  }

  // Alerte si aucune intervention sur la periode
  if (statsTotal === 0) {
    alerts.push('Aucune intervention trouvee sur cette periode')
  }

  return alerts
}

/**
 * Hook pour collecter les donnees reelles et generer un resume IA.
 *
 * Utilise les APIs stats existantes (getStatsByUser, getMarginStatsByUser)
 * pour construire un AIDataSummary avec les vraies donnees de la periode.
 *
 * @example
 * const { collectSummary, isReady } = useAIDataSummary()
 * const summary = await collectSummary('week')
 */
export function useAIDataSummary() {
  const { data: currentUser } = useCurrentUser()
  const userId = currentUser?.id

  const collectSummary = useCallback(async (period: SummaryPeriod): Promise<AIDataSummary> => {
    if (!userId) {
      throw new Error('Utilisateur non connecte')
    }

    const { startDate, endDate, label } = getPeriodDates(period)

    // Appeler les APIs stats en parallele
    const [statsResult, marginResult] = await Promise.all([
      interventionsApi.getStatsByUser(userId, startDate, endDate),
      interventionsApi.getMarginStatsByUser(userId, startDate, endDate),
    ])

    // Extraire le nombre de completees depuis les stats par statut
    const completedCount =
      (statsResult.by_status['INTER_TERMINEE'] ?? 0) +
      (statsResult.by_status['INTER_FACTUREE'] ?? 0)

    // Extraire le nombre de creees (statut DEMANDE ou total si pas de distinction)
    const createdCount = statsResult.by_status['DEMANDE'] ?? statsResult.total

    // Detecter les alertes
    const alerts = detectAlerts(
      statsResult.total,
      statsResult.by_status_label,
      marginResult.average_margin_percentage,
      completedCount,
    )

    return {
      period: { label, startDate, endDate },
      interventions: {
        total: statsResult.total,
        byStatus: statsResult.by_status_label,
        created: createdCount,
        completed: completedCount,
      },
      financial: {
        totalRevenue: marginResult.total_revenue,
        totalCosts: marginResult.total_costs,
        totalMargin: marginResult.total_margin,
        averageMarginPercent: marginResult.average_margin_percentage,
      },
      alerts,
    }
  }, [userId])

  return {
    collectSummary,
    isReady: !!userId,
  }
}
