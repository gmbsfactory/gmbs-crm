"use client"

import { useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { preloadCriticalDataAsync } from "@/lib/preload-critical-data"
import { resetPreloadFlag } from "@/lib/preload-flag"
import { useCurrentUser } from "@/hooks/useCurrentUser"

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
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

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

        // Mark as checked today in localStorage (with user-specific key)
        localStorage.setItem(storageKey, today)

        if (data.wasFirstActivity) {
          console.log('[AuthStateListenerProvider] ✅ First activity of the day detected')
        }
      } catch (error) {
        console.error('[AuthStateListenerProvider] Error checking first activity:', error)
      }
    }

    checkFirstActivity()
  }, [currentUser?.id])

  return <>{children}</>
}

