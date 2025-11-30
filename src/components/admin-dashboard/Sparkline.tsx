"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts"
import { useTheme } from "next-themes"

interface SparklineProps {
    data: { date: string; value: number }[]
    color?: string
    height?: number
    showCurrency?: boolean
}

export function Sparkline({ data, color, height = 50, showCurrency = false }: SparklineProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    // Default color if not provided
    const strokeColor = color || (isDark ? "#3b82f6" : "#2563eb")

    if (!data || data.length === 0) return null

    // Fonction pour formater la date
    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            })
        } catch {
            return dateString
        }
    }

    return (
        <div style={{ height, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <Tooltip
                        offset={10}
                        allowEscapeViewBox={{ x: true, y: true }}
                        wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const dataPoint = payload[0].payload
                                const value = payload[0].value as number
                                const date = dataPoint?.date || label
                                
                                // Calculer le style de positionnement dynamique
                                const tooltipStyle: React.CSSProperties = {
                                    transform: "translateX(-50%)"
                                }
                                
                                return (
                                    <div 
                                        className="rounded-lg border bg-background p-2 shadow-sm"
                                        style={tooltipStyle}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-bold text-muted-foreground">
                                                {value.toLocaleString('fr-FR', { 
                                                    minimumFractionDigits: 0, 
                                                    maximumFractionDigits: 2 
                                                })}
                                                {showCurrency && ' €'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(date)}
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
