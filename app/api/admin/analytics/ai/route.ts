import { NextResponse } from "next/server"
import OpenAI from "openai"

// Lazy initialization to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY n'est pas configurée")
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: Request) {
  try {
    const { messages, analyticsData } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY n'est pas configurée" },
        { status: 500 }
      )
    }

    const openai = getOpenAIClient()

    // Construire le contexte avec les données analytics disponibles
    const systemPrompt = `Tu es un assistant analytique spécialisé dans l'analyse de données CRM pour une entreprise de gestion de logements vacants et d'interventions.

Tu as accès aux données suivantes :
${analyticsData ? JSON.stringify(analyticsData, null, 2) : "Aucune donnée disponible pour le moment."}

Ton rôle est d'aider les utilisateurs à comprendre leurs données, identifier des tendances, et fournir des insights actionnables.

Réponds toujours en français, de manière claire et concise. Si tu n'as pas assez d'informations pour répondre précisément, indique-le et suggère comment obtenir ces informations.`

    const completionMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ]

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Utilisation de GPT-4o (le plus récent disponible, GPT-5 n'existe pas encore)
      messages: completionMessages,
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse."

    return NextResponse.json({ content: response })
  } catch (error) {
    console.error("[api/admin/analytics/ai] Erreur:", error)
    return NextResponse.json(
      {
        error: "Erreur lors de la génération de la réponse",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    )
  }
}

