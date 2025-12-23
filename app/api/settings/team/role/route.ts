import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

export const runtime = "nodejs"

export async function POST(req: Request) {
  // Check permission: manage_roles to change user roles
  const permCheck = await requirePermission(req, "manage_roles")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  try {
    const { userId, role } = await req.json()
    if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 })

    // Ensure role exists
    let roleId: string | null = null
    const { data: roleData } = await supabaseAdmin.from('roles').select('id').eq('name', role).maybeSingle()
    if (roleData?.id) roleId = roleData.id
    else {
      const ins = await supabaseAdmin.from('roles').insert({ name: role }).select('id').single()
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
      roleId = ins.data.id
    }

    // Remove previous roles and assign the new one (single-role policy)
    const del = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
    const add = await supabaseAdmin.from('user_roles').insert({ user_id: userId, role_id: roleId })
    if (add.error) return NextResponse.json({ error: add.error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad payload' }, { status: 400 })
  }
}

