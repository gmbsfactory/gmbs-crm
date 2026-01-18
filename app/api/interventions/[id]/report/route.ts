
import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { getIntervention } from "@/lib/api/interventions"
import { listInterventionDocuments } from "@/lib/api/documents"
import OpenAI from "openai"

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. Verify Authentication
        const supabase = createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
        }

        // 2. Fetch Intervention Data
        const intervention = await getIntervention({ id, includeDocuments: false })
        if (!intervention) {
            return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
        }

        // 3. Fetch Documents (Photos & Comments)
        const documents = await listInterventionDocuments(id)
        const photosWithComments = documents
            .filter(doc => doc.mimeType?.startsWith('image/') && doc.metadata?.comment)
            .map(doc => ({
                filename: doc.name,
                comment: doc.metadata?.comment as string
            }))

        // 4. Construct Prompt
        const prompt = `
      Tu es un expert en bâtiment et maintenance immobilière. Rédige un compte-rendu d'intervention professionnel, clair et concis.
      
      CONTEXTE DE L'INTERVENTION :
      - Titre/Contexte : ${intervention.context}
      - Adresse : ${intervention.address}
      - Date : ${new Date().toLocaleDateString("fr-FR")}
      
      OBSERVATIONS (Photos et Commentaires) :
      ${photosWithComments.length > 0
                ? photosWithComments.map(p => `- Photo "${p.filename}" : ${p.comment}`).join("\n")
                : "Aucune observation spécifique sur les photos."}
      
      ${intervention.consigne ? `CONSIGNES INITIALES : ${intervention.consigne}` : ""} 
      
      STRUCTURE DU RAPPORT ATTENDUE (Format Texte, pas de Markdown inutile) :
      1. Introduction (Rappel du contexte)
      2. Constats et Observations (Synthèse des éléments relevés)
      3. Conclusion et Recommandations
      
      Rédige le rapport directement en français, sur un ton formel et professionnel.
    `

        // 5. Call OpenAI
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "Assistant rédaction rapport technique." }, { role: "user", content: prompt }],
            model: "gpt-4o", // Or gpt-3.5-turbo if cost is concern, but gpt-4o is better for synthesis
        })

        const summary = completion.choices[0].message.content

        return NextResponse.json({ summary })

    } catch (error: any) {
        console.error("Erreur génération rapport:", error)
        return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
    }
}
