import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  BILAN_S1_PAGE_KEY,
  canViewBilan,
  isDevUser,
  sanitizeVisibilityRequest,
} from "@/lib/bilan-s1/visibility-core"
import { loadBilanVisibility } from "@/lib/bilan-s1/visibility-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/bilan-s1/visibility — pour tout utilisateur authentifié.
 * Retourne canView (gate page + sidebar) ; la configuration complète n'est
 * renvoyée qu'aux devs (seuls habilités à la modifier).
 */
export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { config } = await loadBilanVisibility()
  const isDev = isDevUser(user.roles)

  return NextResponse.json({
    canView: canViewBilan(user, config, Date.now()),
    isDev,
    config: isDev ? config : undefined,
  })
}

/**
 * PUT /api/bilan-s1/visibility — devs uniquement.
 * Body : { roles: string[], userIds: string[], temporary: boolean, hours?: number }.
 * Prend effet immédiatement (les clients repollent la visibilité).
 */
export async function PUT(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  if (!isDevUser(user.roles)) {
    return NextResponse.json({ error: "Réservé aux développeurs" }, { status: 403 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Client admin non configuré" }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }

  const sanitized = sanitizeVisibilityRequest(body, Date.now())
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from("page_visibility").upsert(
    {
      page_key: BILAN_S1_PAGE_KEY,
      allowed_roles: sanitized.allowedRoles,
      allowed_user_ids: sanitized.allowedUserIds,
      expires_at: sanitized.expiresAt,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_key" }
  )

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "Table page_visibility absente : appliquer la migration 99062 (supabase db push)" },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { config } = await loadBilanVisibility()
  return NextResponse.json({ ok: true, config })
}
