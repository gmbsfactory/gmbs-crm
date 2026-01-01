"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { usersApi } from "@/lib/api/v2"
import type { TargetPeriodType } from "@/lib/api/v2"
import Loader from "@/components/ui/Loader"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardMargin } from "@/hooks/useDashboardStats"
import { cn } from "@/lib/utils"
import { parseISO } from "date-fns"

interface MarginTotalCardProps {
    period?: {
        startDate?: string
        endDate?: string
    }
    userId?: string | null
    compact?: boolean
}

// Objectif par défaut si aucun objectif n'est défini
const DEFAULT_TARGET = 10000 // 10 000 € par défaut

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

export function MarginTotalCard({ period, userId: propUserId, compact = false }: MarginTotalCardProps) {
    const [marginTarget, setMarginTarget] = useState<number>(DEFAULT_TARGET)

    // Déterminer le type de période
    const periodType = useMemo(() => {
        return getPeriodTypeFromDates(period?.startDate, period?.endDate)
    }, [period?.startDate, period?.endDate])

    // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
    const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
    // Utiliser le prop userId s'il est fourni, sinon utiliser currentUser
    const userId = propUserId ?? currentUser?.id ?? null

    // Normaliser period pour correspondre au type attendu par useDashboardMargin
    const normalizedPeriod = useMemo(() =>
        period?.startDate && period?.endDate
            ? { startDate: period.startDate, endDate: period.endDate }
            : null,
        [period?.startDate, period?.endDate]
    )

    // Calculer la période précédente pour la tendance
    const previousPeriod = useMemo(() => {
        if (!period?.startDate || !period?.endDate) return null

        try {
            const start = parseISO(period.startDate)
            const end = parseISO(period.endDate)

            // Calculer la durée de la période actuelle
            const duration = end.getTime() - start.getTime()

            // Soustraire la durée de la date de début pour obtenir la nouvelle date de début
            const prevStart = new Date(start.getTime() - duration)
            // Soustraire la durée de la date de fin pour obtenir la nouvelle date de fin
            const prevEnd = new Date(end.getTime() - duration)

            return {
                startDate: prevStart.toISOString(),
                endDate: prevEnd.toISOString()
            }
        } catch (e) {
            console.error("Error calculating previous period:", e)
            return null
        }
    }, [period?.startDate, period?.endDate])

    // Utiliser TanStack Query pour charger les stats de marge (cache partagé et déduplication automatique)
    const { data: stats, isLoading: loading } = useDashboardMargin(normalizedPeriod, userId)
    const { data: prevStats } = useDashboardMargin(previousPeriod, userId)

    // Charger l'objectif pour l'utilisateur et la période
    useEffect(() => {
        if (!userId || isLoadingUser) return

        let cancelled = false

        const loadTarget = async () => {
            try {
                const targetData = await usersApi.getTargetByUserAndPeriod(userId, periodType)
                if (!cancelled) {
                    setMarginTarget(targetData?.margin_target || DEFAULT_TARGET)
                }
            } catch (err: any) {
                if (!cancelled) {
                    setMarginTarget(DEFAULT_TARGET)
                }
            }
        }

        loadTarget()

        return () => {
            cancelled = true
        }
    }, [userId, isLoadingUser, periodType])

    if (loading) {
        return (
            <Card className="h-full bg-background border-border/5 shadow-sm/30">
                <CardContent className="h-full flex items-center justify-center p-4">
                    <Loader />
                </CardContent>
            </Card>
        )
    }

    const currentVal = stats?.total_margin || 0
    const prevVal = prevStats?.total_margin || 0

    // Calculer la tendance
    const trend = prevVal !== 0 ? ((currentVal - prevVal) / Math.abs(prevVal)) * 100 : null

    const formatCurrency = (amount: number) => {
        const absAmount = Math.abs(amount)
        const formatted = new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(absAmount)
        return amount < 0 ? `-${formatted}` : formatted
    }

    const getValueColor = (val: number) => {
        const perf = marginTarget > 0 ? (val / marginTarget) * 100 : 0
        if (perf >= 90) return "text-purple-600 dark:text-purple-400"
        if (perf >= 70) return "text-green-600 dark:text-green-400"
        if (perf >= 40) return "text-yellow-600 dark:text-yellow-400"
        return "text-red-600 dark:text-red-400"
    }

    return (
        <Card className="h-full bg-background border-border/5 shadow-sm/30 overflow-hidden">
            <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Marge Totale</span>
                    {trend !== null && (
                        <div className={cn(
                            "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            trend >= 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                        )}>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex items-center justify-center py-2">
                    <span className={cn("text-4xl font-black tracking-tighter", getValueColor(currentVal))}>
                        {formatCurrency(currentVal)}
                    </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/5 pt-2 mt-2">
                    {prevStats && stats?.total_interventions !== 0 && (
                        <span className="ml-auto">{currentVal - prevVal >= 0 ? "📈" : "📉"} vs préc: {formatCurrency(prevVal)}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
