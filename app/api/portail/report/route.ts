import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * POST /api/portail/report
 * Génère un rapport d'intervention basé sur les photos et leurs commentaires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, interventionId } = body

    if (!token || !interventionId) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
    }

    const { valid, artisanId } = await validateTokenAndAccess(token, interventionId)
    if (!valid) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Récupérer les détails de l'intervention
    const { data: intervention, error: interError } = await supabase
      .from("interventions")
      .select("id, id_inter, contexte, consigne, adresse, ville, code_postal, date")
      .eq("id", interventionId)
      .single()

    if (interError || !intervention) {
      return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
    }

    // Récupérer les photos avec leurs commentaires
    const { data: photos, error: photosError } = await supabase
      .from("intervention_attachments")
      .select("id, filename, metadata, created_at")
      .eq("intervention_id", interventionId)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true })

    if (photosError) {
      return NextResponse.json({ error: "Erreur récupération photos" }, { status: 500 })
    }

    // Construire le prompt
    const photosWithComments = (photos || [])
      .filter(p => (p.metadata as any)?.comment)
      .map((p, index) => {
        const metadata = p.metadata as any
        const timestamp = new Date(p.created_at).toLocaleTimeString("fr-FR", { 
          hour: "2-digit", 
          minute: "2-digit" 
        })
        return `Photo ${index + 1} (${timestamp}) : ${metadata.comment}`
      })

    const prompt = `
Tu es un expert en bâtiment et maintenance immobilière. Rédige un compte-rendu d'intervention professionnel, clair et concis.

CONTEXTE DE L'INTERVENTION :
- Référence : ${intervention.id_inter || "N/A"}
- Description : ${intervention.contexte || "Non précisée"}
- Adresse : ${[intervention.adresse, intervention.code_postal, intervention.ville].filter(Boolean).join(", ") || "Non précisée"}
- Date prévue : ${intervention.date ? new Date(intervention.date).toLocaleDateString("fr-FR") : "Non précisée"}

${intervention.consigne ? `CONSIGNES INITIALES : ${intervention.consigne}` : ""}

OBSERVATIONS DE L'ARTISAN (chronologiques) :
${photosWithComments.length > 0 
  ? photosWithComments.join("\n")
  : "Aucune observation textuelle fournie sur les photos."}

STRUCTURE DU RAPPORT ATTENDUE (Format texte, pas de Markdown inutile) :
1. Rappel du contexte et de la mission
2. Constats et travaux réalisés (synthèse des observations)
3. Points d'attention et recommandations

Rédige le rapport directement en français, sur un ton formel et professionnel.
Le rapport doit être concis (environ 200-300 mots maximum).
`

    // Appeler OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "Tu es un assistant qui rédige des rapports techniques d'intervention." },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o",
      max_tokens: 1000,
    })

    const reportContent = completion.choices[0].message.content || "Erreur lors de la génération du rapport."

    // Sauvegarder ou mettre à jour le rapport
    // D'abord vérifier s'il existe déjà un rapport
    const { data: existingReport } = await supabase
      .from("intervention_attachments")
      .select("id")
      .eq("intervention_id", interventionId)
      .eq("metadata->type", "report")
      .single()

    let reportId: string

    if (existingReport) {
      // Mettre à jour le rapport existant
      await supabase
        .from("intervention_attachments")
        .update({
          metadata: {
            type: "report",
            content: reportContent,
            status: "draft",
            generated_at: new Date().toISOString(),
            generated_by: "artisan_portal",
            artisan_id: artisanId
          }
        })
        .eq("id", existingReport.id)

      reportId = existingReport.id
    } else {
      // Créer un nouveau rapport
      const { data: newReport, error: insertError } = await supabase
        .from("intervention_attachments")
        .insert({
          intervention_id: interventionId,
          storage_path: `${interventionId}/report.txt`,
          filename: "rapport.txt",
          mime_type: "text/plain",
          metadata: {
            type: "report",
            content: reportContent,
            status: "draft",
            generated_at: new Date().toISOString(),
            generated_by: "artisan_portal",
            artisan_id: artisanId
          }
        })
        .select()
        .single()

      if (insertError) {
        console.error("Erreur sauvegarde rapport:", insertError)
        return NextResponse.json({ error: "Erreur sauvegarde" }, { status: 500 })
      }

      reportId = newReport.id
    }

    return NextResponse.json({
      success: true,
      report: {
        id: reportId,
        content: reportContent,
        generatedAt: new Date().toISOString(),
        status: "draft"
      }
    })

  } catch (error: any) {
    console.error("Erreur génération rapport:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
