import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * PATCH /api/settings/agency/[agencyId]
 * Met à jour une agence
 * Si le label change, le code est régénéré automatiquement
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { agencyId } = await params
    const body = await req.json()
    const { label, region, color } = body

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    // Si le label change, régénérer le code
    if (label !== undefined) {
      if (!label || label.trim() === '') {
        return NextResponse.json(
          { error: 'Le label de l\'agence ne peut pas être vide' },
          { status: 400 }
        )
      }

      updatePayload.label = label.trim()
      updatePayload.code = label
        .substring(0, 10)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')

      if (!updatePayload.code) {
        return NextResponse.json(
          { error: 'Impossible de générer un code valide à partir du label' },
          { status: 400 }
        )
      }

      // Vérifier si le nouveau code n'est pas déjà utilisé par une autre agence
      const { data: existing } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('code', updatePayload.code)
        .neq('id', agencyId)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'duplicate_code' },
          { status: 409 }
        )
      }
    }

    if (region !== undefined) {
      updatePayload.region = region?.trim() || null
    }

    if (color !== undefined) {
      updatePayload.color = color || null
    }

    // Mettre à jour l'agence
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .update(updatePayload)
      .eq('id', agencyId)
      .select()
      .single()

    if (error) {
      // Gérer les erreurs de duplicata
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
      code: data?.code,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/agency/[agencyId]
 * Soft delete - Désactive une agence (is_active = false)
 * Ne supprime JAMAIS physiquement l'agence pour préserver les relations
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { agencyId } = await params

    // Soft delete : mettre is_active à false
    const { data, error } = await supabaseAdmin
      .from('agencies')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agencyId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Agency soft deleted',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
