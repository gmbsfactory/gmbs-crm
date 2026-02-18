"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ComposedChart,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

interface WeeklyDay {
  day: string
  screenTime: number
  actions: number
}

interface WeeklyMiniChartProps {
  data: WeeklyDay[]
}

const chartConfig: ChartConfig = {
  screenTime: {
    label: "Temps ecran",
    color: "hsl(var(--chart-1))",
  },
  actions: {
    label: "Actions",
    color: "hsl(var(--chart-2))",
  },
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const screenTime = payload.find((p) => p.dataKey === "screenTime")?.value ?? 0
  const actions = payload.find((p) => p.dataKey === "actions")?.value ?? 0
  const hours = Math.floor(screenTime)
  const mins = Math.round((screenTime - hours) * 60)
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Temps : {hours > 0 ? `${hours}h ${mins.toString().padStart(2, "0")}min` : `${mins}min`}
      </p>
      <p className="text-xs text-muted-foreground">
        Actions : {actions}
      </p>
    </div>
  )
}

export function WeeklyMiniChart({ data }: WeeklyMiniChartProps) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
      <ComposedChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="fillScreenTime" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}h`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="screenTime"
          stroke="hsl(var(--chart-1))"
          fill="url(#fillScreenTime)"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="actions"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={{ r: 3, fill: "hsl(var(--chart-2))" }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
