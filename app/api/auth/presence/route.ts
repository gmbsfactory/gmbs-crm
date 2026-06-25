import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

const PRESENCE_STATES = new Set(["active", "idle", "offline"])
const PRESENCE_EVENTS = new Set([
  "AUTH_LOGIN",
  "PRESENCE_START",
  "PRESENCE_RESUME",
  "PRESENCE_PING",
  "IDLE_START",
  "PRESENCE_END",
])

function cleanUuid(value: unknown): string | null {
  if (typeof value !== "string") return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function cleanMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const state = typeof body?.state === "string" ? body.state : null
  const event = typeof body?.event === "string" ? body.event : null

  if (!state || !PRESENCE_STATES.has(state)) {
    return NextResponse.json({ error: "Statut de présence invalide" }, { status: 400 })
  }

  if (!event || !PRESENCE_EVENTS.has(event)) {
    return NextResponse.json({ error: "Événement de présence invalide" }, { status: 400 })
  }

  const sessionId = cleanUuid(body?.sessionId)
  const occurredAt = cleanDate(body?.occurredAt)
  const metadata = cleanMetadata(body?.metadata)

  const { data, error } = await (supabaseAdmin as any).rpc("record_user_presence_event", {
    p_user_id: user.id,
    p_state: state,
    p_kind: event,
    p_source: "client",
    p_session_id: sessionId,
    p_metadata: metadata,
    p_occurred_at: occurredAt,
  })

  if (error) {
    console.error("[auth/presence] RPC error:", error.message)
    return NextResponse.json({ error: "Impossible d'enregistrer la présence" }, { status: 500 })
  }

  return NextResponse.json({ success: true, result: data })
}
