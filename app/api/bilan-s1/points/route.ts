import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { canViewBilan } from "@/lib/bilan-s1/visibility-core"
import { loadBilanVisibility } from "@/lib/bilan-s1/visibility-server"
import type { BilanPoint, BilanPointReply } from "@/types/bilan-s1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReplyRow = {
  id: string
  body: string
  created_at: string
  users: {
    id: string
    firstname: string | null
    lastname: string | null
    color: string | null
    avatar_url: string | null
  } | null
}

type PointRow = {
  id: string
  ordre: number
  titre: string
  detail: string | null
  origine: string | null
  statut: "a_qualifier" | "repondu"
  bilan_point_replies: ReplyRow[] | null
}

/**
 * GET /api/bilan-s1/points — points à traiter en réunion + réponses (avatars).
 * Accessible aux devs et aux rôles/utilisateurs ouverts via la visibilité.
 */
export async function GET(req: Request) {
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

  const { data, error } = await supabaseAdmin
    .from("bilan_points")
    .select(
      `
      id, ordre, titre, detail, origine, statut,
      bilan_point_replies (
        id, body, created_at,
        users ( id, firstname, lastname, color, avatar_url )
      )
      `
    )
    .order("ordre", { ascending: true })
    .order("created_at", { referencedTable: "bilan_point_replies", ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const points: BilanPoint[] = ((data as unknown as PointRow[]) ?? []).map((row) => ({
    id: row.id,
    ordre: row.ordre,
    titre: row.titre,
    detail: row.detail,
    origine: row.origine,
    statut: row.statut,
    replies: (row.bilan_point_replies ?? []).map(
      (reply): BilanPointReply => ({
        id: reply.id,
        body: reply.body,
        createdAt: reply.created_at,
        user: reply.users
          ? {
              id: reply.users.id,
              firstname: reply.users.firstname,
              lastname: reply.users.lastname,
              color: reply.users.color,
              avatarUrl: reply.users.avatar_url,
            }
          : null,
      })
    ),
  }))

  return NextResponse.json({ points })
}
