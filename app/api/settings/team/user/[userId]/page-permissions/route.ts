import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

type Params = { params: { userId?: string } }

const normalizeEntries = (raw: any): Array<{ page_key: string; has_access: boolean }> => {
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const key = typeof item?.page_key === "string" ? item.page_key.trim().toLowerCase() : null
        const hasAccess = typeof item?.has_access === "boolean" ? item.has_access : Boolean(item?.hasAccess)
        return key ? { page_key: key, has_access: hasAccess } : null
      })
      .filter((entry): entry is { page_key: string; has_access: boolean } => Boolean(entry))
  }

  if (typeof raw === "object") {
    return Object.entries(raw)
      .map(([key, value]) => {
        if (typeof key !== "string") return null
        const normalizedKey = key.trim().toLowerCase()
        if (!normalizedKey) return null
        return { page_key: normalizedKey, has_access: Boolean(value) }
      })
      .filter((entry): entry is { page_key: string; has_access: boolean } => Boolean(entry?.page_key))
  }

  return []
}

export async function GET(_req: Request, { params }: Params) {
  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  const userId = params?.userId
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from("user_page_permissions")
    .select("page_key, has_access")
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const permissions = (data || []).reduce((acc: Record<string, boolean>, perm: any) => {
    if (perm?.page_key) {
      const key = String(perm.page_key).toLowerCase()
      acc[key] = perm.has_access !== false
    }
    return acc
  }, {})

  return NextResponse.json({ permissions })
}

export async function POST(req: Request, { params }: Params) {
  if (!supabaseAdmin) return NextResponse.json({ error: "No DB" }, { status: 500 })
  const userId = params?.userId
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const entries = normalizeEntries(body.permissions ?? body.page_permissions ?? body)

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, permissions: {} })
  }

  const payload = entries.map((entry) => ({
    user_id: userId,
    page_key: entry.page_key,
    has_access: entry.has_access,
  }))

  const { error } = await supabaseAdmin
    .from("user_page_permissions")
    .upsert(payload, { onConflict: "user_id,page_key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const permissions = entries.reduce((acc: Record<string, boolean>, entry) => {
    acc[entry.page_key] = entry.has_access
    return acc
  }, {})

  return NextResponse.json({ ok: true, permissions })
}
