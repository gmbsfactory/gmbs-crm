"use client"

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    Cell
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMetierColor } from "@/config/metier-colors"

interface BarData {
    name: string
    value: number
}

interface HorizontalBarChartProps {
    data: BarData[]
    title?: string
    description?: string
    color?: string // Kept for backward compatibility but overridden by metier colors
}

export function HorizontalBarChart({
    data,
    title = "Répartition",
    description,
    color = "#3b82f6"
}: HorizontalBarChartProps) {

    if (!data || data.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    {description && <CardDescription>{description}</CardDescription>}
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                </CardContent>
            </Card>
        )
    }

    // Sort data descending
    const sortedData = [...data].sort((a, b) => b.value - a.value).slice(0, 10)

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={sortedData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 12, fill: "#ffffff" }}
                                interval={0}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-bold mb-1" style={{ color: getMetierColor(null, data.name) }}>
                                                        {data.name}
                                                    </span>
                                                    <span className="text-sm">
                                                        {payload[0].value} interventions
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                {sortedData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={getMetierColor(null, entry.name)}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
