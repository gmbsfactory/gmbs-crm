"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Composant de garde d'authentification global
 * Vérifie que l'utilisateur existe dans la base de données
 * Redirige vers /login si l'authentification échoue
 * 
 * NOTE: Le cookie sb-access-token est httpOnly, donc on ne peut pas le vérifier côté client.
 * On fait confiance au middleware qui a déjà vérifié le token côté serveur.
 * On vérifie ici uniquement que l'utilisateur existe dans la base de données.
 * 
 * AMÉLIORATION: Utilise maintenant useCurrentUser pour consommer la query partagée
 * et éviter les fetchs parallèles. Le chargement des gestionnaires a été déplacé
 * vers les pages qui en ont besoin (via useGestionnaires).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false)
  
  // Pages publiques qui ne nécessitent pas d'authentification
  const publicPaths = ["/login", "/landingpage"]
  const isPublicPath = publicPaths.some((path) => pathname?.startsWith(path))
  
  // Ne pas appeler les hooks sur les pages publiques
  const shouldCheckAuth = !isPublicPath
  
  // Utiliser useCurrentUser pour consommer la query partagée
  // Cela évite les fetchs parallèles et profite du cache TanStack Query
  // Désactiver la query sur les pages publiques pour éviter les appels inutiles
  const { data: currentUser, isLoading: isLoadingUser, error: userError } = useCurrentUser({ 
    enabled: shouldCheckAuth 
  })

  useEffect(() => {
    // Ne rien faire sur les pages publiques
    if (isPublicPath || !shouldCheckAuth) return
    
    // Éviter les redirections multiples
    if (hasRedirected.current) return
    
    // Attendre que le chargement soit terminé
    if (isLoadingUser) return

    // Vérifier les erreurs d'authentification
    const isUnauthorized = userError && (
      (userError as any)?.status === 401 || 
      (userError as Error)?.message?.includes('401') ||
      (userError as Error)?.message?.includes('Unauthorized')
    )
    
    // Rediriger si :
    // 1. Erreur d'authentification explicite (401), OU
    // 2. Pas d'utilisateur après le chargement (utilisateur non connecté)
    const shouldRedirect = (isUnauthorized || !currentUser) && pathname !== '/login'
    
    if (shouldRedirect) {
      hasRedirected.current = true
      // Rediriger vers login avec le chemin actuel comme redirect
      const loginUrl = `/login${pathname !== "/" ? `?redirect=${encodeURIComponent(pathname)}` : ""}`
      router.push(loginUrl)
    }
  }, [
    currentUser,
    isLoadingUser,
    userError,
    router,
    pathname,
    isPublicPath,
    shouldCheckAuth,
  ])

  // Sur les pages publiques, afficher directement
  if (isPublicPath) {
    return <>{children}</>
  }

  // Pendant le chargement, afficher un loader
  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  // Si pas d'utilisateur, rediriger (géré par useEffect)
  // Afficher un loader pendant la redirection
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirection...</div>
      </div>
    )
  }

  // Si erreur d'authentification (401), rediriger (géré par useEffect)
  const isUnauthorized = userError && (
    (userError as any)?.status === 401 || 
    (userError as Error)?.message?.includes('401') ||
    (userError as Error)?.message?.includes('Unauthorized')
  )
  if (isUnauthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirection...</div>
      </div>
    )
  }

  // Utilisateur authentifié, afficher le contenu
  return <>{children}</>
}

