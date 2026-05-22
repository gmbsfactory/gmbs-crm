import { NextRequest, NextResponse, after } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { importJobsApi } from '@/lib/api/interventions/import-jobs'
import type { ImportMode, ImportResolutionsMap } from '@/utils/import-export/import-types'

export const runtime = 'nodejs'

const VALID_MODES: ImportMode[] = ['create', 'update', 'upsert']

// Limite de taille du CSV (cohérente avec l'UI : MAX_FILE_MB = 10).
const MAX_CSV_BYTES = 10 * 1024 * 1024

/**
 * Origine à utiliser pour le self-fetch vers la route worker. `req.nextUrl.origin`
 * peut être erroné derrière certains proxys / sur les preview deployments Vercel,
 * d'où la chaîne de fallback explicite par variables d'environnement.
 */
function workerOrigin(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return req.nextUrl.origin
}

/**
 * Parse le champ `resolutions` (JSON sérialisé) du formulaire. Même format et
 * mêmes validations que l'endpoint synchrone legacy. Lève une Error décrivant
 * le problème (transformée en 400 par l'appelant).
 */
function parseResolutions(raw: unknown): ImportResolutionsMap | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('attendu : objet { line: { action, targetId } }')
  }
  const out: ImportResolutionsMap = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const line = Number(k)
    if (!Number.isInteger(line) || line <= 0) throw new Error(`clé "${k}" invalide`)
    if (!v || typeof v !== 'object') throw new Error(`valeur ligne ${k} invalide`)
    const obj = v as Record<string, unknown>
    if (obj.action === 'skip') {
      out[line] = { action: 'skip' }
    } else if (obj.action === 'create_without_id_inter') {
      out[line] = { action: 'create_without_id_inter' }
    } else if (obj.action === 'update') {
      if (typeof obj.targetId !== 'string' || obj.targetId.length === 0) {
        throw new Error(`targetId manquant pour la ligne ${k}`)
      }
      out[line] = { action: 'update', targetId: obj.targetId }
    } else {
      throw new Error(`action "${String(obj.action)}" non supportée`)
    }
  }
  return out
}

/**
 * POST /api/imports/interventions/jobs
 * Crée un job d'import et déclenche le worker en arrière-plan (self-fetch
 * fire-and-forget). Répond 202 { job_id } immédiatement.
 */
export async function POST(req: NextRequest) {
  const permCheck = await requirePermission(req, 'import_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const formData = await req.formData()
  const file = formData.get('file')
  const mode = (formData.get('mode') as string | null) ?? 'upsert'
  const dryRun = String(formData.get('dry_run') ?? 'false') === 'true'

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Le champ "file" est manquant' }, { status: 400 })
  }
  if (file.size > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (max ${MAX_CSV_BYTES / 1024 / 1024} Mo)` },
      { status: 413 },
    )
  }
  if (!VALID_MODES.includes(mode as ImportMode)) {
    return NextResponse.json(
      { error: `Mode invalide : "${mode}" (attendu : create | update | upsert)` },
      { status: 400 },
    )
  }

  let resolutions: ImportResolutionsMap | undefined
  try {
    resolutions = parseResolutions(formData.get('resolutions'))
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Champ "resolutions" invalide : ${reason}` }, { status: 400 })
  }

  const supabase = await createSSRServerClient()
  // `created_by` référence auth.users(id) et la policy RLS exige
  // `created_by = auth.uid()` → on a besoin de l'auth uid, pas du user public.
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const content = await (file as Blob).text()

  let jobId: string
  try {
    const job = await importJobsApi.create(supabase, {
      csvContent: content,
      mode: mode as ImportMode,
      dryRun,
      resolutions,
      createdBy: authData.user.id,
    })
    jobId = job.id
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: reason }, { status: 500 })
  }

  // Déclenchement du worker en arrière-plan. CRUCIAL : on passe par `after()`
  // (next/server). Un simple `void fetch(...)` après le `return` ne part PAS de
  // façon fiable sur Vercel — la fonction serverless se termine avant l'envoi,
  // et le job resterait coincé en 'pending'. `after()` garantit l'exécution
  // après la réponse, dans le cycle de vie de la requête.
  const secret = process.env.WORKER_SECRET
  if (secret) {
    after(async () => {
      try {
        await fetch(`${workerOrigin(req)}/api/imports/interventions/jobs/${jobId}/run`, {
          method: 'POST',
          headers: { 'x-worker-secret': secret },
        })
      } catch (e) {
        console.error('[import-jobs] worker dispatch failed:', e)
      }
    })
  } else {
    console.error('[import-jobs] WORKER_SECRET manquant — le worker ne sera pas déclenché')
  }

  return NextResponse.json({ job_id: jobId }, { status: 202 })
}

/**
 * GET /api/imports/interventions/jobs
 * Historique des imports de l'utilisateur courant (RLS).
 */
export async function GET(req: NextRequest) {
  const permCheck = await requirePermission(req, 'import_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const supabase = await createSSRServerClient()
  const limitParam = Number(req.nextUrl.searchParams.get('limit'))
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

  try {
    const jobs = await importJobsApi.list(supabase, { limit })
    return NextResponse.json({ jobs }, { status: 200 })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}
