"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionsApi, usersApi } from "@/lib/api/v2"
import type { MarginStats, TargetPeriodType } from "@/lib/api/v2"
import Loader from "@/components/ui/Loader"
import { Speedometer } from "./speedometer"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardMargin } from "@/hooks/useDashboardStats"

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

    // Charger l'objectif et les préférences pour l'utilisateur et la période
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
                    setMarginTarget(targetData?.margin_target || DEFAULT_TARGET)
                    setShowPercentage(preferences?.speedometer_margin_total_show_percentage ?? true)
                }
            } catch (err: any) {
                // Si erreur, utiliser les valeurs par défaut
                if (!cancelled) {
                    setMarginTarget(DEFAULT_TARGET)
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
                        <CardTitle className="text-sm text-muted-foreground">Marge totale</CardTitle>
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
                        <CardTitle className="text-sm text-muted-foreground">Marge totale</CardTitle>
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
                        <CardTitle className="text-sm text-muted-foreground">Marge totale</CardTitle>
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

        return (
            <Card className="bg-background border-border/5 shadow-sm/30">
                {!compact && (
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Marge totale</CardTitle>
                    </CardHeader>
                )}
                <CardContent className={compact ? "px-3 py-3 flex flex-col gap-1" : undefined}>
                    <div className={compact ? "space-y-2" : "space-y-4"}>
                        {/* Cadran de vitesse */}
                        <div className="flex flex-col items-center py-2">
                            <Speedometer
                                value={0}
                                max={marginTarget}
                                size={140}
                                strokeWidth={14}
                                label={formatCurrency(0)}
                                showPercentage={showPercentage}
                                onContextMenu={async (e) => {
                                    e.preventDefault()
                                    const newValue = !showPercentage
                                    setShowPercentage(newValue)
                                    if (userId) {
                                        try {
                                            await usersApi.updateUserPreferences(userId, {
                                                speedometer_margin_total_show_percentage: newValue,
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
                                <div className="text-lg font-bold text-muted-foreground">
                                    {formatCurrency(0)}
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

    // Calculer le pourcentage de l'objectif
    const percentage = marginTarget > 0 
        ? Math.min(Math.abs(stats.total_margin) / marginTarget * 100, 100)
        : 0
    
    // Calculer le pourcentage réel affiché dans le speedometer
    const speedometerPercentage = Math.min(Math.max(percentage, 0), 100)
    
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
                    <CardTitle className="text-sm text-muted-foreground">Marge totale</CardTitle>
                </CardHeader>
            )}
            <CardContent className={compact ? "px-3 py-3 flex flex-col gap-1" : undefined}>
                <div className={compact ? "space-y-2" : "space-y-4"}>
                    {/* Cadran de vitesse */}
                    <div className="flex flex-col items-center py-2">
                        <Speedometer
                            value={Math.abs(stats.total_margin)}
                            max={marginTarget}
                            size={140}
                            strokeWidth={14}
                            label={`${formatCurrency(stats.total_margin)}`}
                            showPercentage={showPercentage}
                            onContextMenu={async (e) => {
                                e.preventDefault()
                                const newValue = !showPercentage
                                setShowPercentage(newValue)
                                if (userId) {
                                    try {
                                        await usersApi.updateUserPreferences(userId, {
                                            speedometer_margin_total_show_percentage: newValue,
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
                            <div className={`text-lg font-bold ${percentageColor}`}>
                                {formatCurrency(stats.total_margin)}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-light tracking-wide">
                                Objectif: {formatCurrency(marginTarget)}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
