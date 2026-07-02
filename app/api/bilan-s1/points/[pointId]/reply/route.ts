import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { canViewBilan } from "@/lib/bilan-s1/visibility-core"
import { loadBilanVisibility } from "@/lib/bilan-s1/visibility-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_REPLY_LENGTH = 4000

/**
 * POST /api/bilan-s1/points/[pointId]/reply — ajoute une réponse horodatée au
 * point (auteur = utilisateur connecté) et passe le point en « Répondu ».
 * Accessible aux devs et aux rôles/utilisateurs ouverts via la visibilité.
 */
export async function POST(req: Request, { params }: { params: Promise<{ pointId: string }> }) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  const { config } = await loadBilanVisibility()
  if (!canViewBilan(user, config, Date.now())) {
    return NextResponse.json({ error: "Réservé aux développeurs" }, { status: 403 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Client admin non configuré" }, { status: 500 })
  }

  const { pointId } = await params
  if (!UUID_RE.test(pointId)) {
    return NextResponse.json({ error: "Identifiant de point invalide" }, { status: 400 })
  }

  let body: { body?: unknown }
  try {
    body = (await req.json()) as { body?: unknown }
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 })
  }
  const text = typeof body.body === "string" ? body.body.trim() : ""
  if (!text) {
    return NextResponse.json({ error: "La réponse est vide" }, { status: 400 })
  }
  if (text.length > MAX_REPLY_LENGTH) {
    return NextResponse.json({ error: `Réponse trop longue (max ${MAX_REPLY_LENGTH} caractères)` }, { status: 400 })
  }

  const { error: insertError } = await supabaseAdmin.from("bilan_point_replies").insert({
    point_id: pointId,
    user_id: user.id,
    body: text,
  })
  if (insertError) {
    if (insertError.code === "23503") {
      return NextResponse.json({ error: "Point introuvable" }, { status: 404 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Première réponse (ou suivantes) → le point est considéré « Répondu »
  const { error: updateError } = await supabaseAdmin
    .from("bilan_points")
    .update({ statut: "repondu", updated_at: new Date().toISOString() })
    .eq("id", pointId)
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
