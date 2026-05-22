import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { importJobsApi } from '@/lib/api/interventions/import-jobs'

export const runtime = 'nodejs'

/**
 * GET /api/imports/interventions/jobs/:id
 * Lit l'état d'un job (fallback de polling si Realtime indisponible). RLS
 * garantit que l'utilisateur ne lit que ses propres jobs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const permCheck = await requirePermission(req, 'import_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  const supabase = await createSSRServerClient()

  try {
    const job = await importJobsApi.get(supabase, id)
    if (!job) return NextResponse.json({ error: 'Job introuvable' }, { status: 404 })
    return NextResponse.json({ job }, { status: 200 })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}
