"use client"

import { useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { preloadCriticalDataAsync } from "@/lib/preload-critical-data"
import { resetPreloadFlag } from "@/lib/preload-flag"
import { resetPublicUserIdCache } from "@/lib/api/v2/reminders"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { getLocalDateString } from "@/lib/date-utils"

/**
 * Provider qui gère un seul listener onAuthStateChange global
 * pour éviter les listeners multiples quand plusieurs composants utilisent useCurrentUser
 *
 * Depuis la migration vers @supabase/ssr, la synchronisation des cookies
 * est gérée automatiquement par le middleware. Ce provider ne gère plus
 * que la logique métier (cache, status, preload, etc.)
 */
export function AuthStateListenerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()

  // Nettoyage one-time de l'ancien token localStorage (migration @supabase/ssr)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('supabase.auth.token')
      } catch {
        // Ignorer si localStorage n'est pas accessible
      }
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      // Invalider le cache lors des événements critiques
      if (event === 'SIGNED_OUT') {
        // Déconnexion : vider complètement le cache pour éviter qu'un second utilisateur
        // hérite des données mises en cache par le premier
        queryClient.clear()
        // Réinitialiser le flag de préchargement pour permettre un nouveau préchargement à la prochaine connexion
        resetPreloadFlag()
        // Réinitialiser le cache publicUserId des reminders
        resetPublicUserIdCache()
        // Nettoyer aussi sessionStorage pour l'animation
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('revealTransition')
        }
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        // Connexion, session initiale ou refresh token : invalider pour forcer un refetch
        queryClient.invalidateQueries({ queryKey: ["currentUser"] })

        // Précharger les données critiques après connexion ou lors de la session initiale
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          setTimeout(() => {
            preloadCriticalDataAsync(queryClient)
          }, 200)

          // Remettre le statut à "connected" lors de la connexion ou du chargement de page
          fetch('/api/auth/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'connected' })
          })
            .then(response => {
              if (response.ok) {
                console.log('[AuthStateListenerProvider] Status set to connected')
                queryClient.invalidateQueries({ queryKey: ["currentUser"] })
              } else {
                console.warn('[AuthStateListenerProvider] Failed to set connected status:', response.status)
              }
            })
            .catch(error => {
              console.warn('[AuthStateListenerProvider] Error setting connected status:', error)
            })
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])

  // Check for first activity of the day (lateness tracking)
  useEffect(() => {
    if (!currentUser?.id) return

    const checkFirstActivity = async () => {
      try {
        const storageKey = `last_activity_check_${currentUser.id}`
        const lastCheck = localStorage.getItem(storageKey)
        const today = getLocalDateString()

        if (lastCheck === today) {
          return
        }

        const response = await fetch('/api/auth/first-activity', {
          method: 'POST',
          credentials: 'include'
        })

        if (!response.ok) {
          console.error('[AuthStateListenerProvider] Failed to check first activity:', response.status)
          return
        }

        const data = await response.json()

        if (data.ok === true && data.wasFirstActivity !== undefined) {
          localStorage.setItem(storageKey, today)
        }
      } catch (error) {
        console.error('[AuthStateListenerProvider] Error checking first activity:', error)
      }
    }

    checkFirstActivity()
  }, [currentUser?.id])

  // Server-side heartbeat system
  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') return

    const HEARTBEAT_INTERVAL = 30000

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/auth/heartbeat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Heartbeat error:', error)
      }
    }

    sendHeartbeat()
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      clearInterval(heartbeatInterval)
    }
  }, [currentUser?.id])

  // Handle tab/window close with multi-tab support
  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') return

    const TAB_COUNT_KEY = `crm_tab_count_${currentUser.id}`
    const TAB_CHANNEL_NAME = `crm-tabs-${currentUser.id}`

    const tabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    let tabChannel: BroadcastChannel | null = null
    if (window.BroadcastChannel) {
      tabChannel = new BroadcastChannel(TAB_CHANNEL_NAME)
    }

    let logoutChannel: BroadcastChannel | null = null
    if (window.BroadcastChannel) {
      logoutChannel = new BroadcastChannel(`crm-logout-${currentUser.id}`)
    }

    if (logoutChannel) {
      logoutChannel.onmessage = (event: MessageEvent) => {
        const { type, reason } = event.data

        if (type === 'logout-initiated') {
          console.log(`[AuthStateListenerProvider] Logout broadcast received (reason: ${reason})`)

          import('@/lib/auth/logout-manager').then(({ getLogoutManager }) => {
            const logoutManager = getLogoutManager()

            logoutManager.executeLogout(
              queryClient,
              supabase,
              currentUser.id,
              {
                skipStatusUpdate: true,
                broadcastToOtherTabs: false,
                reason: 'remote_logout',
              }
            )
          })
        }
      }
    }

    const HEARTBEAT_INTERVAL = 30000 // 30 seconds
    const HEARTBEAT_TIMEOUT = 60000 // 60 seconds
    const HEARTBEAT_STORAGE_KEY = `crm_heartbeats_${currentUser.id}`

    interface TabHeartbeat {
      tabId: string
      lastSeen: number
    }

    const updateHeartbeatInStorage = () => {
      try {
        const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
        const heartbeats: Record<string, TabHeartbeat> = stored ? JSON.parse(stored) : {}
        heartbeats[tabId] = { tabId, lastSeen: Date.now() }
        localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to update heartbeat:', error)
      }
    }

    const broadcastHeartbeat = () => {
      if (!tabChannel) return
      tabChannel.postMessage({ type: 'heartbeat', tabId, timestamp: Date.now() })
      updateHeartbeatInStorage()
    }

    const cleanupDeadTabs = () => {
      try {
        const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
        if (!stored) return

        const heartbeats: Record<string, TabHeartbeat> = JSON.parse(stored)
        const now = Date.now()
        let cleaned = false

        for (const [id, heartbeat] of Object.entries(heartbeats)) {
          if (now - heartbeat.lastSeen > HEARTBEAT_TIMEOUT) {
            delete heartbeats[id]
            cleaned = true
          }
        }

        if (cleaned) {
          localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
          const aliveCount = Object.keys(heartbeats).length
          setTabCount(aliveCount)
        }
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to cleanup dead tabs:', error)
      }
    }

    const getTabCount = (): number => {
      try {
        const count = localStorage.getItem(TAB_COUNT_KEY)
        return count ? parseInt(count, 10) : 0
      } catch {
        return 0
      }
    }

    const setTabCount = (count: number): void => {
      try {
        localStorage.setItem(TAB_COUNT_KEY, count.toString())
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to update tab count:', error)
      }
    }

    const incrementTabCount = (): void => {
      const currentCount = getTabCount()
      const newCount = currentCount + 1
      setTabCount(newCount)
      if (tabChannel) {
        tabChannel.postMessage({ type: 'tab-opened', tabId, count: newCount })
      }
    }

    const decrementTabCount = (): number => {
      const currentCount = getTabCount()
      const newCount = Math.max(0, currentCount - 1)
      setTabCount(newCount)
      if (tabChannel) {
        tabChannel.postMessage({ type: 'tab-closed', tabId, count: newCount })
      }
      return newCount
    }

    const setOfflineStatus = async (): Promise<void> => {
      try {
        await fetch('/api/auth/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true,
          body: JSON.stringify({ status: 'offline' })
        })
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Error setting offline status:', error)
      }
    }

    if (tabChannel) {
      tabChannel.onmessage = (event: MessageEvent<{ type: string; tabId: string; count?: number; timestamp?: number }>) => {
        const { type, count, timestamp } = event.data

        if (type === 'tab-opened' || type === 'tab-closed') {
          if (count !== undefined) {
            setTabCount(count)
          }
        } else if (type === 'heartbeat') {
          const { tabId: remoteTabId } = event.data
          try {
            const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
            const heartbeats: Record<string, TabHeartbeat> = stored ? JSON.parse(stored) : {}
            heartbeats[remoteTabId] = { tabId: remoteTabId, lastSeen: timestamp || Date.now() }
            localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
          } catch (error) {
            console.warn('[AuthStateListenerProvider] Failed to process heartbeat:', error)
          }
        }
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TAB_COUNT_KEY && e.newValue) {
        parseInt(e.newValue, 10)
      }
    }
    window.addEventListener('storage', handleStorageChange)

    incrementTabCount()

    const heartbeatInterval = setInterval(() => {
      broadcastHeartbeat()
      cleanupDeadTabs()
    }, HEARTBEAT_INTERVAL)

    broadcastHeartbeat()

    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        const remainingTabs = decrementTabCount()
        if (remainingTabs === 0) {
          setOfflineStatus()
        }
      }
    }

    const handleBeforeUnload = () => {
      const remainingTabs = decrementTabCount()
      if (remainingTabs === 0) {
        setOfflineStatus()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('storage', handleStorageChange)

      clearInterval(heartbeatInterval)

      try {
        const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
        if (stored) {
          const heartbeats: Record<string, TabHeartbeat> = JSON.parse(stored)
          delete heartbeats[tabId]
          localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
        }
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to remove heartbeat:', error)
      }

      const remainingTabs = decrementTabCount()
      if (remainingTabs === 0 && tabChannel) {
        setOfflineStatus()
      }

      if (tabChannel) {
        tabChannel.close()
      }
      if (logoutChannel) {
        logoutChannel.close()
      }
    }
  }, [currentUser?.id, queryClient])

  return <>{children}</>
}