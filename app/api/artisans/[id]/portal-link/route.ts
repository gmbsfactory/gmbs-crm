import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { hashPortalToken } from '@/lib/portal-external/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** Durée de validité d'un lien portail. */
const TOKEN_TTL_DAYS = 30

/** Origine du portail ; repli local pour la démo si la variable manque. */
function portalBaseUrl(): string {
  const configured = process.env.PORTAL_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  console.warn('[portal-link] PORTAL_BASE_URL absent : repli sur http://localhost:3001')
  return 'http://localhost:3001'
}

/**
 * POST /api/artisans/{id}/portal-link  (permission write_artisans)
 * Génère un nouveau lien `${PORTAL_BASE_URL}/t/<token>` : 32 octets aléatoires
 * en hexadécimal, seul le SHA-256 est stocké ; les jetons précédents de
 * l'artisan sont désactivés ; expiration à +30 jours.
 */
export async function POST(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_artisans')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id: artisanId } = await params
  if (!artisanId) return NextResponse.json({ error: 'Artisan ID is required' }, { status: 400 })

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: artisan, error: artisanError } = await supabase
      .from('artisans')
      .select('id, is_active')
      .eq('id', artisanId)
      .maybeSingle()
    if (artisanError) {
      console.error('[portal-link] Lecture de l\'artisan échouée :', artisanError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })
    if (artisan.is_active === false) {
      return NextResponse.json({ error: 'Artisan désactivé : aucun lien ne peut être généré' }, { status: 409 })
    }

    const token = randomBytes(32).toString('hex')
    const tokenHash = hashPortalToken(token)
    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { error: deactivateError } = await supabase
      .from('artisan_portal_tokens')
      .update({ is_active: false })
      .eq('artisan_id', artisanId)
      .eq('is_active', true)
    if (deactivateError) {
      console.error('[portal-link] Désactivation des anciens jetons échouée :', deactivateError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const { error: insertError } = await supabase.from('artisan_portal_tokens').insert({
      artisan_id: artisanId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      is_active: true,
    })
    if (insertError) {
      console.error('[portal-link] Création du jeton échouée :', insertError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ url: `${portalBaseUrl()}/t/${token}`, expires_at: expiresAt })
  } catch (error) {
    console.error('[portal-link] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
