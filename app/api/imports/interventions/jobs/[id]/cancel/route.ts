import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { importJobsApi } from '@/lib/api/interventions/import-jobs'

export const runtime = 'nodejs'

/**
 * POST /api/imports/interventions/jobs/:id/cancel
 * Demande l'annulation d'un job. N'a d'effet que sur un job pending/running.
 * Le worker observe le changement de statut entre deux chunks et interrompt
 * le traitement (les chunks déjà commités restent appliqués — pas de rollback
 * global, cf. doc §11).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permCheck = await requirePermission(req, 'import_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  const supabase = await createSSRServerClient()

  try {
    await importJobsApi.cancel(supabase, id)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}
