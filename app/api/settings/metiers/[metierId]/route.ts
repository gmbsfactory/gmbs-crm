import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * PATCH /api/settings/metiers/[metierId]
 * Met à jour un métier
 * Si le label change, le code sera régénéré automatiquement
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ metierId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { metierId } = await params
    const body = await req.json()
    const { label, description, color } = body

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    // Si le label change, régénérer le code
    if (label !== undefined) {
      if (!label || label.trim() === '') {
        return NextResponse.json(
          { error: 'Le label du métier ne peut pas être vide' },
          { status: 400 }
        )
      }
      updatePayload.label = label.trim()
      updatePayload.code = label
        .substring(0, 10)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
    }

    if (description !== undefined) {
      updatePayload.description = description?.trim() || null
    }

    if (color !== undefined) {
      updatePayload.color = color || null
    }

    const { data, error } = await supabaseAdmin
      .from('metiers')
      .update(updatePayload)
      .eq('id', metierId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'duplicate_code' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, metier: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/metiers/[metierId]
 * Soft delete - Désactive un métier (is_active = false)
 * Ne supprime JAMAIS physiquement pour préserver les relations
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ metierId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { metierId } = await params

    const { data, error } = await supabaseAdmin
      .from('metiers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', metierId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Métier désactivé avec succès',
      metier: data,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
