import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
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

    // Trouver l'utilisateur dans public.users via auth_user_mapping ou email
    let publicUserId: string | null = null

    // Essayer via auth_user_mapping
    const { data: mappingResult } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (mappingResult?.public_user_id) {
      publicUserId = mappingResult.public_user_id
    } else if (userEmail) {
      // Fallback: chercher par email
      const { data: userResult } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle()

      if (userResult?.id) {
        publicUserId = userResult.id
        // Créer le mapping en arrière-plan (non-bloquant)
        void (async () => {
          try {
            await supabase
              .from('auth_user_mapping')
              .insert({ auth_user_id: userId, public_user_id: publicUserId })
          } catch {
            // Ignore les erreurs silencieusement
          }
        })()
      }
    }

    if (!publicUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Préparer les données de mise à jour
    const updateData: { status: string; last_seen_at?: string } = {
      status,
    }

    // Mettre à jour last_seen_at si le statut est 'connected'
    if (status === 'connected') {
      updateData.last_seen_at = new Date().toISOString()
    }

    // Mettre à jour le statut dans la base de données
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', publicUserId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
