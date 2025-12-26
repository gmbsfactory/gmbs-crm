"use client"

import { useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { preloadCriticalDataAsync } from "@/lib/preload-critical-data"
import { resetPreloadFlag } from "@/lib/preload-flag"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { getLocalDateString } from "@/lib/date-utils"

/**
 * Provider qui gère un seul listener onAuthStateChange global
 * pour éviter les listeners multiples quand plusieurs composants utilisent useCurrentUser
 */
export function AuthStateListenerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Mettre à jour les cookies lors des événements de session
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Récupérer les nouveaux tokens de la session
        const access_token = session?.access_token
        const refresh_token = session?.refresh_token
        const expires_at = session?.expires_at ?? undefined
        
        // Mettre à jour les cookies HTTP-only pour synchroniser avec Supabase
        if (access_token && refresh_token) {
          try {
            const response = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token, refresh_token, expires_at }),
            })
            
            // Vérifier le statut HTTP pour détecter les erreurs silencieuses
            if (!response.ok) {
              const errorText = await response.text().catch(() => 'Unknown error')
              console.error(
                `[AuthStateListenerProvider] Failed to update session cookies: ${response.status} ${response.statusText}`,
                errorText
              )
              
              // Si le refresh token est révoqué (401) ou erreur serveur (500), forcer une déconnexion
              // pour éviter que l'utilisateur reste bloqué avec des cookies invalides
              if (response.status === 401 || response.status === 500) {
                console.warn('[AuthStateListenerProvider] Session invalid, forcing logout')

                // Set status to offline before forcing logout
                try {
                  await fetch('/api/auth/status', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    keepalive: true,
                    body: JSON.stringify({ status: 'offline' }),
                  })
                } catch (error) {
                  console.warn('[AuthStateListenerProvider] Failed to set offline on forced logout:', error)
                }

                // Invalider le cache et nettoyer la session
                queryClient.clear()
                resetPreloadFlag()
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('revealTransition')
                  try {
                    const deleteResponse = await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' })
                    if (!deleteResponse.ok) {
                      console.error(
                        `[AuthStateListenerProvider] Failed to delete session cookies: ${deleteResponse.status} ${deleteResponse.statusText}`
                      )
                    }
                  } catch (deleteError) {
                    console.error('[AuthStateListenerProvider] Network error deleting session cookies', deleteError)
                  }
                  // Déconnexion Supabase
                  await supabase.auth.signOut()
                  // Rediriger vers login après un court délai pour laisser le temps au nettoyage
                  setTimeout(() => {
                    window.location.href = '/login'
                  }, 100)
                }
                return
              }
            }
          } catch (error) {
            console.error('[AuthStateListenerProvider] Network error updating session cookies', error)
            // En cas d'erreur réseau, on ne force pas la déconnexion car cela pourrait être temporaire
            // L'utilisateur pourra toujours utiliser la session actuelle jusqu'à expiration
          }
        }
      }
      
      // Invalider le cache lors des événements critiques
      if (event === 'SIGNED_OUT') {
        // Déconnexion : vider complètement le cache pour éviter qu'un second utilisateur
        // hérite des données mises en cache par le premier
        queryClient.clear()
        // Réinitialiser le flag de préchargement pour permettre un nouveau préchargement à la prochaine connexion
        resetPreloadFlag()
        // Nettoyer aussi sessionStorage pour l'animation
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('revealTransition')
        }
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        // Connexion, session initiale ou refresh token : invalider pour forcer un refetch
        queryClient.invalidateQueries({ queryKey: ["currentUser"] })
        
        // Précharger les données critiques après connexion ou lors de la session initiale
        // INITIAL_SESSION est envoyé au chargement de page si l'utilisateur est déjà authentifié
        // On le fait de manière asynchrone pour ne pas bloquer le rendu
        // Le flag global empêche les appels multiples
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          // Utiliser un délai court pour laisser le temps aux cookies d'être définis
          setTimeout(() => {
            preloadCriticalDataAsync(queryClient)
          }, 200)
          
          // Remettre le statut à "connected" lors de la connexion ou du chargement de page
          // Corrige le cas où le statut restait "offline" après avoir fermé puis rouvert le navigateur
          fetch('/api/auth/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'connected' })
          })
            .then(response => {
              if (response.ok) {
                console.log('[AuthStateListenerProvider] ✅ Status set to connected')
                // Invalider le cache currentUser pour forcer un refetch avec le nouveau statut
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
  // This runs once when the app loads with an authenticated user
  useEffect(() => {
    if (!currentUser?.id) return

    const checkFirstActivity = async () => {
      try {
        // Check localStorage to see if we already checked today (client-side optimization)
        // Include user ID in the key to handle multiple users on same browser
        const storageKey = `last_activity_check_${currentUser.id}`
        const lastCheck = localStorage.getItem(storageKey)
        const today = getLocalDateString() // YYYY-MM-DD in local timezone

        if (lastCheck === today) {
          // Already checked today, skip API call
          console.log('[AuthStateListenerProvider] Already checked first activity today, skipping')
          return
        }

        console.log('[AuthStateListenerProvider] Checking first activity of the day...')

        // Call API to check and log first activity
        const response = await fetch('/api/auth/first-activity', {
          method: 'POST',
          credentials: 'include'
        })

        if (!response.ok) {
          console.error('[AuthStateListenerProvider] Failed to check first activity:', response.status)
          return
        }

        const data = await response.json()
        console.log('[AuthStateListenerProvider] First activity check result:', data)

        // Only update localStorage if the API call was successful
        // Check both ok flag and wasFirstActivity to ensure we got a valid response
        if (data.ok === true && data.wasFirstActivity !== undefined) {
          // Mark as checked today in localStorage (with user-specific key)
          localStorage.setItem(storageKey, today)

          if (data.wasFirstActivity) {
            console.log('[AuthStateListenerProvider] ✅ First activity of the day detected')
          }
        } else {
          console.warn('[AuthStateListenerProvider] Invalid response from first-activity API, not updating localStorage')
        }
      } catch (error) {
        console.error('[AuthStateListenerProvider] Error checking first activity:', error)
      }
    }

    checkFirstActivity()
  }, [currentUser?.id])

  // Server-side heartbeat system (like Teams/Skype)
  // Sends a ping every 30s to update last_seen_at on the server
  // A server-side worker will automatically set status to offline if no heartbeat for 90s
  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') return

    const HEARTBEAT_INTERVAL = 30000 // 30 seconds

    const sendHeartbeat = async () => {
      try {
        const response = await fetch('/api/auth/heartbeat', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[AuthStateListenerProvider] ❤️ Heartbeat sent:', data.last_seen_at)
        } else {
          console.warn('[AuthStateListenerProvider] Heartbeat failed:', response.status)
        }
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Heartbeat error:', error)
      }
    }

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Then send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      clearInterval(heartbeatInterval)
    }
  }, [currentUser?.id])

  // Handle tab/window close with multi-tab support
  // Only sets status to offline when the LAST tab is closed
  useEffect(() => {
    if (!currentUser?.id || typeof window === 'undefined') return

    const TAB_COUNT_KEY = `crm_tab_count_${currentUser.id}`
    const TAB_CHANNEL_NAME = `crm-tabs-${currentUser.id}`
    
    // Generate unique tab ID
    const tabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Initialize BroadcastChannel for tab communication
    let tabChannel: BroadcastChannel | null = null
    if (window.BroadcastChannel) {
      tabChannel = new BroadcastChannel(TAB_CHANNEL_NAME)
    }

    // Initialize logout broadcast channel
    let logoutChannel: BroadcastChannel | null = null
    if (window.BroadcastChannel) {
      logoutChannel = new BroadcastChannel(`crm-logout-${currentUser.id}`)
    }

    // Listen for logout broadcasts from other tabs
    if (logoutChannel) {
      logoutChannel.onmessage = (event: MessageEvent) => {
        const { type, timestamp, reason, tabId } = event.data

        if (type === 'logout-initiated') {
          console.log(`[AuthStateListenerProvider] Logout broadcast received from tab ${tabId} (reason: ${reason})`)

          // Import and execute logout immediately
          import('@/lib/auth/logout-manager').then(({ getLogoutManager }) => {
            const logoutManager = getLogoutManager()

            logoutManager.executeLogout(
              queryClient,
              supabase,
              currentUser.id,
              {
                skipStatusUpdate: true, // Only initiating tab sets status
                broadcastToOtherTabs: false, // Don't re-broadcast
                reason: 'remote_logout',
              }
            )
          })
        }
      }
    }

    // Heartbeat system to detect crashed tabs
    const HEARTBEAT_INTERVAL = 30000 // 30 seconds
    const HEARTBEAT_TIMEOUT = 60000 // 60 seconds
    const HEARTBEAT_STORAGE_KEY = `crm_heartbeats_${currentUser.id}`

    interface TabHeartbeat {
      tabId: string
      lastSeen: number
    }

    // Update heartbeat in localStorage
    const updateHeartbeatInStorage = () => {
      try {
        const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
        const heartbeats: Record<string, TabHeartbeat> = stored ? JSON.parse(stored) : {}

        heartbeats[tabId] = {
          tabId,
          lastSeen: Date.now(),
        }

        localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to update heartbeat:', error)
      }
    }

    // Broadcast heartbeat
    const broadcastHeartbeat = () => {
      if (!tabChannel) return

      tabChannel.postMessage({
        type: 'heartbeat',
        tabId,
        timestamp: Date.now(),
      })

      // Also update localStorage for persistence
      updateHeartbeatInStorage()
    }

    // Clean up dead tabs
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
            console.log(`[AuthStateListenerProvider] Cleaned up dead tab: ${id}`)
          }
        }

        if (cleaned) {
          localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))

          // Recalculate tab count based on alive tabs
          const aliveCount = Object.keys(heartbeats).length
          setTabCount(aliveCount)
        }
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to cleanup dead tabs:', error)
      }
    }

    // Get current tab count from localStorage
    const getTabCount = (): number => {
      try {
        const count = localStorage.getItem(TAB_COUNT_KEY)
        return count ? parseInt(count, 10) : 0
      } catch {
        return 0
      }
    }

    // Set tab count in localStorage
    const setTabCount = (count: number): void => {
      try {
        localStorage.setItem(TAB_COUNT_KEY, count.toString())
      } catch (error) {
        console.warn('[AuthStateListenerProvider] Failed to update tab count:', error)
      }
    }

    // Increment tab count and announce this tab is open
    const incrementTabCount = (): void => {
      const currentCount = getTabCount()
      const newCount = currentCount + 1
      setTabCount(newCount)
      console.log(`[AuthStateListenerProvider] Tab opened. Total tabs: ${newCount} (tabId: ${tabId})`)
      
      // Broadcast to other tabs
      if (tabChannel) {
        tabChannel.postMessage({ type: 'tab-opened', tabId, count: newCount })
      }
    }

    // Decrement tab count
    const decrementTabCount = (): number => {
      const currentCount = getTabCount()
      const newCount = Math.max(0, currentCount - 1)
      setTabCount(newCount)
      console.log(`[AuthStateListenerProvider] Tab closed. Remaining tabs: ${newCount} (tabId: ${tabId})`)
      
      // Broadcast to other tabs
      if (tabChannel) {
        tabChannel.postMessage({ type: 'tab-closed', tabId, count: newCount })
      }
      
      return newCount
    }

    // Set offline status (only called when last tab closes)
    const setOfflineStatus = async (): Promise<void> => {
      try {
        const response = await fetch('/api/auth/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true, // Critical: ensures request completes even if page closes
          body: JSON.stringify({ status: 'offline' })
        })

        if (response.ok) {
          console.log('[AuthStateListenerProvider] ✅ Status set to offline (last tab closed)')
        } else {
          console.warn('[AuthStateListenerProvider] Failed to set offline status:', response.status)
        }
      } catch (error) {
        // Silently fail - we can't do anything if the page is closing anyway
        console.warn('[AuthStateListenerProvider] Error setting offline status:', error)
      }
    }

    // Listen to messages from other tabs
    if (tabChannel) {
      tabChannel.onmessage = (event: MessageEvent<{ type: string; tabId: string; count?: number; timestamp?: number }>) => {
        const { type, count, timestamp } = event.data

        if (type === 'tab-opened' || type === 'tab-closed') {
          // Sync tab count from other tabs
          if (count !== undefined) {
            setTabCount(count)
            console.log(`[AuthStateListenerProvider] Tab count synced from other tab: ${count}`)
          }
        } else if (type === 'heartbeat') {
          // Update heartbeat from other tabs
          const { tabId: remoteTabId } = event.data
          try {
            const stored = localStorage.getItem(HEARTBEAT_STORAGE_KEY)
            const heartbeats: Record<string, TabHeartbeat> = stored ? JSON.parse(stored) : {}

            heartbeats[remoteTabId] = {
              tabId: remoteTabId,
              lastSeen: timestamp || Date.now(),
            }

            localStorage.setItem(HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeats))
          } catch (error) {
            console.warn('[AuthStateListenerProvider] Failed to process heartbeat:', error)
          }
        }
      }
    }

    // Listen to storage events (fallback for when BroadcastChannel is not available)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TAB_COUNT_KEY && e.newValue) {
        const newCount = parseInt(e.newValue, 10)
        console.log(`[AuthStateListenerProvider] Tab count updated via storage event: ${newCount}`)
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // Initialize: increment tab count when this tab opens
    incrementTabCount()

    // Start heartbeat interval
    const heartbeatInterval = setInterval(() => {
      broadcastHeartbeat()
      cleanupDeadTabs()
    }, HEARTBEAT_INTERVAL)

    // Initial heartbeat
    broadcastHeartbeat()

    // Handle page unload
    const handlePageHide = (event: PageTransitionEvent) => {
      // Only process if page is being unloaded (not cached)
      if (!event.persisted) {
        const remainingTabs = decrementTabCount()
        
        // Only set offline if this was the last tab
        if (remainingTabs === 0) {
          console.log('[AuthStateListenerProvider] Last tab closing, setting status to offline')
          setOfflineStatus()
        } else {
          console.log(`[AuthStateListenerProvider] Tab closing but ${remainingTabs} tab(s) still open, keeping status online`)
        }
      }
    }

    // Fallback for older browsers
    const handleBeforeUnload = () => {
      const remainingTabs = decrementTabCount()
      if (remainingTabs === 0) {
        setOfflineStatus()
      }
    }

    // Add event listeners
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup: decrement on unmount (if component unmounts without page close)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('storage', handleStorageChange)

      // Clear heartbeat interval
      clearInterval(heartbeatInterval)

      // Remove this tab's heartbeat from storage
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

      // Decrement tab count on cleanup
      const remainingTabs = decrementTabCount()
      if (remainingTabs === 0 && tabChannel) {
        // If this was the last tab, set offline
        setOfflineStatus()
      }

      // Close BroadcastChannels
      if (tabChannel) {
        tabChannel.close()
      }
      if (logoutChannel) {
        logoutChannel.close()
      }
    }
  }, [currentUser?.id])

  return <>{children}</>
}

