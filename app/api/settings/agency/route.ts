import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"

export const runtime = "nodejs"

/**
 * GET /api/settings/agency
 * Récupère toutes les agences actives
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .select('id, code, label, region, color, is_active, created_at, updated_at')
      .eq('is_active', true) // Seules les agences actives
      .order('label', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agencies: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/agency
 * Crée une nouvelle agence
 * Le code est généré automatiquement à partir du label
 */
export async function POST(req: Request) {
  // Check permission: manage_settings to create agencies
  const permCheck = await requirePermission(req, "manage_settings")
  if (isPermissionError(permCheck)) return permCheck.error

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { label, region, color } = body

    // Validation
    if (!label || label.trim() === '') {
      return NextResponse.json(
        { error: 'Le label de l\'agence est requis' },
        { status: 400 }
      )
    }

    // Générer le code automatiquement à partir du label
    const code = label
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')

    if (!code) {
      return NextResponse.json(
        { error: 'Impossible de générer un code valide à partir du label' },
        { status: 400 }
      )
    }

    // Vérifier si le code existe déjà
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate_code' },
        { status: 409 }
      )
    }

    // Créer l'agence
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .insert({
        code,
        label: label.trim(),
        region: region?.trim() || null,
        color: color || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      // Gérer les erreurs de duplicata (au cas où)
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'duplicate_code' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      code: data.code,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
