import { NextResponse } from "next/server"
import { duplicateIntervention } from "@/lib/api/interventions"
import { createServerSupabase, bearerFrom } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

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
    
    // Récupérer le token depuis les headers ou les cookies
    let token = bearerFrom(request)
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }
    
    if (!token) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous connecter." }, { status: 401 })
    }
    
    // Récupérer l'utilisateur connecté avec le token
    const supabase = createServerSupabase(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous reconnecter." }, { status: 401 })
    }

    // Dupliquer l'intervention avec le token d'authentification
    let original
    try {
      original = await duplicateIntervention(id, user.id, token)
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
