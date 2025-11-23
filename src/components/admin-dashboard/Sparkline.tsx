"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"
import { useTheme } from "next-themes"

interface SparklineProps {
    data: { date: string; value: number }[]
    color?: string
    height?: number
}

export function Sparkline({ data, color, height = 50 }: SparklineProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    // Default color if not provided
    const strokeColor = color || (isDark ? "#3b82f6" : "#2563eb")

    if (!data || data.length === 0) return null

    return (
        <div style={{ height, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                Valeur
                                            </span>
                                            <span className="font-bold text-muted-foreground">
                                                {payload[0].value}
                                            </span>
                                        </div>
                                    </div>
                                )
                            }
                            return null
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={strokeColor}
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
