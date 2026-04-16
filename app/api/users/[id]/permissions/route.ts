import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getAuthenticatedUser } from "@/lib/auth/permissions"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

type EffectivePermissionRow = {
  permission_key: string
  granted: boolean
  source: string
}

type PermissionOverrideRow = {
  permission_id: string
  granted: boolean
  permission: { key: string; description: string } | { key: string; description: string }[] | null
}

type RolePermissionsByRole = Record<string, string[]>

const noDbResponse = () => NextResponse.json({ error: "No DB" }, { status: 500 })

async function requireUserPermission(userId: string, permissionKey: string) {
  if (!supabaseAdmin) return noDbResponse()
  const { data, error } = await supabaseAdmin.rpc("user_has_permission", {
    p_user_id: userId,
    p_permission_key: permissionKey,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json(
      { error: `Permission requise : ${permissionKey}` },
      { status: 403 }
    )
  }
  return null
}

async function canIncludeRolePermissions(userId: string) {
  if (!supabaseAdmin) return false
  const { data, error } = await supabaseAdmin.rpc("user_has_permission", {
    p_user_id: userId,
    p_permission_key: "manage_roles",
  })
  if (error) return false
  return Boolean(data)
}

async function fetchRolePermissionsByRole() {
  if (!supabaseAdmin) {
    return { error: noDbResponse() }
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("name, role_permissions ( permissions ( key ) )")
    .in("name", ["admin", "manager", "gestionnaire"])

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) }
  }

  const rolePermissionsByRole: RolePermissionsByRole = {}
  for (const role of data || []) {
    const permissions = (role as { role_permissions?: Array<{ permissions?: { key?: string } | null } | null> })
      .role_permissions || []
    const keys = permissions
      .map((rp) => rp?.permissions?.key)
      .filter((key): key is string => typeof key === "string")
    rolePermissionsByRole[role.name] = Array.from(new Set(keys))
  }

  return { data: rolePermissionsByRole }
}

async function buildPermissionsData(
  targetUserId: string,
  rolePermissionsByRole?: RolePermissionsByRole
) {
  if (!supabaseAdmin) {
    return { error: noDbResponse() }
  }

  const { data: effective, error: effectiveError } = await supabaseAdmin.rpc(
    "get_user_permissions",
    { p_user_id: targetUserId }
  )
  if (effectiveError) {
    return {
      error: NextResponse.json({ error: effectiveError.message }, { status: 500 }),
    }
  }

  const { data: overrides, error: overridesError } = await supabaseAdmin
    .from("user_permissions")
    .select("permission_id, granted, permission:permissions ( key, description )")
    .eq("user_id", targetUserId)
  if (overridesError) {
    return {
      error: NextResponse.json({ error: overridesError.message }, { status: 500 }),
    }
  }

  const effectiveList = Array.isArray(effective) ? effective : []
  const overridesList = Array.isArray(overrides) ? overrides : []

  const data = {
    effective: effectiveList as EffectivePermissionRow[],
    overrides: overridesList as PermissionOverrideRow[],
  }

  if (rolePermissionsByRole) {
    return {
      data: {
        ...data,
        rolePermissionsByRole,
      },
    }
  }

  return { data }
}

export async function GET(req: Request, context: RouteContext) {
  const actor = await getAuthenticatedUser(req)
  if (!actor) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }

  const { id } = await context.params
  const targetUserId = id?.trim()
  if (!targetUserId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  if (actor.id !== targetUserId) {
    const permError = await requireUserPermission(actor.id, "manage_roles")
    if (permError) return permError
  }

  const includeRolePermissions =
    new URL(req.url).searchParams.get("includeRolePermissions") === "1"
  let rolePermissionsByRole: RolePermissionsByRole | undefined

  if (includeRolePermissions) {
    const canInclude = await canIncludeRolePermissions(actor.id)
    if (canInclude) {
      const rolePermissions = await fetchRolePermissionsByRole()
      if ("error" in rolePermissions) return rolePermissions.error
      rolePermissionsByRole = rolePermissions.data
    }
  }

  const payload = await buildPermissionsData(targetUserId, rolePermissionsByRole)
  if ("error" in payload) return payload.error

  return NextResponse.json({ success: true, data: payload.data })
}

export async function PUT(req: Request, context: RouteContext) {
  const actor = await getAuthenticatedUser(req)
  if (!actor) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 })
  }

  const { id } = await context.params
  const targetUserId = id?.trim()
  if (!targetUserId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const permError = await requireUserPermission(actor.id, "manage_roles")
  if (permError) return permError
  if (!supabaseAdmin) return noDbResponse()

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const rawPermissions = (body as { permissions?: unknown }).permissions

  if (!rawPermissions || typeof rawPermissions !== "object" || Array.isArray(rawPermissions)) {
    return NextResponse.json({ error: "permissions object required" }, { status: 400 })
  }

  const entries = Object.entries(rawPermissions).filter(
    ([key, value]) =>
      typeof key === "string" && (value === null || typeof value === "boolean")
  )

  if (entries.length === 0) {
    const payload = await buildPermissionsData(targetUserId)
    if ("error" in payload) return payload.error
    return NextResponse.json({ success: true, data: payload.data })
  }

  const keys = entries.map(([key]) => key)
  const { data: permissionRows, error: permissionError } = await supabaseAdmin
    .from("permissions")
    .select("id, key")
    .in("key", keys)

  if (permissionError) {
    return NextResponse.json({ error: permissionError.message }, { status: 500 })
  }

  const keyToId = new Map<string, string>()
  for (const row of permissionRows || []) {
    if (row?.key && row?.id) {
      keyToId.set(row.key, row.id)
    }
  }

  const unknownKeys = keys.filter((key) => !keyToId.has(key))
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown permission keys: ${unknownKeys.join(", ")}` },
      { status: 400 }
    )
  }

  const upserts: Array<{
    user_id: string
    permission_id: string
    granted: boolean
    granted_by: string
  }> = []
  const deleteIds: string[] = []

  for (const [key, value] of entries) {
    const permissionId = keyToId.get(key)
    if (!permissionId) continue
    if (value === null) {
      deleteIds.push(permissionId)
    } else {
      upserts.push({
        user_id: targetUserId,
        permission_id: permissionId,
        granted: value,
        granted_by: actor.id,
      })
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabaseAdmin
      .from("user_permissions")
      .upsert(upserts, { onConflict: "user_id,permission_id" })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("user_permissions")
      .delete()
      .eq("user_id", targetUserId)
      .in("permission_id", deleteIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const payload = await buildPermissionsData(targetUserId)
  if ("error" in payload) return payload.error

  return NextResponse.json({ success: true, data: payload.data })
}
