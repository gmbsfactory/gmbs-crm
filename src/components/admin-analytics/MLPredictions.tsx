"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AnalyticsData } from "@/hooks/useAnalyticsData"

interface MLPredictionsProps {
    data: AnalyticsData["predictions"] | undefined
    isLoading: boolean
}

export function MLPredictions({ data, isLoading }: MLPredictionsProps) {
    if (isLoading || !data) {
        return <div className="h-[300px] w-full animate-pulse bg-muted rounded-xl" />
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        Prévisions de Chiffre d&apos;Affaires
                    </CardTitle>
                    <CardDescription>
                        Projection sur les 6 prochains mois (Intervalle de confiance 95%)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.revenueForecast}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="date" className="text-xs" />
                                <YAxis className="text-xs" tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    formatter={(value) => [`${Number(value).toLocaleString()} €`, undefined]}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="upper"
                                    stroke="none"
                                    fill="url(#colorConfidence)"
                                    fillOpacity={1}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="lower"
                                    stroke="none"
                                    fill="url(#colorConfidence)"
                                    fillOpacity={1}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-3">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Risque de Churn
                    </CardTitle>
                    <CardDescription>Segments à risque élevé détectés par l&apos;IA</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data.churnRisk.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <p className="font-medium">{item.segment}</p>
                                    <p className="text-sm text-muted-foreground">{item.count} clients concernés</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant={item.risk > 0.1 ? "destructive" : "secondary"}>
                                        Risque: {(item.risk * 100).toFixed(0)}%
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">Priorité {index + 1}</span>
                                </div>
                            </div>
                        ))}
                        <div className="pt-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                L&apos;IA analyse les comportements de navigation et l&apos;historique des tickets.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
