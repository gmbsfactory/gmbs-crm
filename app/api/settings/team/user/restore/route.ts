import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"
import { createPasswordResetToken, getSiteUrlFromRequest } from '@/lib/password-reset-tokens'

export const runtime = "nodejs"

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
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

/**
 * POST /api/settings/team/user/restore
 * Restores an archived user by:
 * 1. Creating a new auth.users entry
 * 2. Generating a password reset link
 * 3. Updating the public.users status back to 'offline'
 * 4. Creating the auth_user_mapping
 */
export async function POST(req: Request) {
  // Check permission: write_users to restore a user
  const permCheck = await requirePermission(req, "write_users")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) {
    console.error('[restore-user] supabaseAdmin is null')
    return NextResponse.json({ error: "Database client not configured" }, { status: 500 })
  }

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const userId = normalizeString(body.userId)

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get the archived user
    const { data: archivedUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email, firstname, lastname, username, status')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error('[restore-user] Error fetching user:', fetchError.message)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!archivedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (archivedUser.status !== 'archived') {
      return NextResponse.json({ 
        error: 'User is not archived', 
        currentStatus: archivedUser.status 
      }, { status: 400 })
    }

    let inviteLink = ''
    const authAdminAvailable = hasAuthAdmin()

    if (authAdminAvailable) {
      // Create new auth.users entry
      try {
        
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: archivedUser.email,
          email_confirm: true,
          user_metadata: {
            firstname: archivedUser.firstname,
            lastname: archivedUser.lastname,
            username: archivedUser.username,
            restored: true,
            restored_at: new Date().toISOString(),
          },
        })

        if (authError) {
          console.error('[restore-user] Auth user creation failed:', authError.message)
          return NextResponse.json({ 
            error: 'Failed to create auth entry: ' + authError.message 
          }, { status: 500 })
        }

        if (!authUser?.user) {
          console.error('[restore-user] Auth user creation returned no user')
          return NextResponse.json({ 
            error: 'Failed to create auth entry' 
          }, { status: 500 })
        }

        const newAuthUserId = authUser.user.id

        // Update public.users with new auth ID if different
        // (In most cases we want to keep the same ID for data integrity)
        // For simplicity, we'll update the user's ID to match the new auth ID
        // This ensures foreign keys remain valid

        // Actually, to preserve all relationships, we need to:
        // 1. Keep the same public.users ID
        // 2. Create auth_user_mapping to link old ID to new auth ID
        
        // Create auth_user_mapping
        try {
          await supabaseAdmin
            .from('auth_user_mapping')
            .upsert({ 
              auth_user_id: newAuthUserId, 
              public_user_id: userId 
            }, {
              onConflict: 'public_user_id'
            })
        } catch (mappingError: any) {
          console.warn('[restore-user] auth_user_mapping creation failed:', mappingError?.message)
        }

        // Créer un token custom réutilisable (24h)
        const siteUrl = getSiteUrlFromRequest(req)
        try {
          const tokenResult = await createPasswordResetToken(userId, siteUrl)
          if (tokenResult) {
            inviteLink = tokenResult.resetLink
          } else {
            console.error('[restore-user] Token creation failed')
          }
        } catch (linkGenError: any) {
          console.error('[restore-user] Token creation exception:', linkGenError?.message)
        }
      } catch (authException: any) {
        console.error('[restore-user] Auth exception:', authException?.message)
        return NextResponse.json({ 
          error: 'Auth exception: ' + authException?.message 
        }, { status: 500 })
      }
    } else {
      return NextResponse.json({ 
        error: 'Auth Admin API not available. Cannot restore user without auth.' 
      }, { status: 500 })
    }

    // Update user status back to 'offline'
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        status: 'offline',
        archived_at: null,
        restored_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[restore-user] Status update failed:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      restored: true,
      id: userId,
      email: archivedUser.email,
      firstname: archivedUser.firstname,
      lastname: archivedUser.lastname,
      inviteLink,
    })
  } catch (e: any) {
    console.error('[restore-user] Unexpected error:', e?.message, e?.stack)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
