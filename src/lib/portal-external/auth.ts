import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

/**
 * Authentification des appels du portail artisans (`app/api/portal-external/**`).
 *
 * Deux niveaux, décrits dans docs/architecture/portail-demo-contrat-api.md §1 :
 *  1. machine à machine : en-têtes `X-GMBS-Key-Id` / `X-GMBS-Secret` comparés en
 *     temps constant aux variables `GMBS_PORTAL_KEY_ID` / `GMBS_PORTAL_SECRET` ;
 *  2. identité de l'artisan : en-tête `X-Portal-Token` (64 hex) haché en SHA-256
 *     et recherché dans `artisan_portal_tokens` (actif, non expiré).
 *
 * Le client Supabase utilisé est le client service_role : aucune policy RLS
 * n'expose ces tables à `anon`/`authenticated`.
 */

export const PORTAL_KEY_ID_HEADER = 'X-GMBS-Key-Id'
export const PORTAL_SECRET_HEADER = 'X-GMBS-Secret'
export const PORTAL_TOKEN_HEADER = 'X-Portal-Token'

/** Jeton attendu : 32 octets aléatoires encodés en hexadécimal. */
const PORTAL_TOKEN_PATTERN = /^[0-9a-f]{64}$/i

export interface PortalArtisan {
  id: string
  prenom: string | null
  nom: string | null
  raison_sociale: string | null
  email: string | null
  telephone: string | null
  statut_dossier: string | null
  statut_code: string | null
}

export type PortalTokenError = 'Token invalid' | 'Token expired' | 'Token revoked'

export type PortalApiValidation =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

export type PortalArtisanResolution =
  | { ok: true; artisan: PortalArtisan; tokenId: string }
  | { ok: false; status: 401; error: PortalTokenError }

/** Réponse d'erreur JSON uniforme `{ error }`. */
export function portalError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status })
}

/** Réponse d'erreur pour un échec d'authentification (portail ou artisan). */
export function portalAuthErrorResponse(result: { status: number; error: string }): NextResponse {
  return portalError(result.status, result.error)
}

/**
 * Comparaison en temps constant de deux chaînes.
 * Ne lève jamais : des longueurs différentes renvoient simplement `false`
 * (après une comparaison factice pour garder un temps de réponse homogène).
 */
export function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

/** SHA-256 hexadécimal d'un jeton (seule forme stockée en base). */
export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex')
}

/**
 * Vérifie les en-têtes machine à machine du portail.
 * - 503 « Portal not configured » si les variables d'environnement manquent ;
 * - 401 « Invalid credentials » si les en-têtes sont absents ou faux.
 */
export function validatePortalApiRequest(request: Request): PortalApiValidation {
  const expectedKeyId = process.env.GMBS_PORTAL_KEY_ID?.trim()
  const expectedSecret = process.env.GMBS_PORTAL_SECRET?.trim()

  if (!expectedKeyId || !expectedSecret) {
    console.error('[portal-external] GMBS_PORTAL_KEY_ID / GMBS_PORTAL_SECRET non configurés')
    return { ok: false, status: 503, error: 'Portal not configured' }
  }

  const keyId = request.headers.get(PORTAL_KEY_ID_HEADER)?.trim() ?? ''
  const secret = request.headers.get(PORTAL_SECRET_HEADER)?.trim() ?? ''

  if (!keyId || !secret) {
    return { ok: false, status: 401, error: 'Invalid credentials' }
  }

  // Les deux comparaisons sont toujours exécutées (pas de court-circuit).
  const keyOk = safeEqual(keyId, expectedKeyId)
  const secretOk = safeEqual(secret, expectedSecret)
  if (!keyOk || !secretOk) {
    return { ok: false, status: 401, error: 'Invalid credentials' }
  }

  return { ok: true }
}

interface TokenRow {
  id: string
  artisan_id: string
  is_active: boolean | null
  expires_at: string | null
  artisan: {
    id: string
    prenom: string | null
    nom: string | null
    raison_sociale: string | null
    email: string | null
    telephone: string | null
    statut_dossier: string | null
    is_active: boolean | null
    statut: StatusRel
  } | null
}

