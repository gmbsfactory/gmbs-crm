"use client"

import { Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsData } from "@/hooks/useAnalyticsData"

interface PipelineFunnelProps {
    data: AnalyticsData["pipeline"] | undefined
    isLoading: boolean
}

const FUNNEL_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#22c55e']

export function PipelineFunnel({ data, isLoading }: PipelineFunnelProps) {
    if (isLoading || !data) {
        return <div className="h-[300px] w-full animate-pulse bg-muted rounded-xl" />
    }

    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Pipeline de Conversion</CardTitle>
                <CardDescription>Visualisation du funnel de vente</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip
                                formatter={(value: number, name: string, props: any) => {
                                    if (name === "value") return [`${value.toLocaleString()} €`, "Valeur"]
                                    return [value, name]
                                }}
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                            />
                            <Funnel
                                dataKey="count"
                                data={data}
                                isAnimationActive
                            >
                                <LabelList position="right" fill="#000" stroke="none" dataKey="stage" />
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                                ))}
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
                    {data.map((item, i) => (
                        <div key={i} className="flex flex-col">
                            <span className="font-medium text-foreground">{item.stage}</span>
                            <span>{item.count} deals</span>
                            <span>{(item.value / 1000).toFixed(0)}k €</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
