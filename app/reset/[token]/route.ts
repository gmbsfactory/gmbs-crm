import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * GET /reset/[token]
 * Vérifie un token custom de reset password, génère un lien Supabase à la volée
 * et redirige l'utilisateur vers le flow PKCE standard.
 *
 * Le token custom est réutilisable pendant 24h tant que le mot de passe
 * n'a pas été changé (used_at IS NULL).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const siteUrl = host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')

  const errorRedirect = `${siteUrl}/set-password?error=expired`

  if (!supabaseAdmin) {
    console.error('[reset-token] supabaseAdmin is null')
    return NextResponse.redirect(errorRedirect)
  }

  try {
    // Vérifier le token en base
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenData) {
      console.error('[reset-token] Token not found:', tokenError?.message)
      return NextResponse.redirect(errorRedirect)
    }

    // Vérifier si déjà utilisé
    if (tokenData.used_at) {
      console.warn('[reset-token] Token already used')
      return NextResponse.redirect(errorRedirect)
    }

    // Vérifier l'expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      console.warn('[reset-token] Token expired')
      return NextResponse.redirect(errorRedirect)
    }

    // Récupérer l'email du user
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', tokenData.user_id)
      .maybeSingle()

    if (userError || !userData?.email) {
      console.error('[reset-token] User not found:', userError?.message)
      return NextResponse.redirect(errorRedirect)
    }

    // Générer un nouveau lien Supabase recovery à la volée
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userData.email,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[reset-token] generateLink failed:', linkError?.message)
      return NextResponse.redirect(errorRedirect)
    }

    // Force le redirect_to dans l'action_link (Supabase admin API l'ignore souvent)
    const actionUrl = new URL(linkData.properties.action_link)
    actionUrl.searchParams.set('redirect_to', `${siteUrl}/auth/callback?next=/set-password`)

    return NextResponse.redirect(actionUrl.toString())
  } catch (error: any) {
    console.error('[reset-token] Unexpected error:', error?.message)
    return NextResponse.redirect(errorRedirect)
  }
}
