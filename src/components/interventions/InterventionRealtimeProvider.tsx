/**
 * Provider React pour activer la synchronisation Realtime des interventions
 * Encapsule useInterventionsRealtime pour une utilisation simple dans les composants
 * T084: Expose le statut de connexion pour affichage dans l'interface
 */

'use client'

import { createContext, useContext } from 'react'
import { useCrmRealtime, type ConnectionStatus } from '@/hooks/useCrmRealtime'
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'
import type { ReactNode } from 'react'

interface RealtimeContextValue {
  connectionStatus: ConnectionStatus
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined)

interface InterventionRealtimeProviderProps {
  children: ReactNode
  showIndicator?: boolean
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
  showIndicator = false,
}: InterventionRealtimeProviderProps) {
  // Activer la synchronisation Realtime
  const { connectionStatus } = useCrmRealtime()

  const value: RealtimeContextValue = {
    connectionStatus,
  }

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {showIndicator && (
        <div className="fixed bottom-4 right-4 z-50">
          <ConnectionStatusIndicator status={connectionStatus} />
        </div>
      )}
    </RealtimeContext.Provider>
  )
}

/**
 * Hook pour accéder au statut de connexion Realtime
 */
export function useRealtimeStatus(): ConnectionStatus {
  const context = useContext(RealtimeContext)
  if (!context) {
    // Fallback si utilisé en dehors du provider
    return 'connecting'
  }
  return context.connectionStatus
}


