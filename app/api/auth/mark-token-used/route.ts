import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'

export const runtime = 'nodejs'

/**
 * POST /api/auth/mark-token-used
 * Appelée après un changement de mot de passe réussi.
 * Marque tous les tokens de reset non utilisés de l'utilisateur courant comme utilisés,
 * empêchant tout lien existant de fonctionner.
 */
export async function POST() {
  if (!supabaseAdmin) {
    console.error('[mark-token-used] supabaseAdmin is null')
    return NextResponse.json({ error: 'Configuration serveur invalide' }, { status: 500 })
  }

  try {
    // Récupérer l'utilisateur connecté via la session
    const supabase = await createSSRServerClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()

    if (authError || !auth?.user) {
      console.error('[mark-token-used] No authenticated user:', authError?.message)
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const authUserId = auth.user.id

    // Chercher le public_user_id via le mapping (auth.users.id != public.users.id)
    let publicUserId = authUserId
    const { data: mapping } = await supabaseAdmin
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (mapping?.public_user_id) {
      publicUserId = mapping.public_user_id
    }

    // Marquer tous les tokens non utilisés de cet utilisateur comme utilisés
    const { error: updateError, count } = await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', publicUserId)
      .is('used_at', null)

    if (updateError) {
      console.error('[mark-token-used] Update failed:', updateError.message)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, tokensInvalidated: count ?? 0 })
  } catch (error: any) {
    console.error('[mark-token-used] Unexpected error:', error?.message)
    return NextResponse.json({ error: 'Erreur inattendue' }, { status: 500 })
  }
}
