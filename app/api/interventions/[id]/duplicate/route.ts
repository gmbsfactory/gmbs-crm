import { NextResponse } from "next/server"
import { duplicateIntervention } from "@/lib/api/v2/interventions/server"
import { createSSRServerClient } from "@/lib/supabase/server-ssr"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, { params }: Params) {
  try {
    const permCheck = await requirePermission(request, "write_interventions")
    if (isPermissionError(permCheck)) return permCheck.error

    const { id } = await params
    
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous reconnecter." }, { status: 401 })
    }

    // Dupliquer l'intervention avec le token d'authentification
    let original
    try {
      original = await duplicateIntervention(id, user.id)
    } catch (error) {
      // Gestion d'erreur améliorée pour le cas où l'intervention originale n'existe plus
      // (User Story 5, scénario 5)
      if (error instanceof Error && error.message.includes("introuvable")) {
        return NextResponse.json(
          { error: "L'intervention originale n'existe plus" },
          { status: 404 }
        )
      }
      throw error
    }
    
    // Vérification explicite que l'intervention a bien été créée
    if (!original) {
      return NextResponse.json(
        { error: "L'intervention originale n'existe plus" },
        { status: 404 }
      )
    }
    
    // Créer le commentaire système directement avec le client Supabase authentifié
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        entity_id: original.id,
        entity_type: 'intervention',
        content: `devis supp avec l'ancien ID ${id}`,
        comment_type: 'system',
        author_id: user.id,
        is_internal: true,
      })
      .select()
      .single()

    if (commentError) {
      console.error("[api/interventions/[id]/duplicate] Erreur lors de la création du commentaire:", commentError)
      // Ne pas échouer la duplication si le commentaire échoue, mais logger l'erreur
    }
    
    return NextResponse.json({ intervention: original })
  } catch (error) {
    console.error("[api/interventions/[id]/duplicate] Erreur:", error)
    const message = error instanceof Error ? error.message : "Erreur lors de la duplication"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
