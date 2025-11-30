"use client"

import { useMemo } from "react"
import {
    Funnel,
    FunnelChart as RechartsFunnelChart,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    Cell
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getConversionRateColor, isCriticalConversionRate, findBottleneckIndex } from "@/config/dashboard-colors"

interface FunnelStep {
    name: string
    value: number
    fill: string
    conversionRate?: number | null
    cycleTime?: string // e.g., "2j"
    ca?: number // Chiffre d'affaires
    marge?: number // Marge globale
}

interface FunnelChartProps {
    data: FunnelStep[]
    title?: string
    description?: string
}

export function FunnelChart({ data, title = "Flux d'Interventions", description = "Conversion et temps de cycle" }: FunnelChartProps) {
    // Calculer l'index du goulot d'étranglement
    const bottleneckIndex = useMemo(() => findBottleneckIndex(data), [data])

    if (!data || data.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="h-[340px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-1">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    {/* Légende des couleurs */}
                    <div className="text-xs space-y-1 ml-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }}></div>
                            <span className="text-muted-foreground">≥85%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                            <span className="text-muted-foreground">70-84%</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
                            <span className="text-muted-foreground">&lt;70%</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsFunnelChart>
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const step = payload[0].payload
                                        const index = data.findIndex(d => d.name === step.name)
                                        const isBottleneck = index === bottleneckIndex
                                        const isCritical = isCriticalConversionRate(step.conversionRate)

                                        return (
                                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    <span className="font-bold col-span-2 border-b pb-2 mb-1">
                                                        {step.name}
                                                        {isBottleneck && <span className="ml-2 text-red-500">⚠️ Goulot</span>}
                                                    </span>

                                                    <span className="text-muted-foreground text-sm">Volume:</span>
                                                    <span className="text-right font-medium">{step.value}</span>

                                                    {step.conversionRate !== null && step.conversionRate !== undefined && (
                                                        <>
                                                            <span className="text-muted-foreground text-sm">Taux conversion:</span>
                                                            <span
                                                                className="text-right font-bold"
                                                                style={{ color: getConversionRateColor(step.conversionRate) }}
                                                            >
                                                                {step.conversionRate.toFixed(1)}%
                                                            </span>
                                                        </>
                                                    )}

                                                    {isCritical && (
                                                        <span className="col-span-2 text-red-500 text-xs mt-1">
                                                            ⚠️ Taux critique - Goulot d'étranglement potentiel
                                                        </span>
                                                    )}

                                                    {step.cycleTime && (
                                                        <>
                                                            <span className="text-muted-foreground text-sm">Délai moyen:</span>
                                                            <span className="text-right font-medium">{step.cycleTime}</span>
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
                                {/* Badges de taux de conversion */}
                                <LabelList
                                    position="insideRight"
                                    content={(props: any) => {
                                        const { x, y, width, height, index } = props
                                        const step = data[index]

                                        if (step.conversionRate === null || step.conversionRate === undefined) {
                                            return null
                                        }

                                        const isBottleneck = index === bottleneckIndex
                                        const color = getConversionRateColor(step.conversionRate)
                                        const badgeWidth = isBottleneck ? 70 : 60

                                        return (
                                            <g>
                                                <rect
                                                    x={x + width - badgeWidth - 5}
                                                    y={y + height/2 - 12}
                                                    width={badgeWidth}
                                                    height={24}
                                                    fill={color}
                                                    rx={4}
                                                    opacity={0.95}
                                                />
                                                <text
                                                    x={x + width - badgeWidth/2 - 5}
                                                    y={y + height/2 + 5}
                                                    textAnchor="middle"
                                                    className="fill-white text-xs font-bold"
                                                >
                                                    {isBottleneck && '⚠️ '}
                                                    {step.conversionRate.toFixed(1)}%
                                                </text>
                                            </g>
                                        )
                                    }}
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
