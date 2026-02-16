import { NextResponse } from "next/server"
import { createSSRServerClient } from "@/lib/supabase/server-ssr"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * Permission keys supported by the system
 * Mirrors the frontend PermissionKey type
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

const ALL_PERMISSIONS: PermissionKey[] = [
  "read_interventions",
  "write_interventions",
  "delete_interventions",
  "edit_closed_interventions",
  "read_artisans",
  "write_artisans",
  "delete_artisans",
  "export_artisans",
  "read_users",
  "write_users",
  "delete_users",
  "manage_roles",
  "manage_settings",
  "view_admin",
  "view_comptabilite",
]

const PERMISSION_KEYS = new Set(ALL_PERMISSIONS)

/**
 * Role-based permission mapping (server-side)
 * Must be kept in sync with frontend usePermissions.ts
 */
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: [
    "read_interventions",
    "write_interventions",
    "delete_interventions",
    "edit_closed_interventions",
    "read_artisans",
    "write_artisans",
    "delete_artisans",
    "export_artisans",
    "read_users",
    "write_users",
    "delete_users",
    "manage_roles",
    "manage_settings",
    "view_admin",
    "view_comptabilite",
  ],
  manager: [
    "read_interventions",
    "write_interventions",
    "read_artisans",
    "write_artisans",
    "read_users",
    "export_artisans",
    "view_comptabilite",
  ],
  gestionnaire: [
    "read_interventions",
    "write_interventions",
    "read_artisans",
    "write_artisans",
    "read_users",
  ],
}

interface UserWithRoles {
  id: string
  roles: string[]
  permissions: Set<PermissionKey>
}

/**
 * Get the authenticated user with their roles and computed permissions
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(_req: Request): Promise<UserWithRoles | null> {
  try {
    const supabase = await createSSRServerClient()

    // Get auth user (token is automatiquement lu depuis les cookies par @supabase/ssr)
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user?.id) return null

    const userId = authUser.user.id
    const userEmail = authUser.user.email

    // Get user with roles via mapping
    let publicUserId: string | null = null
    let roles: string[] = []

    // Try via auth_user_mapping first
    const { data: mappingResult } = await supabase
      .from("auth_user_mapping")
      .select(`
        public_user_id,
        users (
          id,
          user_roles (
            roles (name)
          )
        )
      `)
      .eq("auth_user_id", userId)
      .maybeSingle()

    if (mappingResult?.users) {
      const users = mappingResult.users as any
      publicUserId = users.id
      roles = (users.user_roles || [])
        .map((entry: any) => entry?.roles?.name)
        .filter((name: any): name is string => typeof name === "string")
    }

    // Fallback via email if no mapping
    if (!publicUserId && userEmail) {
      const { data: fallbackResult } = await supabase
        .from("users")
        .select(`
          id,
          user_roles (
            roles (name)
          )
        `)
        .eq("email", userEmail)
        .maybeSingle()

      if (fallbackResult) {
        publicUserId = fallbackResult.id
        roles = ((fallbackResult as any).user_roles || [])
          .map((entry: any) => entry?.roles?.name)
          .filter((name: any): name is string => typeof name === "string")
      }
    }

    if (!publicUserId) return null

    const permissions = new Set<PermissionKey>()
    let loadedFromDb = false

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.rpc("get_user_permissions", {
        p_user_id: publicUserId,
      })

      if (!error && Array.isArray(data)) {
        for (const row of data as Array<{ permission_key?: string }>) {
          if (row?.permission_key && PERMISSION_KEYS.has(row.permission_key as PermissionKey)) {
            permissions.add(row.permission_key as PermissionKey)
          }
        }
        loadedFromDb = true
      } else if (error) {
        console.error('Permission check failed:', error)
        loadedFromDb = true // fail-secure: deny all permissions instead of falling back to role-based
      }
    }

    if (!loadedFromDb) {
      for (const role of roles) {
        const normalizedRole = (role || "").toLowerCase().trim()
        const rolePerms = ROLE_PERMISSIONS[normalizedRole]
        if (rolePerms) {
          for (const perm of rolePerms) {
            permissions.add(perm)
          }
        }
      }
    }

    return {
      id: publicUserId,
      roles,
      permissions,
    }
  } catch {
    return null
  }
}

/**
 * Check if the request has a specific permission
 * Returns a 401/403 response if not authorized, or the user if authorized
 */
export async function requirePermission(
  req: Request,
  permission: PermissionKey
): Promise<{ user: UserWithRoles } | { error: NextResponse }> {
  const user = await getAuthenticatedUser(req)

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      ),
    }
  }

  if (!user.permissions.has(permission)) {
    return {
      error: NextResponse.json(
        { error: `Permission requise : ${permission}` },
        { status: 403 }
      ),
    }
  }

  return { user }
}

/**
 * Check if the request has ANY of the specified permissions
 */
export async function requireAnyPermission(
  req: Request,
  permissions: PermissionKey[]
): Promise<{ user: UserWithRoles } | { error: NextResponse }> {
  const user = await getAuthenticatedUser(req)

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      ),
    }
  }

  const hasAny = permissions.some((perm) => user.permissions.has(perm))
  if (!hasAny) {
    return {
      error: NextResponse.json(
        { error: `Permission requise (une parmi) : ${permissions.join(", ")}` },
        { status: 403 }
      ),
    }
  }

  return { user }
}

/**
 * Check if the request has ALL of the specified permissions
 */
export async function requireAllPermissions(
  req: Request,
  permissions: PermissionKey[]
): Promise<{ user: UserWithRoles } | { error: NextResponse }> {
  const user = await getAuthenticatedUser(req)

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      ),
    }
  }

  const hasAll = permissions.every((perm) => user.permissions.has(perm))
  if (!hasAll) {
    return {
      error: NextResponse.json(
        { error: `Permissions requises : ${permissions.join(", ")}` },
        { status: 403 }
      ),
    }
  }

  return { user }
}

/**
 * Helper type guard to check if the result is an error
 */
export function isPermissionError(
  result: { user: UserWithRoles } | { error: NextResponse }
): result is { error: NextResponse } {
  return "error" in result
}


