import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

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

    // Vérifier l'authentification
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized' }, { status: 401 })
    }

    const userId = authUser.user.id
    const userEmail = authUser.user.email

    // Récupérer le body avec le nouveau status
    const body = await req.json().catch(() => ({}))
    const { status } = body

    // Valider le status
    const validStatuses = ['connected', 'busy', 'dnd', 'offline']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be one of: connected, busy, dnd, offline' }, { status: 400 })
    }

    // Préparer les données de mise à jour
    const updateData: { status: string; last_seen_at?: string } = {
      status,
    }

    // Mettre à jour last_seen_at si le statut est 'connected'
    if (status === 'connected') {
      updateData.last_seen_at = new Date().toISOString()
    }

    // Essayer d'abord avec le client utilisateur normal (via RLS policy)
    // La policy RLS "Users can update own status" permet la mise à jour
    // si auth_user_id = auth.uid() ou id = get_current_user_id()
    // On cherche d'abord par auth_user_id (plus rapide avec l'index)
    let userRecord: { id: string; auth_user_id: string | null } | null = null
    let findError: any = null

    // Essayer par auth_user_id d'abord
    const { data: userByAuthId, error: errorByAuthId } = await supabase
      .from('users')
      .select('id, auth_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (!errorByAuthId && userByAuthId) {
      userRecord = userByAuthId
    } else if (userEmail) {
      // Fallback: chercher par email
      const { data: userByEmail, error: errorByEmail } = await supabase
        .from('users')
        .select('id, auth_user_id')
        .eq('email', userEmail)
        .maybeSingle()

      if (!errorByEmail && userByEmail) {
        userRecord = userByEmail
      } else {
        findError = errorByEmail
      }
    } else {
      findError = errorByAuthId
    }

    if (!findError && userRecord) {
      // Mettre à jour via le client utilisateur normal (RLS policy appliquée)
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userRecord.id)

      if (!updateError) {
        // Succès ! Synchroniser auth_user_id en arrière-plan si nécessaire
        if (!userRecord.auth_user_id && supabaseAdmin) {
          void (async () => {
            try {
              await supabaseAdmin
                .from('users')
                .update({ auth_user_id: userId })
                .eq('id', userRecord.id)
            } catch {
              // Ignore les erreurs silencieusement
            }
          })()
        }
        return NextResponse.json({ success: true, status })
      }

      // Si l'update échoue (RLS bloque), essayer avec supabaseAdmin en fallback
      console.warn(`[api/auth/status] RLS update failed, trying admin fallback:`, updateError.message)
    }

    // Fallback: utiliser supabaseAdmin si RLS bloque ou si l'utilisateur n'est pas trouvé
    // (peut arriver si auth_user_id n'est pas encore synchronisé)
    if (!supabaseAdmin) {
      console.error('[api/auth/status] supabaseAdmin not available and RLS update failed')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Trouver l'utilisateur via email avec supabaseAdmin
    let publicUserId: string | null = null
    if (userEmail) {
      const { data: userResult, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, auth_user_id')
        .eq('email', userEmail)
        .maybeSingle()

      if (!userError && userResult?.id) {
        publicUserId = userResult.id
        // Synchroniser auth_user_id si nécessaire
        if (!userResult.auth_user_id) {
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

    // Mettre à jour avec supabaseAdmin (bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', publicUserId)

    if (updateError) {
      console.error(`[api/auth/status] Update error for user ${publicUserId}:`, updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (e: any) {
    console.error('[api/auth/status] Unexpected error:', e?.message)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
