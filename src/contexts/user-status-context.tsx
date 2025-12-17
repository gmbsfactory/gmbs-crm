"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"

export type UserStatus = "available" | "busy" | "do-not-disturb" | "be-right-back" | "appear-away" | "appear-offline"

interface UserStatusContextType {
  status: UserStatus
  setStatus: (status: UserStatus) => void
  lastActivity: Date
  updateActivity: () => void
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined)

// Hook pour throttler les fonctions
function useThrottle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const lastRun = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastRun = now - lastRun.current

      if (timeSinceLastRun >= delay) {
        lastRun.current = now
        fn(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          lastRun.current = Date.now()
          fn(...args)
        }, delay - timeSinceLastRun)
      }
    }) as T,
    [fn, delay]
  )
}

export function UserStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatusState] = useState<UserStatus>("available")
  const lastActivityRef = useRef<Date>(new Date()) // Utiliser ref au lieu de state pour éviter les re-renders
  const router = useRouter()

  // Throttler les updates d'activité à 300ms (maximum 3 fois par seconde au lieu de 30+)
  const updateActivity = useThrottle(
    useCallback(() => {
      lastActivityRef.current = new Date()
      // If user was away, bring them back to available
      if (status === "appear-away") {
        setStatusState("available")
      }
    }, [status]),
    300
  )

  const setStatus = useCallback((newStatus: UserStatus) => {
    // Don't allow manual setting of automatic statuses
    if (newStatus === "appear-away" || newStatus === "appear-offline") return

    setStatusState(newStatus)
    localStorage.setItem("userStatus", newStatus)
  }, [])

  useEffect(() => {
    const savedStatus = localStorage.getItem("userStatus") as UserStatus
    if (savedStatus && savedStatus !== "appear-away" && savedStatus !== "appear-offline") {
      setStatusState(savedStatus)
    }
  }, [])

  useEffect(() => {
    const checkInactivity = () => {
      const now = new Date()
      const timeDiff = now.getTime() - lastActivityRef.current.getTime()
      const oneHour = 60 * 60 * 1000 // 1 hour in milliseconds

      if (timeDiff >= oneHour && status !== "appear-offline" && status !== "appear-away") {
        setStatusState("appear-away")
      }
    }

    const interval = setInterval(checkInactivity, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    const handleActivity = () => updateActivity()

    // Utiliser { passive: true } pour les événements de scroll/mousemove pour de meilleures performances
    window.addEventListener("mousemove", handleActivity, { passive: true })
    window.addEventListener("keydown", handleActivity)
    window.addEventListener("click", handleActivity)
    window.addEventListener("scroll", handleActivity, { passive: true })

    return () => {
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
      window.removeEventListener("click", handleActivity)
      window.removeEventListener("scroll", handleActivity)
    }
  }, [updateActivity])

  // MÉMOÏSER la valeur du contexte pour éviter les re-renders inutiles
  // La valeur ne change que si status change réellement, pas à chaque mouvement de souris
  const value = useMemo(
    () => ({
      status,
      setStatus,
      lastActivity: lastActivityRef.current, // Exposer la valeur ref (mise à jour via throttling)
      updateActivity,
    }),
    [status, setStatus, updateActivity]
  )

  return (
    <UserStatusContext.Provider value={value}>
      {children}
    </UserStatusContext.Provider>
  )
}

export function useUserStatus() {
  const context = useContext(UserStatusContext)
  if (context === undefined) {
    throw new Error("useUserStatus must be used within a UserStatusProvider")
  }
  return context
}
