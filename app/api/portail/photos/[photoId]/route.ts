import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"
import { validatePortalToken } from "@/lib/portail/validateToken"

function getServiceSupabase() {
  return createServerSupabaseAdmin()
}

/**
 * PATCH /api/portail/photos/[photoId]
 * Met à jour le commentaire d'une photo
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params
    const body = await request.json()
    const { token, comment } = body

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    const artisanId = await validatePortalToken(token)
    if (!artisanId) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Vérifier que la photo appartient bien à une intervention de cet artisan
    const { data: photo, error: photoError } = await supabase
      .from("intervention_attachments")
      .select("id, intervention_id, metadata")
      .eq("id", photoId)
      .single()

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo introuvable" }, { status: 404 })
    }

    // Vérifier l'accès via intervention_artisans
    const { data: link } = await supabase
      .from("intervention_artisans")
      .select("id")
      .eq("artisan_id", artisanId)
      .eq("intervention_id", photo.intervention_id)
      .single()

    if (!link) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    // Mettre à jour le commentaire
    const existingMetadata = (photo.metadata || {}) as Record<string, any>
    const updatedMetadata = {
      ...existingMetadata,
      comment: comment || null
    }

    const { error: updateError } = await supabase
      .from("intervention_attachments")
      .update({ metadata: updatedMetadata })
      .eq("id", photoId)

    if (updateError) {
      console.error("Erreur mise à jour commentaire:", updateError)
      return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Erreur PATCH photo:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/portail/photos/[photoId]
 * Supprime une photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    const artisanId = await validatePortalToken(token)
    if (!artisanId) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Vérifier que la photo appartient bien à une intervention de cet artisan
    const { data: photo, error: photoError } = await supabase
      .from("intervention_attachments")
      .select("id, intervention_id, storage_path")
      .eq("id", photoId)
      .single()

    if (photoError || !photo) {
      return NextResponse.json({ error: "Photo introuvable" }, { status: 404 })
    }

    // Vérifier l'accès
    const { data: link } = await supabase
      .from("intervention_artisans")
      .select("id")
      .eq("artisan_id", artisanId)
      .eq("intervention_id", photo.intervention_id)
      .single()

    if (!link) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    // Supprimer du storage
    if (photo.storage_path) {
      await supabase.storage
        .from("intervention-attachments")
        .remove([photo.storage_path])
    }

    // Supprimer de la BDD
    const { error: deleteError } = await supabase
      .from("intervention_attachments")
      .delete()
      .eq("id", photoId)

    if (deleteError) {
      console.error("Erreur suppression photo:", deleteError)
      return NextResponse.json({ error: "Erreur suppression" }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Erreur DELETE photo:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
