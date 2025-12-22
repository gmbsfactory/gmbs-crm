"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionsApi, usersApi } from "@/lib/api/v2"
import type { MarginStats, TargetPeriodType } from "@/lib/api/v2"
import { TrendingUp, TrendingDown } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { Speedometer } from "./speedometer"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardMargin } from "@/hooks/useDashboardStats"

interface MarginStatsCardProps {
  period?: {
    startDate?: string
    endDate?: string
  }
  userId?: string | null
  compact?: boolean
}

// Objectif par défaut si aucun objectif n'est défini
const DEFAULT_PERFORMANCE_TARGET = 100 // 100% par défaut

// Helper pour déterminer le type de période à partir des dates
function getPeriodTypeFromDates(startDate?: string, endDate?: string): TargetPeriodType {
  if (!startDate || !endDate) return "month"
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 7) return "week"
  if (diffDays <= 35) return "month"
  return "year"
}

export function MarginStatsCard({ period, userId: propUserId, compact = false }: MarginStatsCardProps) {
  const [performanceTarget, setPerformanceTarget] = useState<number>(DEFAULT_PERFORMANCE_TARGET)
  const [showPercentage, setShowPercentage] = useState<boolean>(true)

  // Déterminer le type de période
  const periodType = useMemo(() => {
    return getPeriodTypeFromDates(period?.startDate, period?.endDate)
  }, [period?.startDate, period?.endDate])

  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  // Utiliser le prop userId s'il est fourni, sinon utiliser currentUser
  const userId = propUserId ?? currentUser?.id ?? null

  // Normaliser period pour correspondre au type attendu par useDashboardMargin
  const normalizedPeriod = period?.startDate && period?.endDate
    ? { startDate: period.startDate, endDate: period.endDate }
    : null

  // Utiliser TanStack Query pour charger les stats de marge (cache partagé et déduplication automatique)
  const { data: stats, isLoading: loading, error: queryError } = useDashboardMargin(normalizedPeriod, userId)
  const error = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null

  // Charger l'objectif de performance et les préférences pour l'utilisateur et la période
  useEffect(() => {
    if (!userId || isLoadingUser) return

    let cancelled = false

    const loadTargetAndPreferences = async () => {
      try {
        const [targetData, preferences] = await Promise.all([
          usersApi.getTargetByUserAndPeriod(userId, periodType),
          usersApi.getUserPreferences(userId),
        ])
        
        if (!cancelled) {
          setPerformanceTarget(targetData?.performance_target || DEFAULT_PERFORMANCE_TARGET)
          setShowPercentage(preferences?.speedometer_margin_average_show_percentage ?? true)
        }
      } catch (err: any) {
        // Si erreur, utiliser les valeurs par défaut
        if (!cancelled) {
          setPerformanceTarget(DEFAULT_PERFORMANCE_TARGET)
          setShowPercentage(true)
        }
      }
    }

    loadTargetAndPreferences()

    return () => {
      cancelled = true
    }
  }, [userId, isLoadingUser, periodType])

  if (loading) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        {!compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marge moyenne</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "px-3 pb-0 pt-0" : undefined}>
          <div className="flex items-center justify-center">
            <div style={{ transform: 'scale(1.25)' }}>
              <Loader />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        {!compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marge moyenne</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "px-3 pb-0 pt-0" : undefined}>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!userId) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        {!compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marge moyenne</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "px-3 pb-0 pt-0" : undefined}>
          <p className="text-sm text-muted-foreground">
            Veuillez vous connecter pour voir vos statistiques
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!stats || stats.total_interventions === 0) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        {!compact && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Marge moyenne</CardTitle>
          </CardHeader>
        )}
        <CardContent className={compact ? "px-3 py-3 flex flex-col gap-1" : undefined}>
          <div className={compact ? "space-y-2" : "space-y-4"}>
            {/* Cadran de vitesse */}
            <div className="flex flex-col items-center py-2">
              <Speedometer
                value={0}
                max={performanceTarget}
                size={140}
                strokeWidth={14}
                label="0%"
                showPercentage={showPercentage}
                onContextMenu={async (e) => {
                  e.preventDefault()
                  const newValue = !showPercentage
                  setShowPercentage(newValue)
                  if (userId) {
                    try {
                      await usersApi.updateUserPreferences(userId, {
                        speedometer_margin_average_show_percentage: newValue,
                      })
                    } catch (err) {
                      console.error("Erreur lors de la mise à jour des préférences:", err)
                      // Revert on error
                      setShowPercentage(!newValue)
                    }
                  }
                }}
              />
            </div>

            {/* Informations */}
            <div className={compact ? "space-y-1 mt-1" : "space-y-1 mt-2"}>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-muted-foreground">
                    0%
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-light tracking-wide">
                  Aucune intervention avec coûts
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Gérer les cas extrêmes de pourcentage
  const isExtreme = Math.abs(stats.average_margin_percentage) >= 1000
  const displayPercentage = isExtreme 
    ? (stats.average_margin_percentage < 0 ? "< -1000%" : "> 1000%")
    : `${stats.average_margin_percentage.toFixed(2)}%`
  
  const TrendIcon = stats.average_margin_percentage >= 0 ? TrendingUp : TrendingDown
  
  // Calculer le pourcentage par rapport à l'objectif
  const percentageOfTarget = performanceTarget > 0 
    ? Math.min(Math.abs(stats.average_margin_percentage) / performanceTarget * 100, 100)
    : 0
  
  // Calculer le pourcentage réel affiché dans le speedometer (basé sur l'objectif)
  const speedometerPercentage = Math.min(Math.max(percentageOfTarget, 0), 100)
  
  // Déterminer la couleur basée sur le pourcentage du speedometer (cohérent avec l'aiguille)
  const getPercentageColor = () => {
    if (speedometerPercentage >= 95) return "text-purple-500 dark:text-purple-400"
    if (speedometerPercentage >= 90) return "text-green-600 dark:text-green-400"
    if (speedometerPercentage >= 75) return "text-green-600 dark:text-green-400"
    if (speedometerPercentage >= 50) return "text-yellow-600 dark:text-yellow-400"
    if (speedometerPercentage >= 25) return "text-orange-600 dark:text-orange-400"
    return "text-red-600 dark:text-red-400"
  }
  
  const percentageColor = getPercentageColor()

  return (
    <Card className="bg-background border-border/5 shadow-sm/30">
      {!compact && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Marge moyenne</CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "px-3 py-3 flex flex-col gap-1" : undefined}>
        <div className={compact ? "space-y-2" : "space-y-4"}>
          {/* Cadran de vitesse */}
          <div className="flex flex-col items-center py-2">
            <Speedometer
              value={Math.abs(stats.average_margin_percentage)}
              max={performanceTarget}
              size={140}
              strokeWidth={14}
              label={displayPercentage}
              showPercentage={showPercentage}
              onContextMenu={async (e) => {
                e.preventDefault()
                const newValue = !showPercentage
                setShowPercentage(newValue)
                if (userId) {
                  try {
                    await usersApi.updateUserPreferences(userId, {
                      speedometer_margin_average_show_percentage: newValue,
                    })
                  } catch (err) {
                    console.error("Erreur lors de la mise à jour des préférences:", err)
                    // Revert on error
                    setShowPercentage(!newValue)
                  }
                }
              }}
            />
          </div>

          {/* Informations */}
          <div className={compact ? "space-y-1 mt-1" : "space-y-1 mt-2"}>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <TrendIcon className={`h-4 w-4 ${percentageColor}`} />
                <div className={`text-lg font-bold ${percentageColor}`}>
                  {displayPercentage}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-light tracking-wide">
                Objectif: {performanceTarget}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

