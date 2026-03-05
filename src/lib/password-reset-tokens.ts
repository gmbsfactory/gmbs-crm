import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Crée un token custom de reset password en base de données.
 * Le token est réutilisable pendant 24h et n'est invalidé que quand
 * le mot de passe est effectivement changé.
 *
 * @returns Le lien /reset/[token] complet, ou null en cas d'erreur.
 */
export async function createPasswordResetToken(
  userId: string,
  siteUrl: string
): Promise<{ resetLink: string; token: string } | null> {
  if (!supabaseAdmin) {
    console.error('[password-reset-tokens] supabaseAdmin is null')
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('password_reset_tokens')
    .insert({ user_id: userId })
    .select('token')
    .single()

  if (error || !data?.token) {
    console.error('[password-reset-tokens] Token creation failed:', error?.message)
    return null
  }

  return {
    token: data.token,
    resetLink: `${siteUrl}/reset/${data.token}`,
  }
}

/**
 * Construit le siteUrl à partir des headers de la requête.
 */
export function getSiteUrlFromRequest(request: Request): string {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  return host
    ? `${protocol}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
}
