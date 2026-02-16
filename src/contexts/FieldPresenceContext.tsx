'use client'

import { createContext, useContext } from 'react'
import type { PresenceUser, FieldLockMap } from '@/types/presence'

interface FieldPresenceContextValue {
  fieldLockMap: FieldLockMap
  trackField: (fieldName: string) => void
  clearField: () => void
}

const FieldPresenceContext = createContext<FieldPresenceContextValue | null>(null)

export function FieldPresenceProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: FieldPresenceContextValue
}) {
  return (
    <FieldPresenceContext.Provider value={value}>
      {children}
    </FieldPresenceContext.Provider>
  )
}

export function useFieldPresence(): FieldPresenceContextValue {
  const ctx = useContext(FieldPresenceContext)
  if (!ctx) {
    // Graceful fallback: no-op when outside provider (e.g., NewInterventionForm)
    return {
      fieldLockMap: {},
      trackField: () => {},
      clearField: () => {},
    }
  }
  return ctx
}

/** Check if a specific field is locked by another user */
export function useFieldLock(fieldName: string): {
  isLocked: boolean
  locker: PresenceUser | null
} {
  const { fieldLockMap } = useFieldPresence()
  const locker = fieldLockMap[fieldName] ?? null
  return { isLocked: locker !== null, locker }
}
