import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sparkline } from "./Sparkline"

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
    label?: string
  }
  sparklineData?: Array<{ date: string; value: number }>
  className?: string
  description?: string
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  sparklineData,
  className,
  description
}: KPICardProps) {
  return (
    <Card className={cn("overflow-hidden border-l-4", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <p className={cn(
                "text-xs font-medium mt-1 flex items-center",
                trend.isPositive ? "text-emerald-600" : "text-rose-600"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
                <span className="text-muted-foreground ml-1 font-normal">
                  {trend.label || "vs période précédente"}
                </span>
              </p>
            )}
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-[40px] w-[80px]">
              <Sparkline
                data={sparklineData}
                color={trend?.isPositive ? "#10b981" : "#f43f5e"}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}




