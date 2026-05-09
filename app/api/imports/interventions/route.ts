import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { interventionsImportApi } from '@/lib/api'
import { ImportAbortedError, type ImportProgressEvent } from '@/lib/api/interventions/interventions-import'
import type { ImportMode } from '@/utils/import-export/import-types'

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

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Le champ "file" est manquant' }, { status: 400 })
  }
  if (!VALID_MODES.includes(mode as ImportMode)) {
    return NextResponse.json(
      { error: `Mode invalide : "${mode}" (attendu : create | update | upsert)` },
      { status: 400 },
    )
  }

  const content = await (file as Blob).text()
  const supabase = await createSSRServerClient()

  if (!stream) {
    const result = await interventionsImportApi.runImport(supabase, {
      content,
      mode: mode as ImportMode,
      dryRun,
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
