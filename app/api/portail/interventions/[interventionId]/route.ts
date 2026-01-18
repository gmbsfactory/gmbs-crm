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
 * GET /api/portail/interventions/[interventionId]
 * Récupère le détail d'une intervention pour le portail artisan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  try {
    const { interventionId } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    const { valid, artisanId } = await validateTokenAndAccess(token, interventionId)
    if (!valid) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Récupérer les détails de l'intervention
    const { data: intervention, error: interError } = await supabase
      .from("interventions")
      .select(`
        id,
        id_inter,
        contexte,
        consigne,
        adresse,
        ville,
        code_postal,
        date,
        due_date,
        statut_id,
        metier_id,
        status:intervention_statuses!statut_id(code, label, color),
        metier:metiers!metier_id(label)
      `)
      .eq("id", interventionId)
      .single()

    if (interError || !intervention) {
      return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
    }

    // Récupérer les photos de l'intervention (uploadées par l'artisan via le portail)
    const { data: attachments, error: attachError } = await supabase
      .from("intervention_attachments")
      .select("id, storage_path, filename, mime_type, metadata, created_at")
      .eq("intervention_id", interventionId)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true })

    const photos = (attachments || []).map(att => {
      const { data: { publicUrl } } = supabase.storage
        .from("intervention-attachments")
        .getPublicUrl(att.storage_path)

      return {
        id: att.id,
        url: publicUrl,
        filename: att.filename,
        comment: (att.metadata as any)?.comment || null,
        createdAt: att.created_at
      }
    })

    // Récupérer le rapport s'il existe
    const { data: reportData } = await supabase
      .from("intervention_attachments")
      .select("id, metadata, created_at")
      .eq("intervention_id", interventionId)
      .eq("metadata->type", "report")
      .single()

    let report = null
    if (reportData) {
      const metadata = reportData.metadata as any
      report = {
        id: reportData.id,
        content: metadata?.content || "",
        generatedAt: reportData.created_at,
        status: metadata?.status || "draft"
      }
    }

    // Documents partagés par le CRM (lecture seule pour l'artisan)
    // Ces documents sont gérés par le gestionnaire dans le CRM
    const sharedDocuments = [
      { type: "devis", label: "Devis", url: null },
      { type: "facture_materiel", label: "Facture matériel", url: null },
      { type: "facture_artisan", label: "Facture artisan", url: null },
    ]

    // TODO: Récupérer les vraies URLs des documents depuis intervention_documents si disponibles

    return NextResponse.json({
      intervention: {
        id: intervention.id,
        id_inter: intervention.id_inter,
        context: intervention.contexte,
        consigne: intervention.consigne,
        address: intervention.adresse,
        city: intervention.ville,
        postal_code: intervention.code_postal,
        date: intervention.date,
        due_date: intervention.due_date,
        status: intervention.status,
        metier: intervention.metier,
        sharedDocuments
      },
      photos,
      report
    })

  } catch (error: any) {
    console.error("Erreur GET intervention detail:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
