import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

const DEFAULT_IDLE_MINUTES = 5
const DEFAULT_OFFLINE_MINUTES = 60

function sanitizeMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const n = Math.trunc(value)
  return n === value ? n : null
}

function normalizeSettings(row: any) {
  return {
    idleAfterMinutes: Number(row?.idle_after_minutes ?? DEFAULT_IDLE_MINUTES),
    offlineAfterMinutes: Number(row?.offline_after_minutes ?? DEFAULT_OFFLINE_MINUTES),
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
  }
}

export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({
      idleAfterMinutes: DEFAULT_IDLE_MINUTES,
      offlineAfterMinutes: DEFAULT_OFFLINE_MINUTES,
      updatedAt: null,
      updatedBy: null,
    })
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("crm_presence_settings")
    .select("idle_after_minutes, offline_after_minutes, updated_at, updated_by")
    .eq("id", true)
    .maybeSingle()

  if (error) {
    console.error("[presence-settings] GET error:", error.message)
    return NextResponse.json({ error: "Impossible de charger les réglages de présence" }, { status: 500 })
  }

  return NextResponse.json(normalizeSettings(data))
}

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const canManage = user.roles.some((role) => ["admin", "dev"].includes(role.toLowerCase()))
    || user.permissions.has("manage_settings")

  if (!canManage) {
    return NextResponse.json({ error: "Permission requise : dev/admin" }, { status: 403 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const idleAfterMinutes = sanitizeMinutes(body?.idleAfterMinutes)
  const offlineAfterMinutes = sanitizeMinutes(body?.offlineAfterMinutes)

  if (idleAfterMinutes === null || offlineAfterMinutes === null) {
    return NextResponse.json({ error: "Les seuils doivent être des minutes entières" }, { status: 400 })
  }

  if (idleAfterMinutes < 1 || idleAfterMinutes > 240) {
    return NextResponse.json({ error: "Le seuil d'inactivité doit être compris entre 1 et 240 minutes" }, { status: 400 })
  }

  if (offlineAfterMinutes < 2 || offlineAfterMinutes > 1440 || offlineAfterMinutes <= idleAfterMinutes) {
    return NextResponse.json({ error: "Le seuil hors ligne doit être supérieur au seuil d'inactivité et ne pas dépasser 1440 minutes" }, { status: 400 })
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("crm_presence_settings")
    .upsert({
      id: true,
      idle_after_minutes: idleAfterMinutes,
      offline_after_minutes: offlineAfterMinutes,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("idle_after_minutes, offline_after_minutes, updated_at, updated_by")
    .single()

  if (error) {
    console.error("[presence-settings] PATCH error:", error.message)
    return NextResponse.json({ error: "Impossible d'enregistrer les réglages de présence" }, { status: 500 })
  }

  const { error: refreshError } = await (supabaseAdmin as any).rpc("check_inactive_users")
  if (refreshError) {
    console.warn("[presence-settings] Immediate presence refresh skipped:", refreshError.message)
  }

  return NextResponse.json(normalizeSettings(data))
}
