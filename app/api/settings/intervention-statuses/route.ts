import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * GET /api/settings/intervention-statuses
 * Récupère tous les statuts d'intervention actifs
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ statuses: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

// PAS de POST - les statuts ne peuvent pas être créés via l'API
// Ils doivent être gérés manuellement dans la seed pour préserver les règles de workflow
