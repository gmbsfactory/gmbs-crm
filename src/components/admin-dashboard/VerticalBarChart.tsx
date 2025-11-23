"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart"

interface BarData {
  period: string
  revenue: number
  isProjection: boolean
}

interface VerticalBarChartProps {
  data: BarData[]
  title?: string
  description?: string
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
}

export function VerticalBarChart({
  data,
  title = "Évolution du Chiffre d'Affaires",
  description,
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
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k€`
                  return `${value}€`
                }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as BarData
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
                              {data.isProjection ? "Projection: " : "CA: "}
                              {new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(data.revenue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
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
            <span>Chiffre d'affaires réel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-[hsl(var(--chart-2))] opacity-70" />
            <span>Projection</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

