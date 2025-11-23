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
                <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <Tooltip
                        offset={10}
                        allowEscapeViewBox={{ x: true, y: true }}
                        wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                        content={({ active, payload, coordinate, viewBox }) => {
                            if (active && payload && payload.length) {
                                // Calculer le style de positionnement dynamique
                                const tooltipStyle: React.CSSProperties = {}
                                
                                if (coordinate && viewBox && viewBox.width) {
                                    const relativePosition = coordinate.x / viewBox.width
                                    // Si proche du bord droit (> 70%), aligner le tooltip à droite
                                    if (relativePosition > 0.7) {
                                        tooltipStyle.transform = "translateX(-100%)"
                                    } else {
                                        tooltipStyle.transform = "translateX(-50%)"
                                    }
                                } else {
                                    // Par défaut, centrer
                                    tooltipStyle.transform = "translateX(-50%)"
                                }
                                
                                return (
                                    <div 
                                        className="rounded-lg border bg-background p-2 shadow-sm"
                                        style={tooltipStyle}
                                    >
                                        <span className="font-bold text-muted-foreground">
                                            {payload[0].value}
                                        </span>
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
