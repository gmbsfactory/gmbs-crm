import { NextRequest, NextResponse } from "next/server"
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
 * POST /api/portail/report/submit
 * Soumet le rapport d'intervention (passe le statut de draft à submitted)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, interventionId, reportId } = body

    if (!token || !interventionId || !reportId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    const { valid, artisanId } = await validateTokenAndAccess(token, interventionId)
    if (!valid) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Récupérer le rapport
    const { data: report, error: reportError } = await supabase
      .from("intervention_attachments")
      .select("id, metadata")
      .eq("id", reportId)
      .eq("intervention_id", interventionId)
      .single()

    if (reportError || !report) {
      return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 })
    }

    // Mettre à jour le statut
    const existingMetadata = (report.metadata || {}) as Record<string, any>
    const updatedMetadata = {
      ...existingMetadata,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by_artisan: artisanId
    }

    const { error: updateError } = await supabase
      .from("intervention_attachments")
      .update({ metadata: updatedMetadata })
      .eq("id", reportId)

    if (updateError) {
      console.error("Erreur mise à jour statut rapport:", updateError)
      return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 })
    }

    // Optionnel : Ajouter un commentaire sur l'intervention pour notifier le gestionnaire
    await supabase
      .from("comments")
      .insert({
        entity_id: interventionId,
        entity_type: "intervention",
        content: "📋 Rapport d'intervention soumis par l'artisan via le portail.",
        comment_type: "system",
        is_internal: true,
      })

    return NextResponse.json({
      success: true,
      message: "Rapport soumis avec succès"
    })

  } catch (error: any) {
    console.error("Erreur soumission rapport:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
