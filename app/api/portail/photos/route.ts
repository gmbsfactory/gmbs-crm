import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"
import { validatePortalToken, checkArtisanAccessToIntervention } from "@/lib/portail/validateToken"

function getServiceSupabase() {
  return createServerSupabaseAdmin()
}

async function validateTokenAndAccess(token: string, interventionId: string) {
  const artisanId = await validatePortalToken(token)
  if (!artisanId) {
    return { valid: false, artisanId: null }
  }

  const hasAccess = await checkArtisanAccessToIntervention(artisanId, interventionId)
  if (!hasAccess) {
    return { valid: false, artisanId: null }
  }

  return { valid: true, artisanId }
}

/**
 * POST /api/portail/photos
 * Upload une photo pour une intervention via le portail artisan
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get("token") as string
    const interventionId = formData.get("interventionId") as string
    const comment = formData.get("comment") as string | null
    const file = formData.get("file") as File

    if (!token || !interventionId || !file) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    const { valid, artisanId } = await validateTokenAndAccess(token, interventionId)
    if (!valid) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Générer un nom de fichier unique
    const uniqueId = randomUUID()
    const ext = file.name.split(".").pop() || "jpg"
    const filename = `photo_${uniqueId}.${ext}`
    const storagePath = `${interventionId}/${filename}`

    // Upload vers Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from("intervention-attachments")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error("Erreur upload storage:", uploadError)
      return NextResponse.json({ error: "Erreur upload" }, { status: 500 })
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from("intervention-attachments")
      .getPublicUrl(storagePath)

    // Insérer dans la BDD
    const { data: attachment, error: insertError } = await supabase
      .from("intervention_attachments")
      .insert({
        intervention_id: interventionId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        metadata: {
          comment: comment || null,
          uploaded_by: "artisan_portal",
          artisan_id: artisanId,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error("Erreur insertion photo:", insertError)
      // Nettoyer le fichier uploadé
      await supabase.storage.from("intervention-attachments").remove([storagePath])
      return NextResponse.json({ error: "Erreur BDD" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      photo: {
        id: attachment.id,
        url: publicUrl,
        filename: file.name,
        comment: comment || null,
        createdAt: attachment.created_at
      }
    })

  } catch (error: any) {
    console.error("Erreur POST photo:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