type StatusRel = { code: string | null } | { code: string | null }[] | null

const TOKEN_SELECT = `
  id,
  artisan_id,
  is_active,
  expires_at,
  artisan:artisans!artisan_id (
    id, prenom, nom, raison_sociale, email, telephone, statut_dossier, is_active,
    statut:artisan_statuses!statut_id ( code )
  )
`

function extractStatusCode(statut: StatusRel): string | null {
  if (!statut) return null
  if (Array.isArray(statut)) return statut[0]?.code ?? null
  return statut.code ?? null
}

/**
 * Résout un jeton (en clair) en artisan.
 * Met à jour `last_used_at` quand le jeton est valide.
 */
export async function resolvePortalToken(
  token: string | null | undefined,
  supabase: SupabaseClient = createServerSupabaseAdmin(),
): Promise<PortalArtisanResolution> {
  const raw = (token ?? '').trim()
  if (!PORTAL_TOKEN_PATTERN.test(raw)) {
    return { ok: false, status: 401, error: 'Token invalid' }
  }

  const tokenHash = hashPortalToken(raw)
  const { data, error } = await supabase
    .from('artisan_portal_tokens')
    .select(TOKEN_SELECT)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('[portal-external] Lecture du jeton impossible :', error)
    return { ok: false, status: 401, error: 'Token invalid' }
  }

  const row = data as unknown as TokenRow | null
  if (!row || !row.artisan) {
    return { ok: false, status: 401, error: 'Token invalid' }
  }
  if (row.is_active === false || row.artisan.is_active === false) {
    return { ok: false, status: 401, error: 'Token revoked' }
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, error: 'Token expired' }
  }

  const { error: touchError } = await supabase
    .from('artisan_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
  if (touchError) {
    console.warn('[portal-external] last_used_at non mis à jour :', touchError.message)
  }

  const artisan: PortalArtisan = {
    id: row.artisan.id,
    prenom: row.artisan.prenom,
    nom: row.artisan.nom,
    raison_sociale: row.artisan.raison_sociale,
    email: row.artisan.email,
    telephone: row.artisan.telephone,
    statut_dossier: row.artisan.statut_dossier,
    statut_code: extractStatusCode(row.artisan.statut),
  }

  return { ok: true, artisan, tokenId: row.id }
}

/** Résout l'artisan à partir de l'en-tête `X-Portal-Token` de la requête. */
export async function resolvePortalArtisan(
  request: Request,
  supabase?: SupabaseClient,
): Promise<PortalArtisanResolution> {
  return resolvePortalToken(request.headers.get(PORTAL_TOKEN_HEADER), supabase)
}

export type PortalAuthContext =
  | { ok: true; artisan: PortalArtisan; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

/**
 * Enchaîne les deux vérifications (clé/secret puis jeton) pour les routes `me/**`.
 * Renvoie soit l'artisan et le client service_role, soit la réponse d'erreur à retourner.
 */
export async function authenticatePortalRequest(request: Request): Promise<PortalAuthContext> {
  const apiCheck = validatePortalApiRequest(request)
  if (!apiCheck.ok) {
    return { ok: false, response: portalAuthErrorResponse(apiCheck) }
  }

  const supabase = createServerSupabaseAdmin()
  const resolution = await resolvePortalArtisan(request, supabase)
  if (!resolution.ok) {
    return { ok: false, response: portalAuthErrorResponse(resolution) }
  }

  return { ok: true, artisan: resolution.artisan, supabase }
}

/** Nom d'affichage « Prénom Nom » (repli : raison sociale, puis « Artisan »). */
export function artisanDisplayName(artisan: Pick<PortalArtisan, 'prenom' | 'nom' | 'raison_sociale'>): string {
  const full = [artisan.prenom, artisan.nom].filter(Boolean).join(' ').trim()
  return full || artisan.raison_sociale || 'Artisan'
}
