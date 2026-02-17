"use client"

import { cn } from "@/lib/utils"
import type { ConnectionStatus } from "@/hooks/useCrmRealtime"

interface RealtimeStatusDotProps {
  status: ConnectionStatus
  className?: string
}

const statusConfig: Record<ConnectionStatus, { color: string; label: string; pulse: boolean }> = {
  realtime: { color: "bg-emerald-500", label: "Connecte", pulse: true },
  connecting: { color: "bg-yellow-500", label: "Connexion...", pulse: true },
  polling: { color: "bg-red-500", label: "Mode degrade", pulse: false },
}

export function RealtimeStatusDot({ status, className }: RealtimeStatusDotProps) {
  const config = statusConfig[status]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", config.color)} />
      </span>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  )
}
