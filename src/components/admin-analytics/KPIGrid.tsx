"use client"

import { ArrowDownIcon, ArrowUpIcon, DollarSign, Users, Activity, CreditCard, Percent } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsData } from "@/hooks/useAnalyticsData"

interface KPIGridProps {
    data: AnalyticsData["kpis"] | undefined
    isLoading: boolean
}

export function KPIGrid({ data, isLoading }: KPIGridProps) {
    if (isLoading || !data) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="h-4 w-24 bg-muted rounded" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-32 bg-muted rounded mb-2" />
                            <div className="h-4 w-16 bg-muted rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    const kpis = [
        {
            title: "Chiffre d'affaires",
            value: `${(data.revenue / 1000).toFixed(0)}k €`,
            growth: data.revenueGrowth,
            icon: DollarSign,
            format: "currency",
        },
        {
            title: "Marge Nette",
            value: `${(data.margin / 1000).toFixed(0)}k €`,
            growth: data.marginGrowth,
            icon: Activity,
            format: "currency",
        },
        {
            title: "CAC",
            value: `${data.cac} €`,
            growth: data.cacGrowth,
            inverse: true, // Lower is better
            icon: Users,
            format: "currency",
        },
        {
            title: "LTV",
            value: `${data.ltv} €`,
            growth: data.ltvGrowth,
            icon: CreditCard,
            format: "currency",
        },
        {
            title: "Taux de Churn",
            value: `${(data.churn * 100).toFixed(1)}%`,
            growth: data.churnGrowth,
            inverse: true,
            icon: Percent,
            format: "percent",
        },
        {
            title: "Panier Moyen",
            value: `${data.avgBasket} €`,
            growth: 2.1, // Mock growth
            icon: DollarSign,
            format: "currency",
        },
        {
            title: "Taux de Win",
            value: `${(data.winRate * 100).toFixed(1)}%`,
            growth: 1.5,
            icon: Activity,
            format: "percent",
        },
        {
            title: "Deals Actifs",
            value: data.dealCount.toString(),
            growth: 5,
            icon: Users,
            format: "number",
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi, index) => {
                const isPositive = kpi.growth >= 0
                const isGood = kpi.inverse ? !isPositive : isPositive

                return (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {kpi.title}
                            </CardTitle>
                            <kpi.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                {isPositive ? (
                                    <ArrowUpIcon className={`mr-1 h-4 w-4 ${isGood ? "text-green-500" : "text-red-500"}`} />
                                ) : (
                                    <ArrowDownIcon className={`mr-1 h-4 w-4 ${isGood ? "text-green-500" : "text-red-500"}`} />
                                )}
                                <span className={isGood ? "text-green-500" : "text-red-500"}>
                                    {Math.abs(kpi.growth)}%
                                </span>
                                <span className="ml-1">vs mois dernier</span>
                            </p>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
