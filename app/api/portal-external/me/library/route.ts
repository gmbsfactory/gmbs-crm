import { NextResponse } from 'next/server'
import { authenticatePortalRequest } from '@/lib/portal-external/auth'
import { portalInternalError } from '@/lib/portal-external/http'
import { listPortalLibrary } from '@/lib/portal-external/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/portal-external/me/library
 *
 * Espace documentaire de l'artisan (§4.2, lot L6) : **les devis qui lui ont été
 * envoyés et ses propres factures**, groupés par mission, avec l'état de
 * paiement de chaque mission terminée.
 *
 * Ce que cette route ne rend jamais : `facturesGMBS` (le prix payé par le
 * client, donc la marge) et `facturesMateriel`. La garde est une liste blanche
 * appliquée deux fois — voir `src/lib/portal-external/library.ts`.
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response

  try {
    const library = await listPortalLibrary(auth.supabase, auth.artisan.id)
    return NextResponse.json(library)
  } catch (error) {
    return portalInternalError('me/library', error)
  }
}
