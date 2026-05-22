import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { interventionsImportApi } from '@/lib/api'
import {
  ImportAbortedError,
  type ImportProgressEvent,
} from '@/lib/api/interventions/interventions-import'
import { importJobsApi } from '@/lib/api/interventions/import-jobs'

export const runtime = 'nodejs'
// Le worker traite l'import complet dans cette invocation. On demande le
// budget maximum nodejs (clampé au plafond du plan Vercel).
export const maxDuration = 300

// Intervalle minimum entre deux écritures de progression. Sans throttle, un
// gros import déclencherait des centaines d'UPDATE/s → fan-out Realtime massif.
const PROGRESS_THROTTLE_MS = 500

/**
 * POST /api/imports/interventions/jobs/:id/run
 *
 * Worker server-to-server, déclenché par self-fetch depuis la route de
 * création. Protégé par un secret partagé (`WORKER_SECRET`) — ce n'est pas un
 * endpoint utilisateur. Utilise le client admin (service-role) : pas de cookie
 * de session ici, et la permission a déjà été vérifiée à la création du job.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = process.env.WORKER_SECRET
  if (!secret || req.headers.get('x-worker-secret') !== secret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = supabaseAdmin
  if (!admin) {
    return NextResponse.json(
      { error: 'Client admin indisponible (SUPABASE_SERVICE_ROLE_KEY manquant)' },
      { status: 500 },
    )
  }

  const { id } = await params

  // Transition atomique pending → running. Zéro ligne = job déjà pris (double
  // dispatch, retry) ou inexistant → no-op idempotent.
  let claimed
  try {
    claimed = await importJobsApi.claim(admin, id)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: 'job déjà pris ou introuvable' }, { status: 200 })
  }

  // Recharge le contenu CSV (non inclus dans `claim`, qui n'expose pas
  // csv_content).
  const job = await importJobsApi.getForWorker(admin, id)
  if (!job) {
    await importJobsApi.fail(admin, id, 'Job introuvable après claim')
    return NextResponse.json({ error: 'Job introuvable' }, { status: 404 })
  }

  const controller = new AbortController()
  let lastFlush = 0
  let aborting = false

  // Écrit la progression de façon throttlée et détecte une demande
  // d'annulation (status passé à 'cancelled' par l'utilisateur).
  const flushProgress = async (patch: {
    stage?: string
    total_rows?: number
    processed_rows?: number
  }) => {
    if (aborting) return
    try {
      const { status } = await importJobsApi.patchProgress(admin, id, patch)
      if (status === 'cancelled') {
        aborting = true
        controller.abort()
      }
    } catch (e) {
      // Une erreur de progression ne doit pas faire échouer l'import lui-même.
      console.error('[import-worker] patchProgress failed:', e)
    }
  }

  const onProgress = (event: ImportProgressEvent) => {
    const now = Date.now()
    const patch = mapEventToPatch(event)
    // On flush toujours les jalons (stages sans compteur) ; on throttle les
    // mises à jour de compteur (validating / persisting) qui sont fréquentes.
    const isMilestone = event.stage === 'parsing' || event.stage === 'lookup'
    if (isMilestone || now - lastFlush >= PROGRESS_THROTTLE_MS) {
      lastFlush = now
      void flushProgress(patch)
    }
  }

  try {
    const result = await interventionsImportApi.runImport(admin, {
      content: job.csv_content,
      mode: job.mode,
      dryRun: job.dry_run,
      resolutions: job.resolutions ?? undefined,
      onProgress,
      signal: controller.signal,
    })
    await importJobsApi.finish(admin, id, result)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    if (e instanceof ImportAbortedError) {
      // L'utilisateur a annulé : la ligne est déjà en statut 'cancelled'
      // (posé par /cancel). Rien à clôturer.
      return NextResponse.json({ ok: true, cancelled: true }, { status: 200 })
    }
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[import-worker] runImport failed:', reason, e)
    await importJobsApi.fail(admin, id, reason)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}

/** Traduit un évènement de progression `runImport` en patch de la ligne job. */
function mapEventToPatch(event: ImportProgressEvent): {
  stage?: string
  total_rows?: number
  processed_rows?: number
} {
  switch (event.stage) {
    case 'parsing':
      return { stage: 'parsing' }
    case 'parsed':
      return { stage: 'parsing', total_rows: event.rowCount }
    case 'validating':
      return { stage: 'validating', processed_rows: event.done, total_rows: event.total }
    case 'lookup':
      return { stage: 'lookup' }
    case 'persisting':
      return { stage: 'persisting', processed_rows: event.done, total_rows: event.total }
    default:
      return {}
  }
}
