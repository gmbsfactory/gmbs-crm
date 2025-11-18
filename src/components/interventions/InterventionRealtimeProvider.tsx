/**
 * Provider React pour activer la synchronisation Realtime des interventions
 * Encapsule useInterventionsRealtime pour une utilisation simple dans les composants
 */

'use client'

import { useInterventionsRealtime } from '@/hooks/useInterventionsRealtime'
import type { ReactNode } from 'react'

interface InterventionRealtimeProviderProps {
  children: ReactNode
}

/**
 * Provider pour activer la synchronisation Realtime des interventions
 * 
 * @example
 * ```tsx
 * <InterventionRealtimeProvider>
 *   <InterventionsPage />
 * </InterventionRealtimeProvider>
 * ```
 */
export function InterventionRealtimeProvider({
  children,
}: InterventionRealtimeProviderProps) {
  // Activer la synchronisation Realtime
  useInterventionsRealtime()

  return <>{children}</>
}

