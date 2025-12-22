"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermissions, type PermissionKey } from "@/hooks/usePermissions"

interface AdminGuardProps {
  children: React.ReactNode
  redirectTo?: string
  showMessage?: boolean
  /**
   * Permission required to access the guarded content
   * Defaults to "view_admin" for admin pages
   */
  permission?: PermissionKey
}

/**
 * Composant de garde pour protéger les pages basées sur les permissions
 * Redirige automatiquement les utilisateurs sans permission ou affiche un message d'erreur
 */
export function AdminGuard({ 
  children, 
  redirectTo = "/dashboard",
  showMessage = true,
  permission = "view_admin"
}: AdminGuardProps) {
  const router = useRouter()
  const { can, isLoading } = usePermissions()
  
  const hasAccess = can(permission)

  useEffect(() => {
    // Attendre que le chargement soit terminé
    if (isLoading) return

    // Si l'utilisateur n'a pas la permission, rediriger
    if (!hasAccess) {
      router.push(redirectTo)
    }
  }, [hasAccess, isLoading, router, redirectTo])

  // Afficher un loader pendant le chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  // Afficher un message d'accès refusé si l'utilisateur n'a pas la permission
  if (!hasAccess && showMessage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Accès refusé
            </h1>
            <p className="text-muted-foreground mb-4">
              Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <p className="text-sm text-muted-foreground">
              Permission requise : {permission}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Si pas de permission, ne rien afficher (AuthGuard gérera la redirection)
  if (!hasAccess) {
    return null
  }

  return <>{children}</>
}




