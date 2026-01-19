import { NextRequest, NextResponse } from 'next/server'
import { getPortalSDK } from '@/lib/gmbs-plugins/portal-sdk'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * POST /api/plugins/portal/generate-link
 * Generate a portal link for an artisan
 */
export async function POST(request: NextRequest) {
  // Verify CRM authentication - try bearer token first, then cookies
  let token = bearerFrom(request)
  if (!token) {
    const cookieStore = await cookies()
    token = cookieStore.get('sb-access-token')?.value || null
  }
  const supabase = createServerSupabase(token || undefined)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sdk = getPortalSDK()
  
  if (!sdk.isConfigured()) {
    return NextResponse.json({ 
      error: 'Portal service not configured' 
    }, { status: 503 })
  }

  let body: { artisanId: string; interventionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { artisanId, interventionId } = body

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId required' }, { status: 400 })
  }

  // Get artisan info from CRM to pass as metadata
  const { data: artisan } = await supabase
    .from('artisans')
    .select('nom, prenom, email, telephone, raison_sociale')
    .eq('id', artisanId)
    .single()

  try {
    const result = await sdk.generatePortalLink({
      artisanId,
      interventionId,
      metadata: artisan ? {
        name: [artisan.prenom, artisan.nom].filter(Boolean).join(' '),
        email: artisan.email || undefined,
        phone: artisan.telephone || undefined,
        company: artisan.raison_sociale || undefined
      } : undefined
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate link'
    console.error('Portal link generation failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
