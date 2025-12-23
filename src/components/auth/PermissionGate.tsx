"use client"

import * as React from "react"
import { usePermissions, type PermissionKey } from "@/hooks/usePermissions"

interface PermissionGateProps {
  /**
   * Single permission to check
   * Use either `permission` or `permissions`, not both
   */
  permission?: PermissionKey

  /**
   * Multiple permissions to check
   * Combined with `mode` to determine how to evaluate
   */
  permissions?: PermissionKey[]

  /**
   * How to evaluate multiple permissions
   * - "any": User needs at least one of the permissions (default)
   * - "all": User needs all of the permissions
   */
  mode?: "any" | "all"

  /**
   * Optional page key for page_permissions override check
   * When provided, also checks user_page_permissions table
   */
  pageKey?: string

  /**
   * Content to render if permission check passes
   */
  children: React.ReactNode

  /**
   * Optional fallback content when permission is denied
   * Defaults to null (render nothing)
   */
  fallback?: React.ReactNode

  /**
   * Show a loading skeleton while checking permissions
   * Defaults to false (render nothing during loading)
   */
  showLoading?: boolean
}

/**
 * Declarative component for permission-based UI gating
 * 
 * @example
 * // Single permission
 * <PermissionGate permission="delete_interventions">
 *   <Button onClick={handleDelete}>Supprimer</Button>
 * </PermissionGate>
 * 
 * @example
 * // Multiple permissions (any)
 * <PermissionGate permissions={["write_users", "manage_roles"]} mode="any">
 *   <Button>Gérer équipe</Button>
 * </PermissionGate>
 * 
 * @example
 * // With fallback
 * <PermissionGate permission="export_artisans" fallback={<span>Export non disponible</span>}>
 *   <Button onClick={handleExport}>Exporter</Button>
 * </PermissionGate>
 * 
 * @example
 * // With page permission override
 * <PermissionGate permission="view_comptabilite" pageKey="comptabilite">
 *   <ComptabiliteContent />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  mode = "any",
  pageKey,
  children,
  fallback = null,
  showLoading = false,
}: PermissionGateProps) {
  const { can, canAny, canAll, hasPagePermission, isLoading } = usePermissions()

  // Show loading state if requested
  if (isLoading) {
    if (showLoading) {
      return (
        <div className="animate-pulse bg-muted rounded h-8 w-24" />
      )
    }
    return null
  }

  // Determine if user has permission
  let hasPermission = false

  if (permission) {
    // Single permission check
    hasPermission = can(permission)
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    hasPermission = mode === "all" 
      ? canAll(permissions) 
      : canAny(permissions)
  } else {
    // No permission specified = always show
    hasPermission = true
  }

  // Check page permission override if pageKey is provided
  if (hasPermission && pageKey) {
    hasPermission = hasPagePermission(pageKey)
  }

  // Render based on permission result
  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Hook-based alternative for complex permission logic
 * Use this when you need more control than PermissionGate provides
 * 
 * @example
 * const { visible, disabled } = usePermissionState("delete_interventions")
 * return (
 *   <Button disabled={disabled} className={visible ? "" : "hidden"}>
 *     Supprimer
 *   </Button>
 * )
 */
export function usePermissionState(
  permission: PermissionKey,
  options?: {
    pageKey?: string
    hideOnDenied?: boolean // default true
    disableOnDenied?: boolean // default false
  }
) {
  const { can, hasPagePermission, isLoading } = usePermissions()

  const { 
    pageKey, 
    hideOnDenied = true, 
    disableOnDenied = false 
  } = options || {}

  const hasPermission = React.useMemo(() => {
    if (isLoading) return false
    let result = can(permission)
    if (result && pageKey) {
      result = hasPagePermission(pageKey)
    }
    return result
  }, [can, hasPagePermission, isLoading, pageKey, permission])

  return {
    hasPermission,
    visible: hasPermission || !hideOnDenied,
    disabled: !hasPermission && disableOnDenied,
    isLoading,
  }
}




