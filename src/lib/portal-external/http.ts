import { NextResponse } from 'next/server'
import { portalError } from './auth'

/** Lecture tolérante d'un corps JSON : 400 « Invalid JSON » si illisible. */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = (await request.json()) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, response: portalError(400, 'Invalid JSON') }
    }
    return { ok: true, body: body as Record<string, unknown> }
  } catch {
    return { ok: false, response: portalError(400, 'Invalid JSON') }
  }
}

/** Réponse 500 uniforme après journalisation. */
export function portalInternalError(scope: string, error: unknown): NextResponse {
  console.error(`[portal-external] ${scope} :`, error)
  return portalError(500, 'Internal error')
}
