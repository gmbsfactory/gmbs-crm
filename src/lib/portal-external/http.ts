import { NextResponse } from 'next/server'
import { portalError } from './auth'
import { MAX_BASE64_LENGTH } from './uploads'

/**
 * Taille maximale d'un corps JSON (6 Mo) : 4 Mo de base64 plus l'enveloppe JSON.
 * Vérifiée sur `Content-Length` AVANT `request.json()` pour qu'un corps énorme ne
 * soit jamais lu ni parsé en mémoire.
 */
export const MAX_JSON_BODY_BYTES = MAX_BASE64_LENGTH + 2 * 1024 * 1024

/**
 * Lecture tolérante d'un corps JSON :
 * - 413 « Payload too large » si `Content-Length` dépasse le plafond ;
 * - 400 « Invalid JSON » si illisible ou si ce n'est pas un objet.
 */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    return { ok: false, response: portalError(413, 'Payload too large') }
  }
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
