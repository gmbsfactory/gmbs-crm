/**
 * Composant pour afficher le statut de connexion Realtime
 * T084: Indicateur de statut de connexion (Realtime vs Polling)
 */

'use client'

import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import type { ConnectionStatus } from '@/hooks/useInterventionsRealtime'

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus
  className?: string
}

const statusConfig = {
  realtime: {
    icon: Wifi,
    label: 'Temps réel',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
  },
  polling: {
    icon: WifiOff,
    label: 'Polling (5s)',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
  },
  connecting: {
    icon: Loader2,
    label: 'Connexion...',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
  },
}

export function ConnectionStatusIndicator({
  status,
  className = '',
}: ConnectionStatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
      title={`Mode de synchronisation: ${config.label}`}
    >
      <Icon
        className={`h-3 w-3 ${status === 'connecting' ? 'animate-spin' : ''}`}
      />
      <span>{config.label}</span>
    </div>
  )
}


