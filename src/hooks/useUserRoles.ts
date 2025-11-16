"use client"

import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Hook pour vérifier les rôles de l'utilisateur actuel
 * Centralise la logique de vérification des rôles dans toute l'application
 */
export function useUserRoles() {
  const { data: currentUser, isLoading } = useCurrentUser()
  
  const roles = currentUser?.roles || []
  const rolesLower = roles.map((r) => (r || "").toLowerCase().trim())

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   */
  const hasRole = (role: string): boolean => {
    if (isLoading) return false
    return rolesLower.includes(role.toLowerCase())
  }

  /**
   * Vérifie si l'utilisateur a au moins un des rôles spécifiés
   */
  const hasAnyRole = (requiredRoles: string[]): boolean => {
    if (isLoading) return false
    return requiredRoles.some((role) => rolesLower.includes(role.toLowerCase()))
  }

  /**
   * Vérifie si l'utilisateur a tous les rôles spécifiés
   */
  const hasAllRoles = (requiredRoles: string[]): boolean => {
    if (isLoading) return false
    return requiredRoles.every((role) => rolesLower.includes(role.toLowerCase()))
  }

  return {
    roles,
    rolesLower,
    isLoading,
    isAdmin: hasRole("admin"),
    isManager: hasRole("manager"),
    isGestionnaire: hasRole("gestionnaire"),
    hasRole,
    hasAnyRole,
    hasAllRoles,
  }
}


