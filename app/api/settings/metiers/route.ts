import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * GET /api/settings/metiers
 * Récupère tous les métiers actifs
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('metiers')
      .select('id, code, label, description, color, is_active, created_at, updated_at')
      .eq('is_active', true) // Seuls les métiers actifs
      .order('label', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ metiers: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/metiers
 * Crée un nouveau métier
 * Le code est généré automatiquement à partir du label
 */
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { label, description, color } = body

    // Validation
    if (!label || label.trim() === '') {
      return NextResponse.json(
        { error: 'Le label du métier est requis' },
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
      .from('metiers')
      .select('id')
      .eq('code', code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate_code' },
        { status: 409 }
      )
    }

    // Créer le métier
    const { data, error } = await supabaseAdmin
      .from('metiers')
      .insert({
        code,
        label: label.trim(),
        description: description?.trim() || null,
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
