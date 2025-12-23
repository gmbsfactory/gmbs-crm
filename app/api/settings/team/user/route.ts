import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

export const runtime = "nodejs"

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

async function ensureRole(role: string) {
  const { data, error } = await supabaseAdmin!
    .from('roles')
    .select('id')
    .eq('name', role)
    .maybeSingle()
  if (error) throw error
  if (data?.id) return data.id as string
  const created = await supabaseAdmin!
    .from('roles')
    .insert({ name: role })
    .select('id')
    .single()
  if (created.error) throw created.error
  return created.data.id as string
}

export async function POST(req: Request) {
  // Check permission: write_users to create a user
  const permCheck = await requirePermission(req, "write_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const firstname = normalizeString(body.firstname) ?? normalizeString(body.prenom)
    const lastname = normalizeString(body.lastname) ?? normalizeString(body.name)
    const email = normalizeString(body.email)?.toLowerCase()
    const role = normalizeString(body.role)
    const surnom = normalizeString(body.surnom)
    const color = normalizeString(body.color)

    if (!firstname || !lastname || !email || !role) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const existing = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 })
    if (existing.data) return NextResponse.json({ error: 'email_taken' }, { status: 409 })

    const baseParts = [firstname, lastname].map((part) =>
      part.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
    )
    const base = baseParts.filter(Boolean).join('.')
    const suffix = Math.random().toString(36).slice(2, 6)
    const username = [base || 'user', suffix].join('.')

    const insertPayload: Record<string, unknown> = {
      firstname,
      lastname,
      username,
      email,
      code_gestionnaire: surnom ?? null,
    }
    if (color) insertPayload.color = color

    const ins = await supabaseAdmin
      .from('users')
      .insert(insertPayload)
      .select('id')
      .single()
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
    const userId = ins.data.id as string

    const roleId = await ensureRole(role)
    const link = await supabaseAdmin.from('user_roles').insert({ user_id: userId, role_id: roleId })
    if (link.error) return NextResponse.json({ error: link.error.message }, { status: 500 })

    return NextResponse.json({ ok: true, id: userId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad payload' }, { status: 400 })
  }
}

export async function PATCH(req: Request) {
  // Check permission: write_users to update a user
  const permCheck = await requirePermission(req, "write_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const userId = normalizeString(body.userId)
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const payload: Record<string, unknown> = {}

    if (typeof body.surnom === 'string') payload.code_gestionnaire = body.surnom.trim() || null
    else if (typeof body.code_gestionnaire === 'string') payload.code_gestionnaire = body.code_gestionnaire.trim() || null

    if (typeof body.color === 'string') payload.color = body.color.trim() || null
    else if (typeof body.btnColor === 'string') payload.color = body.btnColor.trim() || null

    if (typeof body.firstname === 'string') payload.firstname = body.firstname.trim() || null
    if (typeof body.lastname === 'string') payload.lastname = body.lastname.trim() || null

    if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabaseAdmin.from('users').update(payload).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad payload' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  // Check permission: delete_users to delete a user
  const permCheck = await requirePermission(req, "delete_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const userId = normalizeString(body.userId)
    const emailConfirm = normalizeString(body.emailConfirm)?.toLowerCase()
    if (!userId || !emailConfirm) return NextResponse.json({ error: 'userId and emailConfirm required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if ((data.email || '').toLowerCase() !== emailConfirm) {
      return NextResponse.json({ error: 'email_mismatch' }, { status: 400 })
    }

    const { error: rolesError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    if (rolesError) return NextResponse.json({ error: rolesError.message }, { status: 500 })

    const { error: deleteError } = await supabaseAdmin.from('users').delete().eq('id', userId)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad payload' }, { status: 400 })
  }
}
