import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Endpoint PATCH pour mettre à jour le statut de présence d'un utilisateur
 * 
 * SÉCURITÉ:
 * - Vérifie l'authentification avant toute opération
 * - Utilise supabaseAdmin pour bypass RLS (nécessaire pour mettre à jour le statut)
 * - Vérifie explicitement que l'utilisateur trouvé correspond à l'utilisateur authentifié
 * - Valide toutes les entrées avant traitement
 */
export async function PATCH(req: Request) {
  try {
    // Lire le token depuis le header Authorization OU depuis les cookies HTTP-only
    let token = bearerFrom(req)
    
    // Si pas de token dans le header, lire depuis les cookies HTTP-only
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabase(token)

    // SÉCURITÉ: Vérifier l'authentification AVANT toute opération avec supabaseAdmin
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.user.id
    const userEmail = authUser.user.email

    // Valider que l'email est présent (nécessaire pour le fallback de recherche)
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not available' }, { status: 400 })
    }

    // Récupérer et valider le body
    let body: { status?: string }
    try {
      body = await req.json()
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { status } = body

    // Valider le status
    const validStatuses = ['connected', 'busy', 'dnd', 'offline'] as const
    if (!status || typeof status !== 'string' || !validStatuses.includes(status as typeof validStatuses[number])) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be one of: connected, busy, dnd, offline' 
      }, { status: 400 })
    }

    // Vérifier que supabaseAdmin est disponible
    if (!supabaseAdmin) {
      console.error('[api/auth/status] supabaseAdmin not available')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Trouver l'utilisateur dans public.users via auth_user_id ou email
    let publicUserId: string | null = null

    // Essayer via auth_user_id d'abord (plus rapide avec l'index)
    const { data: userByAuthId } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (userByAuthId?.id) {
      publicUserId = userByAuthId.id
    } else if (userEmail) {
      // Fallback: chercher par email
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('id, auth_user_id')
        .eq('email', userEmail)
        .maybeSingle()

      if (userByEmail?.id) {
        publicUserId = userByEmail.id
        // Synchroniser auth_user_id en arrière-plan si nécessaire
        if (!userByEmail.auth_user_id) {
          void (async () => {
            try {
              await supabaseAdmin
                .from('users')
                .update({ auth_user_id: userId })
                .eq('id', publicUserId)
            } catch {
              // Ignore les erreurs silencieusement
            }
          })()
        }
      }
    }

    if (!publicUserId) {
      console.warn(`[api/auth/status] User not found for auth_user_id=${userId}, email=${userEmail}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // SÉCURITÉ: Vérification finale pour s'assurer que l'utilisateur trouvé correspond bien à l'utilisateur authentifié
    // Cette vérification est critique car supabaseAdmin bypass RLS
    const { data: userVerification, error: verificationError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email')
      .eq('id', publicUserId)
      .maybeSingle()

    if (verificationError || !userVerification) {
      console.error(`[api/auth/status] Verification error for user ${publicUserId}:`, verificationError?.message)
      return NextResponse.json({ error: 'User verification failed' }, { status: 500 })
    }

    // Vérifier que l'utilisateur trouvé correspond bien à l'utilisateur authentifié
    const isAuthorized = 
      userVerification.auth_user_id === userId || 
      (userVerification.email && userVerification.email.toLowerCase() === userEmail?.toLowerCase())

    if (!isAuthorized) {
      console.warn(
        `[api/auth/status] Unauthorized update attempt: auth_user_id=${userId}, ` +
        `found_user_id=${publicUserId}, found_auth_user_id=${userVerification.auth_user_id}`
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Préparer les données de mise à jour
    const updateData: { status: string; last_seen_at?: string } = {
      status,
    }

    // Mettre à jour last_seen_at si le statut est 'connected'
    if (status === 'connected') {
      updateData.last_seen_at = new Date().toISOString()
    }

    // Mettre à jour le statut dans la base de données avec supabaseAdmin (bypass RLS)
    // NOTE: On utilise supabaseAdmin car la mise à jour du statut doit fonctionner même si RLS bloque
    // La sécurité est assurée par les vérifications d'authentification et d'autorisation ci-dessus
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', publicUserId)

    if (updateError) {
      console.error(`[api/auth/status] Update error for user ${publicUserId}:`, updateError.message)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unexpected error'
    console.error('[api/auth/status] Unexpected error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
