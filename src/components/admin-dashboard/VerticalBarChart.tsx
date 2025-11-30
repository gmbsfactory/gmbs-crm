"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart"

interface BarData {
  period: string
  revenue?: number
  value?: number
  demandees?: number
  terminees?: number
  isProjection: boolean
}

interface VerticalBarChartProps {
  data: BarData[]
  title?: string
  description?: string
  multiSeries?: boolean
  valueFormatter?: (value: number) => string
  legendLabels?: {
    series1?: string
    series2?: string
    projection?: string
  }
}

const chartConfig: ChartConfig = {
  revenue: {
    label: "Chiffre d'affaires",
    color: "hsl(var(--chart-1))",
  },
  projection: {
    label: "Projection",
    color: "hsl(var(--chart-2))",
  },
  demandees: {
    label: "Demandées",
    color: "hsl(var(--chart-1))",
  },
  terminees: {
    label: "Terminées",
    color: "hsl(var(--chart-3))",
  },
  value: {
    label: "Valeur",
    color: "hsl(var(--chart-1))",
  },
}

export function VerticalBarChart({
  data,
  title = "Évolution du Chiffre d'Affaires",
  description,
  multiSeries = false,
  valueFormatter,
  legendLabels,
}: VerticalBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
          Aucune donnée disponible
        </CardContent>
      </Card>
    )
  }

  const defaultFormatter = valueFormatter || ((value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return `${value}`
  })

  if (multiSeries) {
    // Graphique multi-séries (demandées + terminées)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ChartContainer config={chartConfig}>
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12, fill: "#ffffff" }}
                />
                <YAxis tickFormatter={defaultFormatter} tick={{ fill: "#ffffff" }} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as BarData
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-sm">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{data.period}</span>
                            {payload.map((entry, index) => {
                              const value = entry.value as number
                              const label = entry.dataKey === "demandees" 
                                ? legendLabels?.series1 || "Demandées"
                                : entry.dataKey === "terminees"
                                ? legendLabels?.series2 || "Terminées"
                                : entry.name || ""
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-sm">
                                    {label}: {defaultFormatter(value)}
                                  </span>
                                </div>
                              )
                            })}
                            {data.isProjection && (
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                Projection
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar
                  dataKey="demandees"
                  name={legendLabels?.series1 || "Demandées"}
                  radius={[4, 0, 0, 0]}
                  fill="hsl(var(--chart-1))"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-demandees-${index}`}
                      fill="hsl(var(--chart-1))"
                      opacity={entry.isProjection ? 0.7 : 1}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="terminees"
                  name={legendLabels?.series2 || "Terminées"}
                  radius={[0, 4, 0, 0]}
                  fill="hsl(var(--chart-3))"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-terminees-${index}`}
                      fill="hsl(var(--chart-3))"
                      opacity={entry.isProjection ? 0.7 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-[hsl(var(--chart-1))]" />
              <span>{legendLabels?.series1 || "Demandées"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-[hsl(var(--chart-3))]" />
              <span>{legendLabels?.series2 || "Terminées"}</span>
            </div>
            {data.some((d) => d.isProjection) && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-gray-400 opacity-70" />
                <span className="italic">{legendLabels?.projection || "Projection"}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Graphique simple (une seule série)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ChartContainer config={chartConfig}>
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickFormatter={defaultFormatter} />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as BarData
                    const value = data.revenue ?? data.value ?? 0
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">{data.period}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: data.isProjection
                                  ? "hsl(var(--chart-2))"
                                  : "hsl(var(--chart-1))",
                              }}
                            />
                            <span className="text-sm">
                              {data.isProjection
                                ? `${legendLabels?.projection || "Projection"}: `
                                : ""}
                              {valueFormatter
                                ? valueFormatter(value)
                                : new Intl.NumberFormat("fr-FR", {
                                    style: "currency",
                                    currency: "EUR",
                                  }).format(value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey={data[0]?.revenue !== undefined ? "revenue" : "value"} radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isProjection
                        ? "hsl(var(--chart-2))"
                        : "hsl(var(--chart-1))"
                    }
                    opacity={entry.isProjection ? 0.7 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-[hsl(var(--chart-1))]" />
            <span>{legendLabels?.series1 || "Valeur réelle"}</span>
          </div>
          {data.some((d) => d.isProjection) && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-[hsl(var(--chart-2))] opacity-70" />
              <span>{legendLabels?.projection || "Projection"}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

