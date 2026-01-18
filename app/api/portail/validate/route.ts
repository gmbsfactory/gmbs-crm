import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"

/**
 * POST /api/portail/validate
 * Valide un token de portail artisan et retourne les informations de l'artisan
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: "Token manquant" },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseAdmin()
    
    if (!supabase) {
      console.error("[portail/validate] supabaseAdmin is null")
      return NextResponse.json(
        { error: "Configuration serveur incorrecte" },
        { status: 500 }
      )
    }

    // Valider le token directement (sans RPC pour éviter les problèmes de schema cache)
    const { data: tokenData, error: tokenError } = await supabase
      .from("artisan_portal_tokens")
      .select("artisan_id, is_active, expires_at")
      .eq("token", token)
      .eq("is_active", true)
      .single()

    if (tokenError) {
      console.error("[portail/validate] Erreur recherche token:", tokenError)
      if (tokenError.code === "PGRST116") {
        // Token not found
        return NextResponse.json(
          { error: "Token invalide ou expiré" },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: "Erreur de validation" },
        { status: 500 }
      )
    }

    // Vérifier l'expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Token expiré" },
        { status: 401 }
      )
    }

    // Mettre à jour last_accessed_at
    await supabase
      .from("artisan_portal_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("token", token)

    // Récupérer les informations de l'artisan
    const { data: artisan, error: artisanError } = await supabase
      .from("artisans")
      .select(`
        id,
        prenom,
        nom,
        raison_sociale,
        email,
        telephone,
        telephone2,
        adresse_intervention,
        code_postal_intervention,
        ville_intervention,
        siret
      `)
      .eq("id", tokenData.artisan_id)
      .single()

    if (artisanError || !artisan) {
      console.error("[portail/validate] Artisan non trouvé:", artisanError)
      return NextResponse.json(
        { error: "Artisan introuvable" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      isValid: true,
      artisanId: tokenData.artisan_id,
      artisan
    })

  } catch (error: any) {
    console.error("[portail/validate] Erreur:", error)
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    )
  }
}
