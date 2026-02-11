/**
 * Composant badge overlay pour afficher les modifications distantes
 * Affiche un badge coloré lorsque d'autres utilisateurs modifient une intervention
 */

"use client"

import React, { useEffect, useState } from 'react'
import { getRemoteEditIndicatorManager, type RemoteEditIndicator } from '@/lib/realtime/remote-edit-indicator'
import { cn } from '@/lib/utils'

interface RemoteEditBadgeProps {
  interventionId: string
  className?: string
}

/**
 * Badge overlay affichant les modifications distantes
 * 
 * @example
 * ```tsx
 * <InterventionCard intervention={intervention}>
 *   <RemoteEditBadge interventionId={intervention.id} />
 * </InterventionCard>
 * ```
 */
export function RemoteEditBadge({ interventionId, className }: RemoteEditBadgeProps) {
  const [indicator, setIndicator] = useState<RemoteEditIndicator | undefined>(undefined)
  const indicatorManager = getRemoteEditIndicatorManager()

  useEffect(() => {
    // Vérifier si un indicateur existe pour cette intervention
    const checkIndicator = () => {
      const currentIndicator = indicatorManager.getIndicator(interventionId)
      
      // Log seulement quand un badge est trouvé (événement rare)
      if (currentIndicator && !indicator) {
      }
      
      setIndicator(currentIndicator)
    }

    // Vérifier immédiatement
    checkIndicator()

    // 🚀 OPTIMISATION: Vérifier toutes les 2000ms au lieu de 500ms (réduit charge CPU de 75%)
    const interval = setInterval(checkIndicator, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [interventionId, indicatorManager, indicator])

  if (!indicator) {
    return null
  }

  const badgeColor = indicator.userColor || '#666666'

  return (
    <div
      className={cn(
        "absolute z-50 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium shadow-lg",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className || "top-2 right-2"
      )}
      style={{
        backgroundColor: badgeColor,
        color: '#ffffff',
        border: `1px solid ${badgeColor}`,
        pointerEvents: 'none', // Ne pas bloquer les clics sur la ligne
      }}
      title={`Modifié par ${indicator.userName || 'un autre utilisateur'}`}
    >
      <div className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />
      <span className="text-[10px] leading-none">
        {indicator.userName || 'Modifié'}
      </span>
    </div>
  )
}

