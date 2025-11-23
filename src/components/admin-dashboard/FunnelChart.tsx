"use client"

import {
    Funnel,
    FunnelChart as RechartsFunnelChart,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    Cell
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface FunnelStep {
    name: string
    value: number
    fill: string
    cycleTime?: string // e.g., "2j"
}

interface FunnelChartProps {
    data: FunnelStep[]
    title?: string
    description?: string
}

export function FunnelChart({ data, title = "Flux d'Interventions", description = "Conversion et temps de cycle" }: FunnelChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                </CardContent>
            </Card>
        )
    }

    // Filter out steps with 0 value to avoid rendering issues in Funnel
    // but keep them if you want to show 0 conversion? 
    // Recharts Funnel might look weird with 0 width. 
    // Let's keep them but ensure they don't break the chart.

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsFunnelChart>
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    <span className="font-bold col-span-2 border-b pb-1 mb-1">{data.name}</span>

                                                    <span className="text-muted-foreground text-sm">Volume:</span>
                                                    <span className="text-right font-medium">{data.value}</span>

                                                    {data.cycleTime && (
                                                        <>
                                                            <span className="text-muted-foreground text-sm">Délai moyen:</span>
                                                            <span className="text-right font-medium">{data.cycleTime}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Funnel
                                dataKey="value"
                                data={data}
                                isAnimationActive
                            >
                                <LabelList
                                    position="right"
                                    fill="#000"
                                    stroke="none"
                                    dataKey="name"
                                    className="fill-foreground text-sm font-medium"
                                />
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Funnel>
                        </RechartsFunnelChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
