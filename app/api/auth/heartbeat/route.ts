import { NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * Heartbeat de présence (POST /api/auth/heartbeat).
 *
 * Optimisations :
 * - Cache process-wide `auth_user_id -> public.users.id` (binding stable).
 * - Une seule UPDATE pour `last_seen_at`. La transition offline->connected
 *   est déjà gérée par AuthStateListenerProvider sur SIGNED_IN/INITIAL_SESSION,
 *   donc inutile de la dupliquer ici.
 *
 * Volume DB : 4-6 requêtes par ping -> 1 (cache hit) ou 2 (cache miss, première fois).
 */

const userIdCache = new Map<string, string>()

export async function POST() {
  try {
    const supabase = await createSSRServerClient()

    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized' }, { status: 401 })
    }

    const authUserId = authUser.user.id
    const userEmail = authUser.user.email

    if (!supabaseAdmin) {
      console.error('[api/auth/heartbeat] supabaseAdmin not available')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let publicUserId = userIdCache.get(authUserId) ?? null

    if (!publicUserId) {
      const { data: userByAuthId } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (userByAuthId?.id) {
        publicUserId = userByAuthId.id
      } else if (userEmail) {
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .maybeSingle()
        if (userByEmail?.id) publicUserId = userByEmail.id
      }

      if (!publicUserId) {
        console.warn(`[api/auth/heartbeat] User not found for auth_user_id=${authUserId}, email=${userEmail}`)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      userIdCache.set(authUserId, publicUserId)
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ last_seen_at: now })
      .eq('id', publicUserId)

    if (updateError) {
      console.error(`[api/auth/heartbeat] Update error for user ${publicUserId}:`, updateError.message)
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 })
    }

    return NextResponse.json({ success: true, last_seen_at: now })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unexpected error'
    console.error('[api/auth/heartbeat] Unexpected error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
