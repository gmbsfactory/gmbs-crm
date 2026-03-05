"use client"

import { useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Permission keys supported by the system
 * These map to the permissions table in the database
 */
export type PermissionKey =
  | "read_interventions"
  | "write_interventions"
  | "delete_interventions"
  | "edit_closed_interventions"
  | "read_artisans"
  | "write_artisans"
  | "delete_artisans"
  | "export_artisans"
  | "read_users"
  | "write_users"
  | "delete_users"
  | "manage_roles"
  | "manage_settings"
  | "view_admin"
  | "view_comptabilite"
  | "manage_updates"

interface PermissionResponse {
  success: boolean
  data: {
    effective: Array<{
      permission_key: string
      granted: boolean
      source: string
    }>
    overrides: Array<{
      permission_id: string
      granted: boolean
      permission: { key: string; description: string } | null
    }>
    rolePermissionsByRole?: Record<string, string[]>
  }
}

/**
 * Fetch user permissions from the API
 */
async function fetchUserPermissions(userId: string): Promise<PermissionResponse> {
  const response = await fetch(`/api/users/${userId}/permissions`)
  if (!response.ok) {
    throw new Error("Failed to fetch permissions")
  }
  return response.json()
}

/**
 * Hook centralisé pour la gestion des permissions
 * Charge les permissions depuis la DB (role_permissions + user_permissions)
 * 
 * @example
 * const { can, canAny, canAll, isLoading } = usePermissions()
 * 
 * // Single permission check
 * if (can("delete_interventions")) { ... }
 * 
 * // Multiple permissions (any)
 * if (canAny(["write_users", "manage_roles"])) { ... }
 * 
 * // Multiple permissions (all)
 * if (canAll(["read_users", "write_users"])) { ... }
 */
export function usePermissions() {
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()

  // Fetch permissions from API
  const { 
    data: permissionsData, 
    isLoading: isLoadingPermissions,
  } = useQuery({
    queryKey: ["user-permissions", currentUser?.id],
    queryFn: () => fetchUserPermissions(currentUser!.id),
    enabled: !!currentUser?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  /**
   * Compute the set of permissions for the current user
   * Uses API data only (user_permissions overrides are authoritative)
   */
  const permissions = useMemo(() => {
    const permSet = new Set<PermissionKey>()

    // If API data is available, use it
    if (permissionsData?.data?.effective) {
      for (const perm of permissionsData.data.effective) {
        if (perm.granted) {
          permSet.add(perm.permission_key as PermissionKey)
        }
      }
      return permSet
    }

    return permSet
  }, [permissionsData])

  /**
   * Get permission overrides (for UI to show customized permissions)
   */
  const overrides = useMemo(() => {
    if (!permissionsData?.data?.overrides) return new Map<string, boolean>()
    
    const overrideMap = new Map<string, boolean>()
    for (const override of permissionsData.data.overrides) {
      if (override.permission?.key) {
        overrideMap.set(override.permission.key, override.granted)
      }
    }
    return overrideMap
  }, [permissionsData?.data?.overrides])

  // On considère qu'on est en chargement tant que:
  // 1. L'utilisateur est en cours de chargement
  // 2. Les permissions sont en cours de chargement
  // 3. L'utilisateur existe mais les données de permissions ne sont pas encore disponibles
  const isLoading = isLoadingUser || isLoadingPermissions || (!!currentUser?.id && !permissionsData?.data?.effective)

  /**
   * Check if the user has a specific permission
   * Returns false while loading to prevent UI flash of unauthorized elements
   */
  const can = useCallback(
    (permission: PermissionKey): boolean => {
      // Refuse pendant le chargement - sécurité par défaut
      if (isLoading) return false
      // Refuse si pas de données de permissions chargées
      if (!permissionsData?.data?.effective) return false
      return permissions.has(permission)
    },
    [permissions, isLoading, permissionsData?.data?.effective]
  )

  /**
   * Check if the user has ANY of the specified permissions
   * Returns false while loading to prevent UI flash of unauthorized elements
   */
  const canAny = useCallback(
    (requiredPermissions: PermissionKey[]): boolean => {
      if (isLoading) return false
      if (!permissionsData?.data?.effective) return false
      return requiredPermissions.some((perm) => permissions.has(perm))
    },
    [permissions, isLoading, permissionsData?.data?.effective]
  )

  /**
   * Check if the user has ALL of the specified permissions
   * Returns false while loading to prevent UI flash of unauthorized elements
   */
  const canAll = useCallback(
    (requiredPermissions: PermissionKey[]): boolean => {
      if (isLoading) return false
      if (!permissionsData?.data?.effective) return false
      return requiredPermissions.every((perm) => permissions.has(perm))
    },
    [permissions, isLoading, permissionsData?.data?.effective]
  )

  /**
   * Check if user has a specific role (for backward compatibility)
   * Prefer using `can()` for permission checks
   */
  const hasRole = useCallback(
    (role: string): boolean => {
      if (isLoadingUser) return false
      const userRoles = currentUser?.roles || []
      return userRoles.some(
        (r) => (r || "").toLowerCase().trim() === role.toLowerCase().trim()
      )
    },
    [currentUser?.roles, isLoadingUser]
  )

  /**
   * Convenience getters for common role checks
   * These are kept for backward compatibility but prefer using can()
   */
  const isAdmin = useMemo(() => hasRole("admin"), [hasRole])
  const isManager = useMemo(() => hasRole("manager"), [hasRole])
  const isGestionnaire = useMemo(() => hasRole("gestionnaire"), [hasRole])

  /**
   * Check page_permissions override (for comptabilite, etc.)
   * page_permissions can override role-based permissions on a per-user basis
   */
  const hasPagePermission = useCallback(
    (pageKey: string): boolean => {
      if (isLoadingUser) return false
      const pagePerms = currentUser?.page_permissions
      if (!pagePerms) return true // No override = allow if role permits
      return pagePerms[pageKey] !== false
    },
    [currentUser?.page_permissions, isLoadingUser]
  )

  /**
   * Combined check: role permission + page_permissions override
   * Use this for page access where both role and page_permissions matter
   */
  const canAccessPage = useCallback(
    (permission: PermissionKey, pageKey?: string): boolean => {
      if (isLoadingUser) return false
      const hasPermission = can(permission)
      if (!hasPermission) return false
      if (pageKey) {
        return hasPagePermission(pageKey)
      }
      return true
    },
    [can, hasPagePermission, isLoadingUser]
  )

  /**
   * Check if a permission is overridden for this user
   */
  const isOverridden = useCallback(
    (permission: PermissionKey): boolean => {
      return overrides.has(permission)
    },
    [overrides]
  )

  /**
   * Get the source of a permission (role or user override)
   */
  const getPermissionSource = useCallback(
    (permission: PermissionKey): "role" | "override" | null => {
      if (!permissions.has(permission)) return null
      return overrides.has(permission) ? "override" : "role"
    },
    [permissions, overrides]
  )

  return {
    // Permission checks
    can,
    canAny,
    canAll,
    canAccessPage,
    
    // Role checks (backward compatibility)
    hasRole,
    isAdmin,
    isManager,
    isGestionnaire,
    
    // Page permissions
    hasPagePermission,
    
    // Permission metadata
    isOverridden,
    getPermissionSource,
    overrides,
    
    // State
    isLoading,
    permissions: Array.from(permissions),
    
    // Raw data for debugging
    permissionsData: permissionsData?.data,
  }
}

/**
 * Hook to fetch permissions for a specific user (admin use)
 */
export function useUserPermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => fetchUserPermissions(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Mutate user permissions
 */
export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, boolean | null>
): Promise<PermissionResponse> {
  const response = await fetch(`/api/users/${userId}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to update permissions")
  }
  
  return response.json()
}
