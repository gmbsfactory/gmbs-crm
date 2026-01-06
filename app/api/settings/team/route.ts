import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

export const runtime = "nodejs"

export async function GET(req: Request) {
  // Check permission: read_users to list team members
  const permCheck = await requirePermission(req, "read_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  try {
    // Exclude archived users from the list - they are soft-deleted
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, firstname, lastname, email, color, status, code_gestionnaire, username, last_seen_at, avatar_url, user_roles ( roles ( name ) ), user_page_permissions ( page_key, has_access )')
      .neq('status', 'archived')
      .order('lastname', { ascending: true })
      .order('firstname', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const users = (data || []).map((u: any) => {
      const roleName = u?.user_roles?.[0]?.roles?.name || null
      const pagePermissions = Array.isArray(u?.user_page_permissions)
        ? u.user_page_permissions.reduce((acc: Record<string, boolean>, perm: any) => {
            if (perm?.page_key) {
              const key = String(perm.page_key).toLowerCase()
              acc[key] = perm.has_access !== false
            }
            return acc
          }, {})
        : {}
      return {
        id: u.id,
        firstname: u.firstname,
        lastname: u.lastname,
        name: u.lastname,
        prenom: u.firstname,
        email: u.email,
        color: u.color,
        status: u.status,
        surnom: u.code_gestionnaire,
        code_gestionnaire: u.code_gestionnaire,
        role: roleName,
        username: u.username,
        last_seen_at: u.last_seen_at,
        avatar_url: u.avatar_url,
        page_permissions: pagePermissions,
      }
    })
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
