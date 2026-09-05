import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/artisans/{id}/dossier/validate  (permission `write_artisans`)
 *
 * Pose `artisans.dossier_validated_by` — le gestionnaire qui endosse le dossier.
 * → `200 { artisan:{ statut_dossier, pieces_a_verifier, dossier_validated_at, dossier_validated_by } }`.
 *
 * **`dossier_validated_at` n'est pas écrit ici** : c'est `trg_artisan_dossier_sync`
 * (99078) qui le pose au premier passage à `COMPLET` et l'efface si le dossier
 * redevient incomplet. Deux écrivains sur la même colonne, sur une table publiée
 * en temps réel, c'est le doublon d'écriture que le socle a précisément retiré.
 *
 * `409` tant que le dossier n'est pas `COMPLET` : valider un dossier auquel il
 * manque une pièce validée rendrait le badge menteur, ce que corrige justement
 * `calculate_artisan_dossier_status`.
 */
export async function POST(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'write_artisans')
  if (isPermissionError(permCheck)) return permCheck.error
  const reviewer = permCheck.user

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Artisan ID is required' }, { status: 400 })

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: existing, error: readError } = await supabase
      .from('artisans')
      .select('id, statut_dossier, pieces_a_verifier, dossier_validated_at')
      .eq('id', id)
      .maybeSingle()

    if (readError) {
      console.error('[artisans/dossier/validate] Lecture échouée :', readError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!existing) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const artisan = existing as {
      statut_dossier: string | null
      pieces_a_verifier: number | null
      dossier_validated_at: string | null
    }

    if (artisan.statut_dossier !== 'COMPLET') {
      return NextResponse.json(
        { error: 'Le dossier ne peut être validé que lorsque les 5 pièces requises sont validées' },
        { status: 409 },
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('artisans')
      .update({ dossier_validated_by: reviewer.id })
      .eq('id', id)
      .select('statut_dossier, pieces_a_verifier, dossier_validated_at, dossier_validated_by')
      .single()

    if (updateError || !updated) {
      console.error('[artisans/dossier/validate] Mise à jour échouée :', updateError?.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ artisan: updated })
  } catch (error) {
    console.error('[artisans/dossier/validate] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
