"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserRoles } from "@/hooks/useUserRoles"

interface AdminGuardProps {
  children: React.ReactNode
  redirectTo?: string
  showMessage?: boolean
}

/**
 * Composant de garde pour protéger les pages réservées aux administrateurs
 * Redirige automatiquement les utilisateurs non-admin ou affiche un message d'erreur
 */
export function AdminGuard({ 
  children, 
  redirectTo = "/dashboard",
  showMessage = true 
}: AdminGuardProps) {
  const router = useRouter()
  const { isAdmin, isLoading } = useUserRoles()

  useEffect(() => {
    // Attendre que le chargement soit terminé
    if (isLoading) return

    // Si l'utilisateur n'est pas admin, rediriger
    if (!isAdmin) {
      router.push(redirectTo)
    }
  }, [isAdmin, isLoading, router, redirectTo])

  // Afficher un loader pendant le chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  // Afficher un message d'accès refusé si l'utilisateur n'est pas admin
  if (!isAdmin && showMessage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Accès refusé
            </h1>
            <p className="text-muted-foreground mb-4">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <p className="text-sm text-muted-foreground">
              Cette page est réservée aux administrateurs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Si pas d'utilisateur, ne rien afficher (AuthGuard gérera la redirection)
  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}


