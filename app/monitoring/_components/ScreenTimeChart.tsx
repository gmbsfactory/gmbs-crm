"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

interface PageStat {
  page_name: string
  total_duration_ms: number
  visit_count: number
}

interface ScreenTimeChartProps {
  pages: PageStat[]
}

const PAGE_COLORS: Record<string, string> = {
  interventions: "hsl(var(--chart-1))",
  artisans: "hsl(var(--chart-2))",
  comptabilite: "hsl(var(--chart-3))",
  dashboard: "hsl(var(--chart-4))",
}

const DEFAULT_COLOR = "hsl(var(--chart-5))"

function formatDurationShort(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`
  return `${minutes}min`
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const chartConfig: ChartConfig = {
  duration: {
    label: "Temps",
    color: "hsl(var(--chart-1))",
  },
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { page_name: string; total_duration_ms: number; visit_count: number } }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{capitalizeFirst(data.page_name)}</p>
      <p className="text-xs text-muted-foreground">
        {formatDurationShort(data.total_duration_ms)}
      </p>
      <p className="text-xs text-muted-foreground">
        {data.visit_count} visite{data.visit_count > 1 ? "s" : ""}
      </p>
    </div>
  )
}

export function ScreenTimeChart({ pages }: ScreenTimeChartProps) {
  const chartData = pages
    .sort((a, b) => b.total_duration_ms - a.total_duration_ms)
    .map((p) => ({
      ...p,
      name: capitalizeFirst(p.page_name),
      minutes: Math.round(p.total_duration_ms / 60000),
    }))

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${v}min`}
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {chartData.map((entry) => (
            <Cell
              key={entry.page_name}
              fill={PAGE_COLORS[entry.page_name] ?? DEFAULT_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
