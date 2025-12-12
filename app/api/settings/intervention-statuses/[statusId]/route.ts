import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * PATCH /api/settings/intervention-statuses/[statusId]
 * Met à jour un statut d'intervention
 * IMPORTANT : Seuls le label et la couleur sont éditables
 * Le code et le sort_order sont en lecture seule
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ statusId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { statusId } = await params
    const body = await req.json()
    const { label, color } = body

    const updatePayload: any = {}

    // Seuls label et color sont modifiables
    if (label !== undefined) {
      if (!label || label.trim() === '') {
        return NextResponse.json(
          { error: 'Le label du statut ne peut pas être vide' },
          { status: 400 }
        )
      }
      updatePayload.label = label.trim()
    }

    if (color !== undefined) {
      updatePayload.color = color || null
    }

    // Vérifier qu'il y a au moins un champ à mettre à jour
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'Aucune donnée à mettre à jour' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('intervention_statuses')
      .update(updatePayload)
      .eq('id', statusId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

// PAS de DELETE - les statuts ne peuvent jamais être supprimés
// Ils sont utilisés dans les règles de workflow et doivent rester actifs
