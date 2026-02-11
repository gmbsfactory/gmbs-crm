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

/**
 * Check if Supabase Auth Admin API is available
 */
function hasAuthAdmin(): boolean {
  try {
    return !!(supabaseAdmin?.auth?.admin?.createUser)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  // Check permission: write_users to create a user
  const permCheck = await requirePermission(req, "write_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) {
    console.error('[create-user] supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: "Database client not configured" }, { status: 500 })
  }
  
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

    // Check if email already exists in public.users
    const existing = await supabaseAdmin
      .from('users')
      .select('id, status, firstname, lastname')
      .eq('email', email)
      .maybeSingle()
    if (existing.error) {
      console.error('[create-user] Error checking existing user:', existing.error.message)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    
    // If user exists and is archived, return special response for restoration prompt
    if (existing.data && existing.data.status === 'archived') {
      return NextResponse.json({ 
        error: 'user_archived',
        archivedUser: {
          id: existing.data.id,
          email,
          firstname: existing.data.firstname,
          lastname: existing.data.lastname,
        },
        message: `Le gestionnaire avec l'email "${email}" existe déjà mais a été archivé. Voulez-vous restaurer ce compte ?`
      }, { status: 409 })
    }
    
    // If user exists and is active, it's a duplicate
    if (existing.data) return NextResponse.json({ error: 'email_taken' }, { status: 409 })

    // Generate username
    const baseParts = [firstname, lastname].map((part) =>
      part.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
    )
    const base = baseParts.filter(Boolean).join('.')
    const suffix = Math.random().toString(36).slice(2, 6)
    const username = [base || 'user', suffix].join('.')

    let userId: string
    let inviteLink = ''

    // Check if Auth Admin API is available
    const authAdminAvailable = hasAuthAdmin()

    if (authAdminAvailable) {
      // ===== WITH AUTH: Create user in auth.users first =====
      try {
        
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            firstname,
            lastname,
            username,
          },
        })

        if (authError) {
          console.error('[create-user] Auth user creation failed:', authError.message, authError)
          // Fallback: create only in public.users
        } else if (!authUser?.user) {
          console.error('[create-user] Auth user creation returned no user')
        } else {
          userId = authUser.user.id

          // Generate password recovery link
          // Use request host header for accurate URL (works for all environments including preview)
          const host = req.headers.get('host') || req.headers.get('x-forwarded-host')
          const protocol = host?.includes('localhost') ? 'http' : 'https'
          const siteUrl = host 
            ? `${protocol}://${host}` 
            : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
          try {
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'recovery',
              email,
              options: {
                redirectTo: `${siteUrl}/set-password`,
              },
            })

            if (linkError) {
              console.error('[create-user] Link generation failed:', linkError.message)
              // Continue without invite link - user can use "forgot password" later
            } else {
              inviteLink = linkData?.properties?.action_link || ''
            }
          } catch (linkGenError: any) {
            console.error('[create-user] Link generation exception:', linkGenError?.message)
          }
        }
      } catch (authException: any) {
        console.error('[create-user] Auth exception:', authException?.message)
        // Continue to create in public.users only
      }
    }

    // If we don't have a userId from auth, generate a new UUID
    // @ts-ignore - userId may be undefined
    if (!userId) {
      userId = crypto.randomUUID()
    }

    // ===== Create profile in public.users =====
    const insertPayload: Record<string, unknown> = {
      id: userId,
      firstname,
      lastname,
      username,
      email,
      code_gestionnaire: surnom ?? null,
      status: 'offline',
      token_version: 0,
    }
    if (color) insertPayload.color = color

    const ins = await supabaseAdmin
      .from('users')
      .insert(insertPayload)
      .select('id')
      .single()

    if (ins.error) {
      console.error('[create-user] Profile creation failed:', ins.error.message, ins.error)
      // If we created an auth user, try to clean it up
      if (authAdminAvailable && inviteLink) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
        } catch (rollbackError: any) {
          console.error('[create-user] Rollback failed:', rollbackError?.message)
        }
      }
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // ===== Assign role =====
    try {
      const roleId = await ensureRole(role)
      const roleLink = await supabaseAdmin.from('user_roles').insert({ user_id: userId, role_id: roleId })
      if (roleLink.error) {
        console.error('[create-user] Role assignment failed:', roleLink.error.message)
      }
    } catch (roleError: any) {
      console.error('[create-user] Role assignment exception:', roleError?.message)
    }

    // ===== Create auth_user_mapping if we have an auth user =====
    if (authAdminAvailable && inviteLink) {
      try {
        const mappingResult = await supabaseAdmin
          .from('auth_user_mapping')
          .insert({ auth_user_id: userId, public_user_id: userId })
        if (mappingResult.error) {
          console.warn('[create-user] auth_user_mapping creation failed:', mappingResult.error.message)
        }
      } catch (mappingError: any) {
        console.warn('[create-user] auth_user_mapping exception:', mappingError?.message)
      }
    }

    const response: Record<string, unknown> = { 
      ok: true, 
      id: userId,
      email,
      firstname,
      lastname,
    }

    // Only include inviteLink if we actually generated one
    if (inviteLink) {
      response.inviteLink = inviteLink
    }

    return NextResponse.json(response)
  } catch (e: any) {
    console.error('[create-user] Unexpected error:', e?.message, e?.stack)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
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
    if (typeof body.email === 'string') payload.email = body.email.trim().toLowerCase() || null
    if (typeof body.avatar_url === 'string') payload.avatar_url = body.avatar_url.trim() || null
    else if (body.avatar_url === null) payload.avatar_url = null

    if (Object.keys(payload).length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabaseAdmin.from('users').update(payload).eq('id', userId)
    if (error) {
      console.error('[update-user] PATCH error:', error.message)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
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

    if (error) {
      console.error('[delete-user] SELECT error:', error.message)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    if ((data.email || '').toLowerCase() !== emailConfirm) {
      return NextResponse.json({ error: 'email_mismatch' }, { status: 400 })
    }

    // ===== SOFT DELETE: Archive the user instead of deleting =====
    
    // 1. Find the auth_user_id from the mapping (public.users.id != auth.users.id)
    let authUserId: string | null = null
    try {
      const { data: mapping } = await supabaseAdmin
        .from('auth_user_mapping')
        .select('auth_user_id')
        .eq('public_user_id', userId)
        .maybeSingle()
      authUserId = mapping?.auth_user_id || null
    } catch (e: any) {
      console.warn('[delete-user] Mapping lookup failed:', e?.message)
    }

    // 2. Delete from auth.users (removes access to the application)
    if (hasAuthAdmin() && authUserId) {
      try {
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
        if (authDeleteError) {
          console.warn('[delete-user] Auth user deletion failed:', authDeleteError.message)
        } else {
        }
      } catch (authDeleteException: any) {
        console.warn('[delete-user] Auth user deletion exception:', authDeleteException?.message)
      }
    }

    // 3. Delete auth_user_mapping (no longer linked to auth)
    try {
      await supabaseAdmin
        .from('auth_user_mapping')
        .delete()
        .eq('public_user_id', userId)
    } catch (e: any) {
      console.warn('[delete-user] auth_user_mapping deletion failed:', e?.message)
    }

    // 4. SOFT DELETE: Archive + GDPR anonymize personal data (Article 17)
    // This preserves the user's history (interventions, etc.) while removing PII
    const { error: archiveError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        // RGPD Article 17 - Anonymisation des données personnelles
        // firstname, lastname, color et code_gestionnaire sont conservés
        // pour l'affichage historique dans la table des interventions
        email: `deleted_${userId}@anonymized.local`,
        username: `deleted_${userId}`,
        avatar_url: null,
      })
      .eq('id', userId)
    
    if (archiveError) {
      console.error('[delete-user] Archive failed:', archiveError.message)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, archived: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Bad payload' }, { status: 400 })
  }
}
