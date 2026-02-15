import { NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * Endpoint POST pour enregistrer un heartbeat (ping) de l'utilisateur
 *
 * Ce système permet de détecter automatiquement les déconnexions:
 * - Le client envoie un heartbeat toutes les 30 secondes
 * - Le serveur met à jour last_seen_at
 * - Un worker serveur vérifie périodiquement si last_seen_at > 90s → met offline
 *
 * AVANTAGES:
 * - Détection fiable même si l'onglet crash ou est tué
 * - Pas de dépendance aux événements beforeunload/pagehide
 * - Fonctionne comme Teams/Skype/Slack
 */
export async function POST() {
  try {
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()

    // Vérifier l'authentification
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.user.id
    const userEmail = authUser.user.email

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not available' }, { status: 400 })
    }

    // Vérifier que supabaseAdmin est disponible
    if (!supabaseAdmin) {
      console.error('[api/auth/heartbeat] supabaseAdmin not available')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Trouver l'utilisateur dans public.users
    let publicUserId: string | null = null

    const { data: userByAuthId } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (userByAuthId?.id) {
      publicUserId = userByAuthId.id
    } else if (userEmail) {
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('id, auth_user_id')
        .eq('email', userEmail)
        .maybeSingle()

      if (userByEmail?.id) {
        publicUserId = userByEmail.id
      }
    }

    if (!publicUserId) {
      console.warn(`[api/auth/heartbeat] User not found for auth_user_id=${userId}, email=${userEmail}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Mettre à jour last_seen_at
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ last_seen_at: now })
      .eq('id', publicUserId)

    if (updateError) {
      console.error(`[api/auth/heartbeat] Update error for user ${publicUserId}:`, updateError.message)
      return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 })
    }

    // Optionnel: Si le status est offline, le remettre à connected automatiquement
    // (utile pour la reconnexion automatique après un crash)
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', publicUserId)
      .single()

    if (currentUser?.status === 'offline') {
      await supabaseAdmin
        .from('users')
        .update({ status: 'connected' })
        .eq('id', publicUserId)

    }

    return NextResponse.json({
      success: true,
      last_seen_at: now
    })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unexpected error'
    console.error('[api/auth/heartbeat] Unexpected error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
