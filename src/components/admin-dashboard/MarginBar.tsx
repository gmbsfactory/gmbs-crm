"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface MarginBarProps {
    value: number // Percentage (0-100)
    target?: number
    critical?: number
    className?: string
}

export function MarginBar({
    value,
    target = 25,
    critical = 20,
    className
}: MarginBarProps) {
    // Ensure value is a number
    const safeValue = typeof value === 'number' ? value : 0

    // Determine color based on thresholds
    let colorClass = "bg-green-500"
    if (safeValue < critical) {
        colorClass = "bg-red-500"
    } else if (safeValue < target) {
        colorClass = "bg-yellow-500"
    }

    return (
        <div className={cn("w-full flex items-center gap-2", className)}>
            <span className={cn(
                "text-xs font-medium w-12 text-right",
                safeValue < critical ? "text-red-600 font-bold" :
                    safeValue < target ? "text-yellow-600" : "text-green-600"
            )}>
                {safeValue.toFixed(1)}%
            </span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                    className={cn("h-full transition-all", colorClass)}
                    style={{ width: `${Math.min(100, Math.max(0, safeValue))}%` }}
                />
            </div>
        </div>
    )
}
