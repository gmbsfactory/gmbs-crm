import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { interventionsImportApi } from '@/lib/api'
import { ImportAbortedError, type ImportProgressEvent } from '@/lib/api/interventions/interventions-import'
import type { ImportMode, ImportResolutionsMap } from '@/utils/import-export/import-types'

export const runtime = 'nodejs'

const VALID_MODES: ImportMode[] = ['create', 'update', 'upsert']

// Format de stream : NDJSON (un objet JSON par ligne).
// Évènements possibles :
//   { type: 'progress', event: ImportProgressEvent }
//   { type: 'done', body: ImportResponse }
//   { type: 'error', error: string, status?: number }
//   { type: 'aborted' }

export async function POST(req: NextRequest) {
  const permCheck = await requirePermission(req, 'import_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const formData = await req.formData()
  const file = formData.get('file')
  const mode = (formData.get('mode') as string | null) ?? 'upsert'
  const dryRun = String(formData.get('dry_run') ?? 'false') === 'true'
  // L'ancien comportement (réponse JSON unique) reste accessible pour les
  // appels programmatiques / tests qui n'ont pas besoin de progression.
  const stream = String(formData.get('stream') ?? 'false') === 'true'
  const resolutionsRaw = formData.get('resolutions')

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Le champ "file" est manquant' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode as ImportMode)) {
    return NextResponse.json(
      { error: `Mode invalide : "${mode}" (attendu : create | update | upsert)` },
      { status: 400 },
    )
  }

  // Phase B : parsing des résolutions manuelles. Le format attendu est un JSON
  // sérialisé `{ "<line>": { "action": "update", "targetId": "<uuid>" } }`.
  // Une entrée mal formée → 400 ; absence du champ → pas de résolutions.
  let resolutions: ImportResolutionsMap | undefined
  if (typeof resolutionsRaw === 'string' && resolutionsRaw.trim() !== '') {
    try {
      const parsed = JSON.parse(resolutionsRaw) as unknown
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
      resolutions = out
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      return NextResponse.json(
        { error: `Champ "resolutions" invalide : ${reason}` },
        { status: 400 },
      )
    }
  }

  const content = await (file as Blob).text()
  const supabase = await createSSRServerClient()

  if (!stream) {
    const result = await interventionsImportApi.runImport(supabase, {
      content,
      mode: mode as ImportMode,
      dryRun,
      resolutions,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.body, { status: 200 })
  }

  // Mode streaming : on retourne un ReadableStream NDJSON.
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      try {
        const result = await interventionsImportApi.runImport(supabase, {
          content,
          mode: mode as ImportMode,
          dryRun,
          resolutions,
          signal: req.signal,
          onProgress: (event: ImportProgressEvent) => {
            write({ type: 'progress', event })
          },
        })

        if (!result.ok) {
          write({ type: 'error', error: result.error, status: result.status })
        } else {
          write({ type: 'done', body: result.body })
        }
      } catch (e) {
        if (e instanceof ImportAbortedError) {
          write({ type: 'aborted' })
        } else {
          const reason = e instanceof Error ? e.message : String(e)
          write({ type: 'error', error: reason, status: 500 })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
