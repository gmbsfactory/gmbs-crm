import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"
import { validatePortalToken } from "@/lib/portail/validateToken"

function getServiceSupabase() {
  return createServerSupabaseAdmin()
}

/**
 * GET /api/portail/documents
 * Récupère les documents d'un artisan via son token portail
 */
export async function GET(request: NextRequest) {
  try {
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

    // Récupérer les documents de l'artisan
    const { data: attachments, error } = await supabase
      .from("artisan_attachments")
      .select("id, kind, url, filename, created_at")
      .eq("artisan_id", artisanId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur récupération documents:", error)
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
    }

    // Transformer pour le front
    const documents = (attachments || []).map(att => ({
      kind: att.kind,
      uploaded: true,
      filename: att.filename,
      uploadedAt: att.created_at
    }))

    return NextResponse.json({ documents })

  } catch (error: any) {
    console.error("Erreur GET documents:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/portail/documents
 * Upload un document pour un artisan via son token portail
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get("token") as string
    const kind = formData.get("kind") as string
    const file = formData.get("file") as File

    if (!token || !kind || !file) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    const artisanId = await validatePortalToken(token)
    if (!artisanId) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Générer un nom de fichier unique
    const timestamp = Date.now()
    const ext = file.name.split(".").pop() || "pdf"
    const filename = `${kind}_${timestamp}.${ext}`
    const storagePath = `artisans/${artisanId}/${filename}`

    // Upload vers Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error("Erreur upload storage:", uploadError)
      return NextResponse.json({ error: "Erreur upload" }, { status: 500 })
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath)

    // Supprimer l'ancien document du même type s'il existe
    await supabase
      .from("artisan_attachments")
      .delete()
      .eq("artisan_id", artisanId)
      .eq("kind", kind)

    // Insérer le nouveau document dans la BDD
    const { data: attachment, error: insertError } = await supabase
      .from("artisan_attachments")
      .insert({
        artisan_id: artisanId,
        kind,
        url: publicUrl,
        filename: file.name,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Erreur insertion document:", insertError)
      return NextResponse.json({ error: "Erreur BDD" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      uploadedAt: attachment.created_at
    })

  } catch (error: any) {
    console.error("Erreur POST document:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
